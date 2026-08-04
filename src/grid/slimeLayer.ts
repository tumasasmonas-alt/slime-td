import type { Grid, SlimeLayer } from '../state';
import { BUCKET_COLORS } from './grid';

export function initSlimeLayer(grid: Grid): SlimeLayer {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * grid.cellSize;
  canvas.height = grid.rows * grid.cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas rendering context is unavailable');
  return { canvas, ctx };
}

// Repaints only the cells marked dirty since the last call, rather than
// the whole grid every frame — cheap enough to run every simulation tick.
export function flushDirtyCells(grid: Grid, layer: SlimeLayer, dirty: Set<number>): void {
  if (dirty.size === 0) return;
  const r = grid.cellSize * 0.62;
  for (const i of dirty) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const px = cx * grid.cellSize;
    const py = cy * grid.cellSize;
    layer.ctx.clearRect(px - 1, py - 1, grid.cellSize + 2, grid.cellSize + 2);
    const bucket = grid.bucket[i]!;
    if (bucket > 0) {
      layer.ctx.beginPath();
      layer.ctx.fillStyle = BUCKET_COLORS[bucket]!;
      layer.ctx.arc(px + grid.cellSize / 2, py + grid.cellSize / 2, r, 0, Math.PI * 2);
      layer.ctx.fill();
    }
  }
  dirty.clear();
}
