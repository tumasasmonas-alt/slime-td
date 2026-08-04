import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { TIERS_LIST } from '../tuning/tiers';
import { CELL_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { buildGrid, cellBucket, gIdx, isRevealedIdx, worldToCell } from './grid';

// Pure-math grid functions don't need a real generated field — a small
// synthetic fixture is faster and keeps these tests independent of the
// reaction-diffusion output.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    cols: 4,
    rows: 4,
    size: 16,
    cellSize: 13,
    vein: new Float32Array(16),
    threshold: new Float32Array(16),
    growth: new Float32Array(16),
    frozen: new Float32Array(16),
    bucket: new Int8Array(16),
    maxRange: 100,
    safeRadius: 50,
    ...overrides,
  };
}

describe('buildGrid', () => {
  it('sizes to the fixed world, starts at zero growth, tier-0 safe radius, valid thresholds', () => {
    const grid = buildGrid();
    expect(grid.cols).toBe(Math.ceil(WORLD_WIDTH / CELL_SIZE) + 2);
    expect(grid.rows).toBe(Math.ceil(WORLD_HEIGHT / CELL_SIZE) + 2);
    expect(grid.size).toBe(grid.cols * grid.rows);
    expect(grid.growth.every((v) => v === 0)).toBe(true);
    expect(grid.safeRadius).toBe(TIERS_LIST[0]!.safeRadius);
    for (const t of grid.threshold) {
      expect(t).toBeGreaterThanOrEqual(0.045);
      expect(t).toBeLessThanOrEqual(0.94);
    }
  });
});

describe('worldToCell / gIdx', () => {
  const grid = makeTestGrid();

  it('clamps out-of-bounds world coordinates into the grid', () => {
    expect(worldToCell(grid, -500, -500)).toEqual({ cx: 0, cy: 0 });
    expect(worldToCell(grid, 999_999, 999_999)).toEqual({ cx: grid.cols - 1, cy: grid.rows - 1 });
  });

  it('gIdx matches row-major indexing for an in-range cell', () => {
    const { cx, cy } = worldToCell(grid, 20, 30);
    expect(gIdx(grid, cx, cy)).toBe(cy * grid.cols + cx);
  });
});

describe('cellBucket / isRevealedIdx', () => {
  it('is bucket 0 and not revealed when growth is at or below threshold', () => {
    const grid = makeTestGrid();
    grid.threshold[0] = 0.5;
    grid.growth[0] = 0.5;
    expect(cellBucket(grid, 0)).toBe(0);
    expect(isRevealedIdx(grid, 0)).toBe(false);
  });

  it('reaches the top bucket at full growth over a zero threshold', () => {
    const grid = makeTestGrid();
    grid.threshold[0] = 0;
    grid.growth[0] = 1;
    expect(cellBucket(grid, 0)).toBe(5);
    expect(isRevealedIdx(grid, 0)).toBe(true);
  });

  it('is revealed as soon as growth exceeds threshold, even slightly', () => {
    const grid = makeTestGrid();
    grid.threshold[0] = 0.3;
    grid.growth[0] = 0.31;
    expect(isRevealedIdx(grid, 0)).toBe(true);
    expect(cellBucket(grid, 0)).toBeGreaterThanOrEqual(1);
  });
});
