import type { Coagulant, GameState, Grid } from '../state';
import { cellBucket, gIdx, worldToCell } from '../grid/grid';
import {
  CARRIER_FEED_RADIUS,
  CARRIER_FEED_RATE,
  CARRIER_MASS_CAP_MULT,
  COAGULANT_ARRIVAL_DAMAGE_MULT,
  COAGULANT_SPLATTER,
  coagulantKindFromMass,
  coagulantRadius,
  coagulantSpeed,
} from '../tuning/coagulants';
import { circleOverlapArea, clamp, dist } from '../util/math';
import { generateSeeds } from './formation';
import { spawnParticles } from './particles';
import { damageTower } from './tower';

// Phase 4C-2 (Decision 69): distance from (x, y) to a coagulant's actual
// surface — the nearest part's surface when `parts` is populated
// (Bulwark), otherwise the bounding circle every other kind already used.
// Shared by findCoagulantHit below and systems/frontier.ts's targeting, so
// a non-circular body reads as exactly as close as it visibly is in both
// places, not as close as its bounding circle alone would suggest.
export function coagulantSurfaceDist(c: Coagulant, x: number, y: number): number {
  if (c.parts.length === 0) return Math.max(0, dist(x, y, c.x, c.y) - c.radius);
  let best = Infinity;
  for (const part of c.parts) {
    const d = Math.max(0, dist(x, y, c.x + part.dx, c.y + part.dy) - part.r);
    if (d < best) best = d;
  }
  return best;
}

// Phase 4C-2 (Decision 69): area of overlap between a hit disc and a
// coagulant's actual body — sums per-part overlap when `parts` is
// populated, otherwise the single circleOverlapArea call every other kind
// already used. grid/clear.ts's damage formula scales directly with this.
//
// Known simplification, accepted for a first pass: overlapping parts (a
// tightly-packed Bulwark's neighbours share some of the same physical
// area) aren't de-duplicated, so a hit landing where two parts overlap can
// be counted slightly more than once. BULWARK_PART_RADIUS_FRACTION and
// BULWARK_SPAN_FRACTION (tuning/coagulants.ts) keep that overlap modest;
// proper silhouette-union math would be real added complexity for a body
// shape this simple.
export function coagulantOverlapArea(c: Coagulant, hitX: number, hitY: number, hitRadius: number): number {
  if (c.parts.length === 0) return circleOverlapArea(hitX, hitY, hitRadius, c.x, c.y, c.radius);
  let total = 0;
  for (const part of c.parts) {
    total += circleOverlapArea(hitX, hitY, hitRadius, c.x + part.dx, c.y + part.dy, part.r);
  }
  return total;
}

// Adds as much of `remaining` as the cell has capacity for, returns
// what's left. Shared by every ring step in depositMass below.
function depositAtCell(grid: Grid, dirty: Set<number>, i: number, remaining: number): number {
  const capacity = 1 - grid.growth[i]!;
  if (capacity <= 0) return remaining;
  const add = Math.min(capacity, remaining);
  grid.growth[i]! += add;
  const nb = cellBucket(grid, i);
  if (nb !== grid.bucket[i]) {
    grid.bucket[i] = nb;
    dirty.add(i);
  }
  return remaining - add;
}

// Rule 1/Rule 3 (2026-08-05 record §8): mass moves between two
// containers — the grid and coagulant entities — and this is the one
// place it's ever placed back onto the grid. Grows the deposit area
// outward ring by ring until all of it fits, rather than clipping to a
// fixed disc: grid cells cap at growth=1, and a large arrival (or even a
// max-size splatter) can easily exceed what a modest radius can hold.
// Without this, mass would evaporate on arrival — spilling outward
// instead keeps total mass in the game exactly conserved except for
// combat kills, which is the invariant systems/coagulants.test.ts checks
// directly.
//
// Walks each ring's *perimeter* directly (top/bottom edges, then the
// left/right edges between them) rather than scanning the ring's full
// (2r+1)x(2r+1) bounding box and discarding everything but the edge —
// O(ring) cells visited per ring instead of O(ring²). Only matters at the
// extreme (a large arrival onto an already-saturated map with nowhere
// close to land), but that case is a real one: an unbounded box scan
// there costs 1.9M+ inner-loop iterations before this fix, confirmed by
// direct measurement, against ~30k after it.
function depositMass(state: GameState, x: number, y: number, mass: number): void {
  const grid = state.grid;
  if (!grid) return;
  let remaining = mass;
  const { cx: ccx, cy: ccy } = worldToCell(grid, x, y);
  const maxRing = Math.max(grid.cols, grid.rows);

  if (ccx >= 0 && ccx < grid.cols && ccy >= 0 && ccy < grid.rows) {
    remaining = depositAtCell(grid, state.dirty, gIdx(grid, ccx, ccy), remaining);
  }

  for (let ring = 1; remaining > 0.01 && ring < maxRing; ring++) {
    for (const cy of [ccy - ring, ccy + ring]) {
      if (cy < 0 || cy >= grid.rows) continue;
      for (let ox = -ring; ox <= ring && remaining > 0.01; ox++) {
        const cx = ccx + ox;
        if (cx < 0 || cx >= grid.cols) continue;
        remaining = depositAtCell(grid, state.dirty, gIdx(grid, cx, cy), remaining);
      }
    }
    for (const cx of [ccx - ring, ccx + ring]) {
      if (cx < 0 || cx >= grid.cols) continue;
      for (let oy = -ring + 1; oy <= ring - 1 && remaining > 0.01; oy++) {
        const cy = ccy + oy;
        if (cy < 0 || cy >= grid.rows) continue;
        remaining = depositAtCell(grid, state.dirty, gIdx(grid, cx, cy), remaining);
      }
    }
  }
}

