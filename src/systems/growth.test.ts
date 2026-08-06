import { describe, expect, it } from 'vitest';
import type { Grid, Tower } from '../state';
import { applyAmbientGrowth } from './growth';

// Synthetic small grid, matching the fixture pattern used in grid.test.ts —
// independent of the real reaction-diffusion output.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 400;
  return {
    cols: 20,
    rows: 20,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 300,
    perimeter: 100,
    ...overrides,
  };
}

function makeTower(overrides: Partial<Tower> = {}): Tower {
  return {
    x: 100,
    y: 100,
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

describe('applyAmbientGrowth — outside the safe radius', () => {
  it('grows cells outside the safe radius over repeated ticks', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    // cell (0,0) -> world center (5,5), well outside perimeter=100.
    const i = 0;
    applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    expect(grid.growth[i]).toBeGreaterThan(0);
    const afterOneTick = grid.growth[i]!;
    for (let k = 0; k < 20; k++) {
      applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    }
    expect(grid.growth[i]).toBeGreaterThan(afterOneTick);
    expect(grid.growth[i]).toBeLessThanOrEqual(1);
  });

  it('marks a cell dirty only on the tick its bucket actually changes', () => {
    const grid = makeTestGrid();
    grid.threshold[0] = 0; // reveals immediately once growth is > 0
    const tower = makeTower();
    const dirty = new Set<number>();
    applyAmbientGrowth(grid, tower, 1, 0.18, dirty);
    expect(dirty.has(0)).toBe(true);
    dirty.clear();
    // Same bucket next tick (still climbing toward the top, not crossing
    // into a new one) shouldn't necessarily re-mark — but once it does
    // change, it must be re-marked.
    grid.bucket[0] = 5; // pin at the top bucket so no further change is possible
    grid.growth[0] = 1;
    applyAmbientGrowth(grid, tower, 1, 0.18, dirty);
    expect(dirty.has(0)).toBe(false);
  });

  it('freezes growth and counts the freeze timer down instead', () => {
    const grid = makeTestGrid();
    grid.frozen[0] = 0.3;
    const tower = makeTower();
    applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    expect(grid.growth[0]).toBe(0);
    expect(grid.frozen[0]).toBeCloseTo(0.12, 5);

    applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    expect(grid.frozen[0]).toBe(0);
    // The tick that brings the freeze timer to zero still `continue`s past
    // growth for that cell — growth only resumes on the tick after.
    expect(grid.growth[0]).toBe(0);
  });
});

describe('applyAmbientGrowth — inside the safe radius (the creep)', () => {
  // docs/DECISIONS.md #15: ambient growth used to be hard-gated to zero
  // inside perimeter (confirmed unintended prototype behavior — see
  // prototype bug #2 in the same file). It now creeps in at a rate damped
  // linearly by proximity to the tower, so the core is genuinely
  // reachable rather than structurally safe.

  it('creeps in in the middle of the safe zone, unlike the old hard gate', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    // Cell halfway between the tower's radius and the safe radius —
    // under the old hard gate this stayed at exactly 0 forever.
    const midR = (tower.radius + grid.perimeter) / 2;
    const cx = Math.round((tower.x + midR) / grid.cellSize);
    const cy = Math.round(tower.y / grid.cellSize);
    const i = cy * grid.cols + cx;
    for (let k = 0; k < 200; k++) {
      applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    }
    expect(grid.growth[i]).toBeGreaterThan(0);
  });

  it('grows much slower right at the tower\'s edge than in the middle of the zone', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    const nearTowerR = tower.radius + 2;
    const midR = (tower.radius + grid.perimeter) / 2;
    const cy = Math.round(tower.y / grid.cellSize);
    const nearTowerI = cy * grid.cols + Math.round((tower.x + nearTowerR) / grid.cellSize);
    const midI = cy * grid.cols + Math.round((tower.x + midR) / grid.cellSize);
    for (let k = 0; k < 50; k++) {
      applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    }
    // Relative comparison rather than an absolute closeness check — the
    // exact magnitude at any one cell is sensitive to grid quantization,
    // but "damped hard near the tower" should hold regardless.
    expect(grid.growth[nearTowerI]).toBeLessThan(grid.growth[midI]! * 0.2);
  });

  it('grows faster closer to the safe-radius line than closer to the tower', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    const nearTowerR = tower.radius + 10;
    const nearLineR = grid.perimeter - 10;
    const nearTowerI =
      Math.round((tower.y) / grid.cellSize) * grid.cols + Math.round((tower.x + nearTowerR) / grid.cellSize);
    const nearLineI =
      Math.round((tower.y) / grid.cellSize) * grid.cols + Math.round((tower.x + nearLineR) / grid.cellSize);
    for (let k = 0; k < 30; k++) {
      applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    }
    expect(grid.growth[nearLineI]).toBeGreaterThan(grid.growth[nearTowerI]!);
  });

  it('is continuous across the safe-radius boundary — no visible seam in growth rate', () => {
    const grid = makeTestGrid();
    const tower = makeTower();
    const justInsideR = grid.perimeter - 1;
    const justOutsideR = grid.perimeter + 1;
    const justInsideI =
      Math.round(tower.y / grid.cellSize) * grid.cols + Math.round((tower.x + justInsideR) / grid.cellSize);
    const justOutsideI =
      Math.round(tower.y / grid.cellSize) * grid.cols + Math.round((tower.x + justOutsideR) / grid.cellSize);
    applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
    // Both are essentially at the line, so their single-tick growth
    // should be very close, not an order of magnitude apart.
    const inside = grid.growth[justInsideI]!;
    const outside = grid.growth[justOutsideI]!;
    expect(inside).toBeGreaterThan(0);
    expect(Math.abs(inside - outside)).toBeLessThan(Math.max(inside, outside) * 0.5);
  });
});
