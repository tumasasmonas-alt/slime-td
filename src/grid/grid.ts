import type { Grid } from '../state';
import { clamp } from '../util/math';
import { TIERS_LIST } from '../tuning/tiers';
import { CELL_SIZE, WORLD_HEIGHT, WORLD_MAX_RANGE, WORLD_WIDTH } from '../tuning/world';
import { generateVeinField } from './veinField';

// Sized to the fixed world (tuning/world.ts), not a window — every player
// gets an identically-sized grid regardless of monitor. See
// docs/KNOWN_ISSUES.md "Resolved" section.
export function buildGrid(): Grid {
  const cols = Math.ceil(WORLD_WIDTH / CELL_SIZE) + 2;
  const rows = Math.ceil(WORLD_HEIGHT / CELL_SIZE) + 2;
  const size = cols * rows;

  const vein = generateVeinField(cols, rows);
  const threshold = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    threshold[i] = clamp(1 - vein[i]!, 0.045, 0.94);
  }

  const firstTier = TIERS_LIST[0];
  if (!firstTier) throw new Error('TIERS_LIST is empty');

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
    maxRange: WORLD_MAX_RANGE,
    safeRadius: firstTier.safeRadius,
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

// Density buckets 0-5 map to these slime colors — sparse tissue starts
// dark maroon, mature tissue brightens toward hot pink. Preserve exactly;
// see "Palette" in docs/PROTOTYPE_HANDOFF.md.
export const BUCKET_COLORS: readonly string[] = [
  'transparent',
  '#5c2430',
  '#8a2f42',
  '#c23a5a',
  '#ff3f68',
  '#ff7590',
];

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