// Rule 3 — arrival is the only real source: full remaining mass becomes
// tower damage *and* is dumped back into the field, seeding the breach
// that then bleeds via the existing contact-damage formula. No XP here —
// arrival is a failure state, not a kill.
function arriveAtCore(state: GameState, c: Coagulant): void {
  damageTower(state, c.mass * COAGULANT_ARRIVAL_DAMAGE_MULT);
  spawnParticles(state, c.x, c.y, '#ff2f56', 24, 200);
  depositMass(state, c.x, c.y, c.mass);
}

// Rule 2 — killing is a sink: damage already destroyed the mass (it
// became XP via clearAt's existing gem-drop pipeline, since coagulant
// damage feeds the same totalRemoved accumulator as grid clearing). This
// is a small *fixed* bonus on top, by size class, never a return of what
// the coagulant eats — called from grid/clear.ts the instant a hit takes
// mass to zero or below.
export function splatterOnDeath(state: GameState, c: Coagulant): void {
  spawnParticles(state, c.x, c.y, '#ff5d8a', 12, 90);
  depositMass(state, c.x, c.y, COAGULANT_SPLATTER[c.kind]);
  // The kill counter (HUD "Purged" stat) went dormant in Phase 3A when
  // nodes were removed, with a promise to wire it to coagulant kills once
  // they existed — this is that wire. Counts kills only, not arrivals:
  // arriving at the core is a failure, not something to celebrate. Field
  // kept its name rather than being renamed, per the project owner.
  state.nodesPurged += 1;
  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S6): Blades'
  // Bladestorm reads this — "the field just broke somewhere," any weapon,
  // any coagulant, since attributing a kill to a specific weapon needs
  // the clearAt return channel the BACKLOG already defers.
  state.lastCoagulantDeathAt = state.time;
}

// Blastoma fractures once its mass drops to c.splitAtMass (Phase 4C-1,
// Decision 68) — checked here in the update pass, not in grid/clear.ts,
// for the same reason Decisions 4/7 exist: clearAt is mid-iteration over
// state.coagulants when it deals damage, and pushing new entities onto
// that array mid-iteration is the same mutate-during-iteration hazard as
// mutating state during a draw call.
//
// Splits at a mass threshold rather than at death: by death, mass is 0,
// so there is nothing left to give children, and inventing some would
// break Rule 2 (killing is a sink). A threshold split conserves exactly —
// the parent's remaining mass divides evenly between exactly two
// fragments, offset perpendicular to its current heading so they visibly
// separate rather than overlapping in place.
//
// Each fragment's kind is derived from its own (smaller) mass via
// coagulantKindFromMass, per Rule 4 — not inherited from the parent, and
// never re-evaluated as Blastoma/Sclerotic (that needs the full
// maturity/fillRatio reading formation.ts has and this function doesn't).
// splitAtMass: 0 on both fragments guarantees neither re-splits, however
// far it's damaged afterward. Armor and sourceMaturity ARE inherited —
// fragments of hardened ground are still made of hardened ground.
function splitCoagulant(c: Coagulant, towardX: number, towardY: number): [Coagulant, Coagulant] {
  const angle = Math.atan2(towardY - c.y, towardX - c.x);
  const perp = angle + Math.PI / 2;
  const fragmentMass = c.mass / 2;
  const offset = c.radius * 0.6;
  const fragmentKind = coagulantKindFromMass(fragmentMass);
  const make = (sign: 1 | -1): Coagulant => ({
    x: c.x + Math.cos(perp) * offset * sign,
    y: c.y + Math.sin(perp) * offset * sign,
    mass: fragmentMass,
    armor: c.armor,
    kind: fragmentKind,
    radius: coagulantRadius(fragmentMass),
    speed: coagulantSpeed(fragmentMass),
    phase: 'active', // already mid-fight, not a fresh spark — no re-telegraph
    phaseTimer: 0,
    seeds: generateSeeds(fragmentMass, fragmentKind),
    splitAtMass: 0,
    sourceMaturity: c.sourceMaturity,
    parts: [], // a fragment is always a plain circle, even splitting off a Bulwark someday
    startMass: fragmentMass,
    lastHitAt: -Infinity, // a fresh fragment hasn't been hit yet, even though its parent had
    chilledUntil: 0,
    armorDebuff: 0,
    armorDebuffUntil: 0,
  });
  return [make(1), make(-1)];
}

