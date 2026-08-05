import type { Grid, Tower } from '../state';
import { cellBucket } from '../grid/grid';
import type { Tier } from '../tuning/tiers';
import { AMBIENT_BASE } from '../tuning/growth';
import { clamp, dist } from '../util/math';

// Ambient infection growth: rises with distance past the safe radius (the
// ramp), gated to zero inside it. Direct port of the prototype's
// applyAmbientGrowth() — see docs/PROTOTYPE_HANDOFF.md "Safe zone".
export function applyAmbientGrowth(
  grid: Grid,
  tower: Tower,
  tier: Tier,
  dt: number,
  dirty: Set<number>,
): void {
  const span = Math.max(1, grid.maxRange - grid.safeRadius);
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
      if (d < grid.safeRadius) continue;
      const ramp = Math.pow(clamp((d - grid.safeRadius) / span, 0, 1), 0.6);
      if (ramp <= 0) continue;
      const rate = AMBIENT_BASE * tier.infectionMult * ramp;
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
