import type { Grid, Tower } from '../state';
import { cellBucket } from '../grid/grid';
import { AMBIENT_BASE, CREEP_RAMP } from '../tuning/growth';
import { growthCeiling, regrowthRateMult } from '../tuning/maturity';
import { clamp, dist } from '../util/math';

// Ambient infection growth. Two independent formulas rather than one
// continuous curve — see docs/DECISIONS.md #15:
//
// - OUTSIDE the safe radius: the original distance ramp, floored at
//   CREEP_RAMP so it never drops below the inside rate at the boundary
//   (continuity — no visible seam in front-line speed at the line).
// - INSIDE the safe radius: growth creeps in at CREEP_RAMP, damped
//   linearly by proximity to the tower (0 at the tower's own radius, 1
//   at the line). This used to be a hard `if (d < perimeter) continue`
//   gate, making the core structurally unreachable by ambient growth —
//   confirmed unintended prototype behavior, not a design choice.
//
// The two are deliberately independent: the outside ramp's formula is
// already exactly 0 at d=perimeter, so no single scaling factor could
// produce both curves from one expression. Keeping them separate also
// keeps "make the whole game harder" (AMBIENT_BASE, infectionMult) and
// "make breaches specifically more punishing" (CREEP_RAMP, the
// proximity exponent) as two independent knobs rather than coupling
// them through one formula.
//
// Takes infectionMult directly rather than a Tier — the tier table is
// flavour only (Decision 33); ambient escalation is its own curve
// (tuning/growth.ts's ambientInfectionMult, Decision 38).
export function applyAmbientGrowth(
  grid: Grid,
  tower: Tower,
  infectionMult: number,
  dt: number,
  dirty: Set<number>,
): void {
  const outerSpan = Math.max(1, grid.maxRange - grid.perimeter);
  const innerSpan = Math.max(1, grid.perimeter - tower.radius);
  for (let cy = 0; cy < grid.rows; cy++) {
    const wyBase = cy * grid.cellSize + grid.cellSize / 2;
    for (let cx = 0; cx < grid.cols; cx++) {
      const i = cy * grid.cols + cx;
      const frozen = grid.frozen[i]!;
      if (frozen > 0) {
        const newFrozen = Math.max(0, frozen - dt);
        grid.frozen[i] = newFrozen;
        // Phase 4B: frozen renders as a rim (grid/slimeLayer.ts) — mark
        // dirty only on the thaw transition, so the rim gets erased,
        // rather than every tick of the countdown.
        if (newFrozen === 0) dirty.add(i);
        continue;
      }

      // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S4): Frost's
      // Rime and Immolation's Ash — regrowth suppression, decayed in the
      // same pass frozen already is so no second per-cell loop is added.
      // The timer is checked first and the whole branch short-circuits
      // when it's expired (the common case — suppressed cells are a small
      // fraction of the field), so the extra cost is one array read per
      // cell rather than a second full pass.
      let regrowMult = 1;
      const regrowTimer = grid.regrowTimer[i]!;
      if (regrowTimer > 0) {
        const newTimer = Math.max(0, regrowTimer - dt);
        grid.regrowTimer[i] = newTimer;
        regrowMult = grid.regrowMult[i]!;
      }

      const wx = cx * grid.cellSize + grid.cellSize / 2;
      const d = dist(wx, wyBase, tower.x, tower.y);

      let rate: number;
      if (d < grid.perimeter) {
        const proximity = clamp((d - tower.radius) / innerSpan, 0, 1);
        rate = AMBIENT_BASE * infectionMult * CREEP_RAMP * proximity;
      } else {
        const outsideRamp = Math.pow(clamp((d - grid.perimeter) / outerSpan, 0, 1), 0.6);
        rate = AMBIENT_BASE * infectionMult * Math.max(outsideRamp, CREEP_RAMP);
      }
      if (rate <= 0) continue;

      // Phase 4A: mature ground regrows slower, to a higher ceiling — a
      // durability threat, not a speed threat (§7: speeding up the kill
      // zone would be unfair, since it's the one place the player is
      // forced to fight). Virgin ground tops out short of full because it's
      // undisturbed and has no reason to harden into anything.
      //
      // The ceiling is a fraction of this cell's headroom *above its own
      // threshold*, never an absolute density — an absolute ceiling below
      // grid.ts's 0.94 threshold cap left 22% of the arena permanently
      // unrevealable. See tuning/maturity.ts's CEILING_VIRGIN_FRAC.
      const maturity = grid.maturity[i]!;
      const ceiling = growthCeiling(maturity, grid.threshold[i]!);
      const dens = grid.growth[i]!;

      // Ambient growth only ever *adds*. A cell already at or above its
      // ceiling is left completely alone rather than being pulled back down
      // to it — Infection Events inject full-thickness slime on purpose
      // (2026-08-07, tuning/maturity.ts), and a ceiling that clawed that
      // back would silently undo every vein and bloom a few ticks after it
      // landed. The ceiling caps what ambient *grows to*, not what a cell
      // is allowed to hold.
      if (dens >= ceiling) continue;

      // Rate and ceiling are deliberately independent levers: the logistic
      // term stays normalized against full density (1 - dens) rather than
      // against the remaining headroom (ceiling - dens), so
      // regrowthRateMult alone controls *speed* and growthCeiling alone
      // controls *where it stops*. Normalizing against headroom instead
      // makes them cancel — mature ground's larger headroom exactly offsets
      // its slower rate, and "slower, to a higher ceiling" (§7) collapses
      // into "identical speed," which is measurably what happened before
      // this shape.
      const effRate = rate * regrowthRateMult(maturity) * regrowMult;
      const newDens = Math.min(ceiling, dens + effRate * dt * (1 - dens));
      if (newDens !== dens) {
        grid.growth[i] = newDens;
        const nb = cellBucket(grid, i);
        if (nb !== grid.bucket[i]) {
          grid.bucket[i] = nb;
          dirty.add(i);
        }
      }
    }
  }
}
