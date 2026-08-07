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
// Measured directly (not assumed): 8,150 scattered dirty cells in one
// flush costs ~4ms, well inside the frame budget, and realistic dirty
// sets are two orders of magnitude smaller than that. Per-cell
// clearRect+arc+fill was investigated as a possible bottleneck and ruled
// out; batching fills by bucket colour was tried and measured *slower*
// at every realistic size, since clearRect still has to run per cell
// regardless (this layer only repaints what changed — clearing the whole
// canvas would erase untouched cells' content).
// Phase 4A placeholder for maturity — deliberately, unmistakably crude:
// neon green, a colour that appears nowhere else in the game, so there's no
// chance of mistaking a debug overlay for finished art. The real two-axis
// system (density -> thickness, maturity -> colour/texture) is Phase 4B.
// Without *something* on screen the scar ring can't be playtested at all,
// which is the same mistake `frozen` already made (docs/BACKLOG.md).
//
// The first attempt was a black overlay at low alpha, and it was invisible
// for a measurable structural reason rather than a tuning one: scarring
// concentrates exactly where the player clears, and cleared cells have
// growth bucket 0 — no slime circle drawn under them. Measured on a
// max-weapons run, **64% of all scarred cells sat on bucket-0 ground**, so
// most of the overlay was black drawn on black. The rest was dark-on-dark
// maroon and barely better. A placeholder has to be legible against the
// empty background, not just against slime.
//
// Drawn even where growth is 0, on purpose — maturity outlives the density
// that earned it (Decision 25), so a cleared-but-scarred cell should still
// read as scarred ground, matching "the arena is a legible record of the
// run."
const MATURITY_PLACEHOLDER_COLOR = '57,255,20'; // neon green, rgb components
const MATURITY_OVERLAY_ALPHA_STEP = 0.3;

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
    const matBucket = grid.matBucket[i]!;
    if (matBucket > 0) {
      layer.ctx.beginPath();
      layer.ctx.fillStyle = `rgba(${MATURITY_PLACEHOLDER_COLOR},${matBucket * MATURITY_OVERLAY_ALPHA_STEP})`;
      layer.ctx.arc(px + grid.cellSize / 2, py + grid.cellSize / 2, r, 0, Math.PI * 2);
      layer.ctx.fill();
    }
  }
  dirty.clear();
}
