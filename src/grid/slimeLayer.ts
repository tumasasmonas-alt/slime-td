import type { Grid, SlimeLayer } from '../state';
import { BARE_SCAR_ALPHA, DENSITY_ALPHA, FROZEN_RIM_COLOR, MATURITY_COLORS } from '../tuning/palette';

export function initSlimeLayer(grid: Grid): SlimeLayer {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * grid.cellSize;
  canvas.height = grid.rows * grid.cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas rendering context is unavailable');
  return { canvas, ctx };
}

const FROZEN_RIM_WIDTH = 1.5;

// Repaints only the cells marked dirty since the last call, rather than
// the whole grid every frame — cheap enough to run every simulation tick.
// Measured directly (not assumed): 8,150 scattered dirty cells in one
// flush costs ~4ms, well inside the frame budget, and realistic dirty
// sets are two orders of magnitude smaller than that. Per-cell
// clearRect+arc+fill was investigated as a possible bottleneck and ruled
// out; batching fills by bucket colour was tried and measured *slower*
// at every realistic size, since clearRect still has to run per cell
// regardless (this layer only repaints what changed — clearing the whole
// canvas would erase untouched cells' content).
//
// Phase 4B (Decisions 66/67): density and maturity compose into one fill —
// density picks the alpha (thickness), maturity picks the colour
// (hardness) — replacing Phase 4A's neon-green maturity placeholder.
// Frozen draws as a rim on top, never a fill, so it can't compete with
// either axis (tuning/palette.ts). Bare scarred ground (no slime, but
// maturity > 0) still draws at a low alpha — maturity outlives the density
// that earned it (Decision 25), so a cleared-but-scarred cell reads as
// scarred ground, matching "the arena is a legible record of the run."
export function flushDirtyCells(grid: Grid, layer: SlimeLayer, dirty: Set<number>): void {
  if (dirty.size === 0) return;
  const r = grid.cellSize * 0.62;
  for (const i of dirty) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const px = cx * grid.cellSize;
    const py = cy * grid.cellSize;
    const cxWorld = px + grid.cellSize / 2;
    const cyWorld = py + grid.cellSize / 2;
    layer.ctx.clearRect(px - 1, py - 1, grid.cellSize + 2, grid.cellSize + 2);

    const bucket = grid.bucket[i]!;
    const matBucket = grid.matBucket[i]!;
    if (bucket > 0) {
      layer.ctx.beginPath();
      layer.ctx.fillStyle = `rgba(${MATURITY_COLORS[matBucket]},${DENSITY_ALPHA[bucket]})`;
      layer.ctx.arc(cxWorld, cyWorld, r, 0, Math.PI * 2);
      layer.ctx.fill();
    } else if (matBucket > 0) {
      layer.ctx.beginPath();
      layer.ctx.fillStyle = `rgba(${MATURITY_COLORS[matBucket]},${BARE_SCAR_ALPHA[matBucket]})`;
      layer.ctx.arc(cxWorld, cyWorld, r, 0, Math.PI * 2);
      layer.ctx.fill();
    }

    if (grid.frozen[i]! > 0) {
      layer.ctx.beginPath();
      layer.ctx.strokeStyle = FROZEN_RIM_COLOR;
      layer.ctx.lineWidth = FROZEN_RIM_WIDTH;
      layer.ctx.arc(cxWorld, cyWorld, r, 0, Math.PI * 2);
      layer.ctx.stroke();
    }
  }
  dirty.clear();
}
