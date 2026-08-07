import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { findNearbyRevealedPoint } from './targeting';

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 3600;
  return {
    cols: 60,
    rows: 60,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    maxRange: 300,
    perimeter: 20,
    ...overrides,
  };
}

describe('findNearbyRevealedPoint', () => {
  it('returns null when nothing revealed is within range', () => {
    const grid = makeTestGrid();
    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set())).toBeNull();
  });

  it('finds a revealed cell within the search radius', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32; // world ~(325, 315), near (300,300)
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.5;

    const result = findNearbyRevealedPoint(grid, 300, 300, 50, new Set());

    expect(result).not.toBeNull();
    expect(result!.i).toBe(idx);
  });

  it('ignores cells outside the search radius', () => {
    const grid = makeTestGrid();
    const idx = 50 * grid.cols + 50; // far away
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.9;

    expect(findNearbyRevealedPoint(grid, 300, 300, 20, new Set())).toBeNull();
  });

  it('skips visited cells', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32;
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.5;

    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set([idx]))).toBeNull();
  });

  it('prefers the most-grown candidate among several in range', () => {
    const grid = makeTestGrid();
    const lowIdx = 30 * grid.cols + 31; // ~(315, 305)
    const highIdx = 31 * grid.cols + 32; // ~(325, 315)
    grid.threshold[lowIdx] = 0.1;
    grid.growth[lowIdx] = 0.3;
    grid.threshold[highIdx] = 0.1;
    grid.growth[highIdx] = 0.9;

    const result = findNearbyRevealedPoint(grid, 300, 300, 50, new Set());

    expect(result!.i).toBe(highIdx);
  });

  it('ignores unrevealed density, even if raw growth is high', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32;
    grid.threshold[idx] = 0.9; // high threshold — not revealed
    grid.growth[idx] = 0.5;

    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set())).toBeNull();
  });
});