// Phase 4C-2 (Decision 69): Decision 42's hook, left in place since Wave 1
// — "a seam where the Wave 2 Carrier can feed off the field it crosses."
// Consumes revealed growth in a small radius around the Carrier's current
// position each tick and adds it to its own mass, leaving a visibly
// thinned trail (§10's "worm track," which doubles as its own tell).
// Capped relative to its own starting mass, never absolute, so the cap
// scales with however large the corridor that spawned it already was.
function feedCarrier(state: GameState, c: Coagulant, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const cap = c.startMass * CARRIER_MASS_CAP_MULT;
  if (c.mass >= cap) return;

  const radiusCells = Math.ceil(CARRIER_FEED_RADIUS / grid.cellSize);
  const { cx: ccx, cy: ccy } = worldToCell(grid, c.x, c.y);
  let gained = 0;
  for (let oy = -radiusCells; oy <= radiusCells; oy++) {
    const cy = ccy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -radiusCells; ox <= radiusCells; ox++) {
      const cx = ccx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      const wx = cx * grid.cellSize + grid.cellSize / 2;
      const wy = cy * grid.cellSize + grid.cellSize / 2;
      if (dist(wx, wy, c.x, c.y) > CARRIER_FEED_RADIUS) continue;
      const i = gIdx(grid, cx, cy);
      const avail = grid.growth[i]!;
      if (avail <= 0) continue;
      const take = Math.min(avail, CARRIER_FEED_RATE * dt, cap - c.mass - gained);
      if (take <= 0) continue;
      grid.growth[i] = avail - take;
      gained += take;
      const nb = cellBucket(grid, i);
      if (nb !== grid.bucket[i]) {
        grid.bucket[i] = nb;
        state.dirty.add(i);
      }
    }
  }
  if (gained > 0) {
    c.mass = clamp(c.mass + gained, c.mass, cap);
    c.radius = coagulantRadius(c.mass);
    c.speed = coagulantSpeed(c.mass);
  }
}

// Straight line to the core at a per-mass speed (Decision 42, Decision
// 2026-08-06-B). `speed` lives on the entity rather than being computed
// from `mass` here — the seam left for the Wave 2 Carrier, which needs to
// modify its own speed as it feeds off the field it crosses, without this
// function changing.
//
// A coagulant sits in 'forming' first — visible, not yet moving, not yet
// a threat — before it detaches and goes 'active'. Added after the Phase
// 3C playtest gate found formation was instant: a full-mass, full-speed,
// already-lethal coagulant could appear with no warning at all.
export function updateCoagulants(state: GameState, dt: number): void {
  if (!state.grid) return;
  const t = state.tower;
  const remaining: Coagulant[] = [];
  for (const c of state.coagulants) {
    if (c.mass <= 0) continue; // killed by weapon damage this tick

    if (c.phase === 'forming') {
      c.phaseTimer -= dt;
      if (c.phaseTimer <= 0) c.phase = 'active';
      remaining.push(c);
      continue;
    }

    if (c.splitAtMass > 0 && c.mass <= c.splitAtMass) {
      remaining.push(...splitCoagulant(c, t.x, t.y));
      continue;
    }

    if (c.kind === 'carrier') feedCarrier(state, c, dt);

    const d = dist(c.x, c.y, t.x, t.y);
    if (d <= t.radius + c.radius) {
      arriveAtCore(state, c);
      continue;
    }
    const a = Math.atan2(t.y - c.y, t.x - c.x);
    c.x += Math.cos(a) * c.speed * dt;
    c.y += Math.sin(a) * c.speed * dt;
    remaining.push(c);
  }
  state.coagulants = remaining;
}

// Shared by weapons/blades.ts and systems/projectiles.ts — coagulants
// are entities, not grid cells, so anything whose collision currently
// gates on `isRevealedIdx` needs this alongside it or it flies straight
// through a blob sitting in an already-cleared area. Skips 'forming'
// coagulants — they haven't detached from the field yet, so nothing can
// hit them any more than it could hit ordinary ground.
//
// Phase 4C-2 (Decision 69): the bounding circle (`c.radius`) is still the
// cheap first reject, but ranking among survivors uses
// coagulantSurfaceDist — nearest *part*, not centre distance — so a point
// between two ends of a wide Bulwark doesn't falsely register as a hit
// just because it's within the bounding circle.
export function findCoagulantHit(state: GameState, x: number, y: number, hitRadius: number): Coagulant | null {
  let best: Coagulant | null = null;
  let bestDist = Infinity;
  for (const c of state.coagulants) {
    if (c.mass <= 0 || c.phase === 'forming') continue;
    if (dist(x, y, c.x, c.y) > c.radius + hitRadius) continue;
    const surfaceDist = coagulantSurfaceDist(c, x, y);
    if (surfaceDist > hitRadius) continue;
    if (surfaceDist < bestDist) {
      bestDist = surfaceDist;
      best = c;
    }
  }
  return best;
}
