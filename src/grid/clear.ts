import type { Coagulant, GameState } from '../state';
import { clamp, dist, rand } from '../util/math';
import {
  COAGULANT_ARMOR_FLOOR,
  COAGULANT_DAMAGE_SCALE,
  COAGULANT_RESISTANCE,
} from '../tuning/coagulants';
import { MATURITY_MAX, SCAR_PER_DENSITY, ageFloorAt, maturityBucket, maturityYieldMult } from '../tuning/maturity';
import { COAGULANT_XP_RISK_PREMIUM, gemValueFromRemoved } from '../tuning/xp';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { dropGemShower } from '../systems/gems';
import { coagulantOverlapArea, splatterOnDeath } from '../systems/coagulants';
import { spawnParticles } from '../systems/particles';
import { cellBucket, gIdx, worldToCell } from './grid';

export interface ClearOptions {
  radiusPx?: number;
  freezeDuration?: number;
  // Per-weapon multiplier on damage dealt to coagulants — see
  // tuning/weapons.ts's WeaponDef.coagulantMult. Weapons that don't pass
  // one (tests, ad-hoc calls) get the neutral default.
  coagulantMult?: number;

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): the RESOLVE
  // stage, added as new ClearOptions fields rather than a real pipeline
  // stage — arsenal plan S4's one hard constraint is that stage 4 "may
  // add new ClearOptions; it may not add a second damage path," and
  // clearAt already is that one path (Decision 42). Built by
  // systems/resolveOpts.ts from a weapon's socketed gems; every field
  // here is a Behaviour-class gem's effect on this call.

  // Pierce, on the three area archetypes (pulse/cloud/ring): the grid
  // loop's density-resistance curve is skipped, so the hit lands at full
  // power into thick tissue instead of being blunted where it matters
  // most — a partial answer to "nothing scales up against density"
  // (arsenal plan S3). Grid-only; a coagulant's own resistance constant
  // represents "already maximum density" and has nothing to bypass.
  ignoreResistance?: boolean;
  // Splash, on the three area archetypes: flattens the linear distance
  // falloff so the rim of the hit reads close to full power instead of
  // trailing to zero — distinct from Expansion (bigger radius, same
  // shape) rather than a duplicate of it.
  flattenFalloff?: boolean;
  // Overflow: damage that would overkill a coagulant carries to the
  // single nearest surviving coagulant instead of being discarded by the
  // clamp below. One hop only, applied once after the main coagulant
  // loop — never chained further, so it terminates by construction.
  overflow?: boolean;
  // Kickback: every coagulant hit is shoved this many pixels outward from
  // the hit's origin, clamped to stay inside the arena. Establishes the
  // displacement primitive Repulsor (6F) and Inversion (6I) later reuse.
  kickback?: number;
  // Priming: a coagulant not hit in the last PRIMING_WINDOW seconds takes
  // this multiplier on the hit that breaks that streak. Coagulant-only —
  // see systems/resolveOpts.ts for why grid cells don't carry the same
  // per-cell "last hit" state (the exact cost that got assist credit
  // dropped in 5B).
  priming?: number;
}

// "Not hit recently," for Priming — long enough that a weapon has to
// genuinely spread its fire to keep triggering it, short enough that a
// single weapon cycling through a small group of coagulants still gets
// there.
const PRIMING_WINDOW = 2.0;

const GEM_DROP_THRESHOLD = 0.08;
// Shared by both the grid loop and the coagulant loop below, so a future
// balance-pass retune of one automatically keeps the other consistent —
// see docs/DECISIONS.md #50, "no new mechanic, just the same formula
// applied to an entity instead of a cell."
const DAMAGE_COEFF = 0.022;

