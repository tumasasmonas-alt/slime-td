import type { Grid } from '../state';
import { clamp } from '../util/math';
import { CELL_SIZE, PERIMETER, WORLD_HEIGHT, WORLD_MAX_RANGE, WORLD_WIDTH } from '../tuning/world';
import { generateVeinField } from './veinField';

// Sized to the fixed world (tuning/world.ts), not a window — every player
// gets an identically-sized grid regardless of monitor. See
// docs/BACKLOG.md "Resolved" section.
export function buildGrid(): Grid {
  const cols = Math.ceil(WORLD_WIDTH / CELL_SIZE) + 2;
  const rows = Math.ceil(WORLD_HEIGHT / CELL_SIZE) + 2;
  const size = cols * rows;

  const vein = generateVeinField(cols, rows);
  const threshold = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    threshold[i] = clamp(1 - vein[i]!, 0.045, 0.94);
  }

  return {
    cols,
    rows,
    size,
    cellSize: CELL_SIZE,
    vein,
    threshold,
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    maxRange: WORLD_MAX_RANGE,
    perimeter: PERIMETER,
    // Phase 6B-2: regrowMult defaults to 0 (Float32Array's own default),
    // deliberately never read unless regrowTimer > 0 — systems/growth.ts
    // treats an expired/never-set timer as "no suppression" (mult 1)
    // rather than requiring this array to be pre-filled with 1s.
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
  };
}

export function gIdx(grid: Grid, cx: number, cy: number): number {
  return cy * grid.cols + cx;
}

export function worldToCell(grid: Grid, x: number, y: number): { cx: number; cy: number } {
  return {
    cx: clamp(Math.floor(x / grid.cellSize), 0, grid.cols - 1),
    cy: clamp(Math.floor(y / grid.cellSize), 0, grid.rows - 1),
  };
}

// i is always produced by gIdx()/worldToCell() and therefore always
// in-bounds for this grid — the `!` assertions below encode that
// invariant rather than masking a real out-of-bounds case.
export function cellBucket(grid: Grid, i: number): number {
  const growth = grid.growth[i]!;
  const threshold = grid.threshold[i]!;
  if (growth <= threshold) return 0;
  const t = (growth - threshold) / Math.max(0.001, 1 - threshold);
  return 1 + Math.min(4, Math.floor(t * 5));
}

export function isRevealedIdx(grid: Grid, i: number): boolean {
  return grid.growth[i]! > grid.threshold[i]!;
}
