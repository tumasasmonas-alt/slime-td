import type { Coagulant, GameState, Grid } from '../state';
import { cellBucket, gIdx, worldToCell } from '../grid/grid';
import { COAGULANT_ARRIVAL_DAMAGE_MULT, COAGULANT_SPLATTER } from '../tuning/coagulants';
import { dist } from '../util/math';
import { spawnParticles } from './particles';
import { damageTower } from './tower';

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
export function findCoagulantHit(state: GameState, x: number, y: number, hitRadius: number): Coagulant | null {
  let best: Coagulant | null = null;
  let bestDist = Infinity;
  for (const c of state.coagulants) {
    if (c.mass <= 0 || c.phase === 'forming') continue;
    const d = dist(x, y, c.x, c.y);
    if (d > c.radius + hitRadius) continue;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