// The core damage-the-field function: density directly resists both the
// radius and magnitude of a hit — sparse tissue clears in one satisfying
// chunk, mature tissue only chips down a little per hit. Direct port of
// the prototype's clearAt().
export function clearAt(state: GameState, x: number, y: number, power: number, opts: ClearOptions = {}): number {
  const grid = state.grid;
  if (!grid) return 0;
  const { cx, cy } = worldToCell(grid, x, y);
  const i0 = gIdx(grid, cx, cy);
  const baseDensity = grid.growth[i0] ?? 0;
  const radiusPx = (opts.radiusPx ?? 30) * clamp(1.25 - baseDensity, 0.4, 1.25);
  const radiusCells = Math.max(1, Math.round(radiusPx / grid.cellSize));
  const freezeDuration = opts.freezeDuration ?? 0;
  // Bucketing (not the yield formula above) needs the current age floor —
  // see tuning/maturity.ts's maturityBucket for why a fixed 0..1 split
  // can't stay legible as the floor itself rises over a run.
  const ageFloor = ageFloorAt(state.time);
  let totalRemoved = 0;
  // Tracked separately so only this portion carries the risk premium into
  // XP (Decision 31/61) — totalRemoved itself stays the honest physical
  // mass-removed figure the return value and the gem-drop threshold use.
  let coagulantRemoved = 0;

  for (let oy = -radiusCells; oy <= radiusCells; oy++) {
    const gy = cy + oy;
    if (gy < 0 || gy >= grid.rows) continue;
    for (let ox = -radiusCells; ox <= radiusCells; ox++) {
      const gx = cx + ox;
      if (gx < 0 || gx >= grid.cols) continue;
      const ddx = ox * grid.cellSize;
      const ddy = oy * grid.cellSize;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d > radiusPx) continue;
      const i = gy * grid.cols + gx;
      if (freezeDuration > 0) {
        // Phase 4B: frozen renders as a rim (grid/slimeLayer.ts), gated on
        // the dirty set like every other rendered state — mark dirty only
        // on the newly-frozen transition, not every hit while already
        // frozen, or an AoE freeze weapon would spam the dirty set for no
        // visible change.
        const wasFrozen = grid.frozen[i]! > 0;
        grid.frozen[i] = Math.max(grid.frozen[i]!, freezeDuration);
        if (!wasFrozen) state.dirty.add(i);
      }
      const dens = grid.growth[i]!;
      if (dens <= 0.001) continue;
      const rawFalloff = 1 - d / radiusPx;
      const falloff = opts.flattenFalloff ? Math.max(rawFalloff, 0.85) : rawFalloff;
      const resistance = opts.ignoreResistance ? 1.3 : clamp(1.3 - dens, 0.12, 1.3);
      // Phase 4A: maturity further reduces yield, floored so nothing is
      // ever unclearable (Decision 44's guarantee restated for terrain).
      const matYield = maturityYieldMult(grid.maturity[i]!);
      const removeAmt = clamp(power * DAMAGE_COEFF * falloff * resistance * matYield, 0, dens);
      if (removeAmt <= 0) continue;
      const newDens = Math.max(0, dens - removeAmt);
      const removedHere = dens - newDens;
      totalRemoved += removedHere;
      grid.growth[i] = newDens;
      const nb = cellBucket(grid, i);
      if (nb !== grid.bucket[i]) {
        grid.bucket[i] = nb;
        state.dirty.add(i);
      }

      // "You scar what you clear" (Decision 25/63) — the only place
      // maturity is ever gained. Capped, never consumed by anything else.
      const newMaturity = Math.min(MATURITY_MAX, grid.maturity[i]! + removedHere * SCAR_PER_DENSITY);
      if (newMaturity !== grid.maturity[i]) {
        grid.maturity[i] = newMaturity;
        const nmb = maturityBucket(newMaturity, ageFloor);
        if (nmb !== grid.matBucket[i]) {
          grid.matBucket[i] = nmb;
          state.dirty.add(i);
        }
      }
    }
  }

  // Coagulants aren't in the grid (Decision 42's one hard constraint —
  // putting them there would let them scar terrain as they walk, now that
  // Phase 4A's maturity exists). So they get their own loop here rather than
  // falling out of the cell loop above: same falloff/resistance shape,
  // scaled by how much of the hit disc actually overlaps the blob
  // instead of by a flat per-weapon constant. A coagulant's local
  // "density" is fixed at 1 — it IS the densest slime in the game
  // (Decision 46) — so resistance is a constant, not sampled.
  //
  // Phase 4C-2 (Decision 69): `c.radius` is still the cheap bounding-circle
  // reject below, but the overlap area itself goes through
  // coagulantOverlapArea, which sums per-part overlap for a non-circular
  // body (Bulwark) instead of treating it as one big circle.
  const weaponMult = opts.coagulantMult ?? 1;
  // Phase 6A-2: Overflow's excess is summed across every coagulant this
  // call overkills, then applied once, after the loop, to the single
  // nearest survivor — never chained into a second overflow, which is
  // what makes it terminate by construction rather than by a visited set.
  let overflowExcess = 0;
  for (const c of state.coagulants) {
    if (c.mass <= 0) continue;
    if (dist(x, y, c.x, c.y) > radiusPx + c.radius) continue; // cheap reject before the trig
    const overlap = coagulantOverlapArea(c, x, y, radiusPx);
    if (overlap <= 0) continue;
    const cellsEquivalent = overlap / (grid.cellSize * grid.cellSize);
    const effectivePower = Math.max(power - c.armor, power * COAGULANT_ARMOR_FLOOR);
    // Priming: a coagulant not hit in the last PRIMING_WINDOW seconds
    // takes the bonus on the hit that breaks the streak.
    const primed = opts.priming !== undefined && state.time - c.lastHitAt >= PRIMING_WINDOW;
    const primingMult = primed ? opts.priming! : 1;
    const raw =
      effectivePower * DAMAGE_COEFF * cellsEquivalent * COAGULANT_RESISTANCE * weaponMult * COAGULANT_DAMAGE_SCALE * primingMult;
    const removeAmt = clamp(raw, 0, c.mass);
    if (removeAmt <= 0) continue;
    c.lastHitAt = state.time;
    c.mass -= removeAmt;
    totalRemoved += removeAmt;
    coagulantRemoved += removeAmt;
    if (opts.overflow && raw > removeAmt) overflowExcess += raw - removeAmt;
    if (opts.kickback && opts.kickback > 0) {
      const angle = Math.atan2(c.y - y, c.x - x);
      c.x = clamp(c.x + Math.cos(angle) * opts.kickback, c.radius, WORLD_WIDTH - c.radius);
      c.y = clamp(c.y + Math.sin(angle) * opts.kickback, c.radius, WORLD_HEIGHT - c.radius);
    }
    if (c.mass <= 0) splatterOnDeath(state, c);
  }

  if (overflowExcess > 0) {
    let nearest: Coagulant | null = null;
    let nearestDist = Infinity;
    for (const c of state.coagulants) {
      if (c.mass <= 0) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }
    if (nearest) {
      const applied = clamp(overflowExcess, 0, nearest.mass);
      nearest.mass -= applied;
      totalRemoved += applied;
      coagulantRemoved += applied;
      nearest.lastHitAt = state.time;
      if (nearest.mass <= 0) splatterOnDeath(state, nearest);
    }
  }

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10a): the HUD's
  // overall-DPS readout. Mass destroyed, not damage requested — the gap
  // between the two (resistance, maturity, coagulant armor, all applied
  // above) is exactly what makes this readout worth having over a raw
  // damage-number sum. systems/dps.ts drains this once per frame.
  state.dpsAccum += totalRemoved;

  if (totalRemoved > GEM_DROP_THRESHOLD) {
    // Risk premium applies only to the coagulant share of what was
    // removed this hit — a horde kill pays a little more per unit mass
    // than the same mass cleared loose in the field (Decision 31/61).
    const xpBasis = totalRemoved + coagulantRemoved * COAGULANT_XP_RISK_PREMIUM;
    const xpVal = gemValueFromRemoved(xpBasis);
    if (xpVal >= 1) dropGemShower(state, x + rand(-10, 10), y + rand(-10, 10), xpVal);
    spawnParticles(state, x, y, '#ff5d8a', Math.min(10, Math.round(totalRemoved * 3)), 70);
  }
  return totalRemoved;
}
