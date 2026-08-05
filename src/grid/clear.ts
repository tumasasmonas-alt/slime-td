import type { GameState } from '../state';
import { clamp, rand } from '../util/math';
import { gemValueFromRemoved } from '../tuning/xp';
import { dropGem } from '../systems/gems';
import { spawnParticles } from '../systems/particles';
import { cellBucket, gIdx, worldToCell } from './grid';

export interface ClearOptions {
  radiusPx?: number;
  freezeDuration?: number;
}

const GEM_DROP_THRESHOLD = 0.08;

// The core damage-the-field function: density directly resists both the
// radius and magnitude of a hit — sparse tissue clears in one satisfying
// chunk, mature tissue only chips down a little per hit. Direct port of
// the prototype's clearAt(). Growth-node interaction is deliberately
// left out — nodes don't exist until Phase 2D.
export function clearAt(state: GameState, x: number, y: number, power: number, opts: ClearOptions = {}): number {
  const grid = state.grid;
  if (!grid) return 0;
  const { cx, cy } = worldToCell(grid, x, y);
  const i0 = gIdx(grid, cx, cy);
  const baseDensity = grid.growth[i0] ?? 0;
  const radiusPx = (opts.radiusPx ?? 30) * clamp(1.25 - baseDensity, 0.4, 1.25);
  const radiusCells = Math.max(1, Math.round(radiusPx / grid.cellSize));
  const freezeDuration = opts.freezeDuration ?? 0;
  let totalRemoved = 0;

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
      if (freezeDuration > 0) grid.frozen[i] = Math.max(grid.frozen[i]!, freezeDuration);
      const dens = grid.growth[i]!;
      if (dens <= 0.001) continue;
      const falloff = 1 - d / radiusPx;
      const resistance = clamp(1.3 - dens, 0.12, 1.3);
      const removeAmt = clamp(power * 0.022 * falloff * resistance, 0, dens);
      if (removeAmt <= 0) continue;
      const newDens = Math.max(0, dens - removeAmt);
      totalRemoved += dens - newDens;
      grid.growth[i] = newDens;
      const nb = cellBucket(grid, i);
      if (nb !== grid.bucket[i]) {
        grid.bucket[i] = nb;
        state.dirty.add(i);
      }
    }
  }

  if (totalRemoved > GEM_DROP_THRESHOLD) {
    const xpVal = gemValueFromRemoved(totalRemoved);
    if (xpVal >= 1) dropGem(state, x + rand(-10, 10), y + rand(-10, 10), xpVal);
    spawnParticles(state, x, y, '#ff5d8a', Math.min(10, Math.round(totalRemoved * 3)), 70);
  }
  return totalRemoved;
}
