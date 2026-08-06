import type { Grid, Tower } from '../state';
import { cellBucket } from '../grid/grid';
import { AMBIENT_BASE, CREEP_RAMP } from '../tuning/growth';
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
        grid.frozen[i] = Math.max(0, frozen - dt);
        continue;
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

      const dens = grid.growth[i]!;
      const newDens = Math.min(1, dens + rate * dt * (1 - dens));
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
