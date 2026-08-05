import { describe, expect, it } from 'vitest';
import type { Grid, Tower } from '../state';
import { TIERS_LIST } from '../tuning/tiers';
import { applyAmbientGrowth } from './growth';

// Synthetic small grid, matching the fixture pattern used in grid.test.ts —
// independent of the real reaction-diffusion output.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 100;
  return {
    cols: 10,
    rows: 10,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 100,
    safeRadius: 20,
    ...overrides,
  };
}

function makeTower(overrides: Partial<Tower> = {}): Tower {
  return {
    x: 50,
    y: 50,
    radius: 22,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
    shake: 0,
    ...overrides,
  };
}

const tier = TIERS_LIST[0]!;

describe('applyAmbientGrowth', () => {
  it('leaves cells inside the safe radius at zero growth', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    // cell (5,5) -> world center (55,55), ~7 units from the tower at (50,50) — inside safeRadius=20.
    const i = 5 * grid.cols + 5;
    for (let k = 0; k < 50; k++) {
      applyAmbientGrowth(grid, tower, tier, 0.18, new Set());
    }
    expect(grid.growth[i]).toBe(0);
  });

  it('grows cells outside the safe radius over repeated ticks', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    // cell (0,0) -> world center (5,5), well outside safeRadius=20.
    const i = 0;
    applyAmbientGrowth(grid, tower, tier, 0.18, new Set());
    expect(grid.growth[i]).toBeGreaterThan(0);
    const afterOneTick = grid.growth[i]!;
    for (let k = 0; k < 20; k++) {
      applyAmbientGrowth(grid, tower, tier, 0.18, new Set());
    }
    expect(grid.growth[i]).toBeGreaterThan(afterOneTick);
    expect(grid.growth[i]).toBeLessThanOrEqual(1);
  });

  it('marks a cell dirty only on the tick its bucket actually changes', () => {
    const grid = makeTestGrid();
    grid.threshold[0] = 0; // reveals immediately once growth is > 0
    const tower = makeTower();
    const dirty = new Set<number>();
    applyAmbientGrowth(grid, tower, tier, 0.18, dirty);
    expect(dirty.has(0)).toBe(true);
    dirty.clear();
    // Same bucket next tick (still climbing toward the top, not crossing
    // into a new one) shouldn't necessarily re-mark — but once it does
    // change, it must be re-marked.
    grid.bucket[0] = 5; // pin at the top bucket so no further change is possible
    grid.growth[0] = 1;
    applyAmbientGrowth(grid, tower, tier, 0.18, dirty);
    expect(dirty.has(0)).toBe(false);
  });

  it('freezes growth and counts the freeze timer down instead', () => {
    const grid = makeTestGrid();
    grid.frozen[0] = 0.3;
    const tower = makeTower();
    applyAmbientGrowth(grid, tower, tier, 0.18, new Set());
    expect(grid.growth[0]).toBe(0);
    expect(grid.frozen[0]).toBeCloseTo(0.12, 5);

    applyAmbientGrowth(grid, tower, tier, 0.18, new Set());
    expect(grid.frozen[0]).toBe(0);
    // The tick that brings the freeze timer to zero still `continue`s past
    // growth for that cell — growth only resumes on the tick after.
    expect(grid.growth[0]).toBe(0);
  });
});
