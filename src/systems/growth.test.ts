import { describe, expect, it } from 'vitest';
import type { Grid, Tower } from '../state';
import { CREEP_RAMP } from '../tuning/growth';
import { MATURITY_MAX, growthCeiling } from '../tuning/maturity';
import { bladeRadius, frostRadius, immolationRadius } from '../tuning/weapons';
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
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
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

  describe('frozen dirty-marking (Phase 4B, Decision 66)', () => {
    it('does not mark a cell dirty while merely counting down', () => {
      const grid = makeTestGrid();
      grid.frozen[0] = 0.3;
      const tower = makeTower();
      const dirty = new Set<number>();

      applyAmbientGrowth(grid, tower, 1, 0.18, dirty);

      expect(grid.frozen[0]).toBeGreaterThan(0); // still frozen
      expect(dirty.has(0)).toBe(false);
    });

    it('marks a cell dirty on the exact tick it thaws, so the rim can be erased', () => {
      const grid = makeTestGrid();
      grid.frozen[0] = 0.1; // expires within one 0.18s tick
      const tower = makeTower();
      const dirty = new Set<number>();

      applyAmbientGrowth(grid, tower, 1, 0.18, dirty);

      expect(grid.frozen[0]).toBe(0);
      expect(dirty.has(0)).toBe(true);
    });
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

describe('applyAmbientGrowth — maturity ceiling and rate (Phase 4A, Decision 25/63)', () => {
  // A large infectionMult forces convergence within a reasonable test loop
  // — realistic rates take real-world minutes to approach the ceiling
  // (that's the game's actual pacing, correctly), which a unit test
  // shouldn't wait out. This is only testing the ceiling *clamp*, not
  // real-time pacing.
  const FAST = 500;

  it('virgin ground converges toward its own threshold-relative ceiling and never exceeds it, however many ticks run', () => {
    const grid = makeTestGrid(); // maturity stays 0 -- untouched
    const tower = makeTower();
    const i = 0; // outside the safe radius, so it's on the outer ramp
    for (let k = 0; k < 200; k++) {
      applyAmbientGrowth(grid, tower, FAST, 0.18, new Set());
    }
    const expected = growthCeiling(0, grid.threshold[i]!);
    expect(grid.growth[i]).toBeCloseTo(expected, 2);
    expect(grid.growth[i]).toBeLessThanOrEqual(expected + 1e-9);
  });

  it('fully mature ground converges all the way to full density', () => {
    const grid = makeTestGrid();
    grid.maturity[0] = MATURITY_MAX;
    const tower = makeTower();
    for (let k = 0; k < 200; k++) {
      applyAmbientGrowth(grid, tower, FAST, 0.18, new Set());
    }
    expect(grid.growth[0]).toBeCloseTo(growthCeiling(MATURITY_MAX, grid.threshold[0]!), 2);
  });

  it('always grows a cell past its own reveal threshold, at every threshold value grid.ts can produce — no cell is ever permanently invisible', () => {
    // The regression this guards: an absolute (threshold-blind) virgin
    // ceiling below grid.ts's 0.94 threshold cap left 22.3% of the real
    // arena unrevealable, since cellBucket renders nothing while
    // growth <= threshold. Found in the project owner's playtest ("top left
    // area all black, the slime never was there") and measured in-browser.
    const grid = makeTestGrid();
    // Span the full range grid.ts can actually produce.
    for (let i = 0; i < grid.size; i++) {
      grid.threshold[i] = 0.045 + (0.94 - 0.045) * (i / (grid.size - 1));
    }
    const tower = makeTower();
    for (let k = 0; k < 400; k++) {
      applyAmbientGrowth(grid, tower, FAST, 0.18, new Set());
    }
    // Scoped to cells outside the perimeter: inside it, growth is damped by
    // proximity and reaches exactly 0 at the tower's own radius, which is
    // deliberate (Decision 15) and unrelated to the ceiling.
    let checked = 0;
    let highestThresholdChecked = 0;
    for (let cy = 0; cy < grid.rows; cy++) {
      for (let cx = 0; cx < grid.cols; cx++) {
        const i = cy * grid.cols + cx;
        const wx = cx * grid.cellSize + grid.cellSize / 2;
        const wy = cy * grid.cellSize + grid.cellSize / 2;
        if (Math.hypot(wx - tower.x, wy - tower.y) < grid.perimeter) continue;
        expect(grid.growth[i]).toBeGreaterThan(grid.threshold[i]!);
        highestThresholdChecked = Math.max(highestThresholdChecked, grid.threshold[i]!);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50); // the sweep actually covered ground
    // And it reached the top of grid.ts's threshold range — the exact band
    // the old absolute ceiling made permanently invisible.
    expect(highestThresholdChecked).toBeGreaterThan(0.9);
  });

  it('never claws density back down to the ceiling — event-injected full-thickness slime survives (2026-08-07, Decision 63)', () => {
    // Infection Events inject past the ambient ceiling on purpose. If
    // ambient growth treated its ceiling as a target to converge *to*
    // rather than a cap on what it adds, every vein and bloom would be
    // silently undone a few ticks after it landed.
    const grid = makeTestGrid(); // virgin: maturity 0, so a sub-1 ceiling
    grid.threshold[0] = 0;
    grid.growth[0] = 1; // as an event would leave it
    const tower = makeTower();
    const dirty = new Set<number>();

    for (let k = 0; k < 100; k++) {
      applyAmbientGrowth(grid, tower, FAST, 0.18, dirty);
    }

    expect(grid.growth[0]).toBe(1); // untouched, not pulled down to the virgin ceiling
    expect(growthCeiling(0, 0)).toBeLessThan(1); // and the ceiling really is below it
  });

  it('regrows slower on mature ground than on virgin ground given the same starting density', () => {
    const virgin = makeTestGrid();
    virgin.growth[0] = 0.5;
    const mature = makeTestGrid();
    mature.growth[0] = 0.5;
    mature.maturity[0] = MATURITY_MAX;
    const tower = makeTower();

    applyAmbientGrowth(virgin, tower, 1, 0.18, new Set());
    applyAmbientGrowth(mature, tower, 1, 0.18, new Set());

    const virginGain = virgin.growth[0]! - 0.5;
    const matureGain = mature.growth[0]! - 0.5;
    expect(matureGain).toBeLessThan(virginGain);
  });
});

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S4): regrowth
// suppression — Frost's Rime and Immolation's Ash. Decayed in the same
// loop `frozen` already is, checked first so the common (unsuppressed)
// case pays only one array read.
describe('applyAmbientGrowth — regrowth suppression (Phase 6B-2)', () => {
  const FAST = 500; // same reasoning as the maturity describe block above — converge within a reasonable test loop

  it('grows slower on a suppressed cell than an identical unsuppressed one', () => {
    const suppressed = makeTestGrid();
    suppressed.growth[0] = 0.3;
    suppressed.regrowMult[0] = 0.3;
    suppressed.regrowTimer[0] = 3;
    const plain = makeTestGrid();
    plain.growth[0] = 0.3;
    const tower = makeTower();

    applyAmbientGrowth(suppressed, tower, FAST, 0.18, new Set());
    applyAmbientGrowth(plain, tower, FAST, 0.18, new Set());

    const suppressedGain = suppressed.growth[0]! - 0.3;
    const plainGain = plain.growth[0]! - 0.3;
    expect(suppressedGain).toBeLessThan(plainGain);
    expect(suppressedGain).toBeGreaterThan(0); // suppressed, not frozen — still grows, just slower
  });

  it('the timer decays alongside frozen’s own countdown', () => {
    const grid = makeTestGrid();
    grid.regrowMult[0] = 0.5;
    grid.regrowTimer[0] = 0.2;
    const tower = makeTower();

    applyAmbientGrowth(grid, tower, 1, 0.18, new Set());

    expect(grid.regrowTimer[0]).toBeCloseTo(0.02, 5);
  });

  it('growth returns to the normal rate once the timer lapses', () => {
    const wasSuppressed = makeTestGrid();
    wasSuppressed.growth[0] = 0.3;
    wasSuppressed.regrowMult[0] = 0.3;
    wasSuppressed.regrowTimer[0] = 0; // already lapsed
    const plain = makeTestGrid();
    plain.growth[0] = 0.3;
    const tower = makeTower();

    applyAmbientGrowth(wasSuppressed, tower, FAST, 0.18, new Set());
    applyAmbientGrowth(plain, tower, FAST, 0.18, new Set());

    expect(wasSuppressed.growth[0]).toBeCloseTo(plain.growth[0]!, 5);
  });
});

// Phase 6D-0 (docs/plans/phase-6d0-balance-shape.md S4, S7 tests 2-3): the
// aura weapons (Blades, Frost, Immolation) were parked at 100-115px, the
// one annulus the design guarantees is nearly empty — ambient growth's
// outside ramp is `((d - perimeter) / outerSpan)^0.6`, floored at
// CREEP_RAMP, so a radius barely past the perimeter sits right at that
// floor. This is the guard that would have caught the original bug:
// expressed against applyAmbientGrowth itself (the real ramp), not a
// hardcoded radius, so a later retune of PERIMETER or outerSpan can't
// silently re-park the aura weapons in vacuum.
describe('aura engagement — reach clears the vacuum annulus (Phase 6D-0)', () => {
  function makeArenaGrid(overrides: Partial<Grid> = {}): Grid {
    const size = 6400;
    return {
      cols: 80,
      rows: 80,
      size,
      cellSize: 10,
      vein: new Float32Array(size),
      threshold: new Float32Array(size),
      growth: new Float32Array(size),
      frozen: new Float32Array(size),
      bucket: new Int8Array(size),
      maturity: new Float32Array(size),
      matBucket: new Int8Array(size),
      regrowMult: new Float32Array(size),
      regrowTimer: new Float32Array(size),
      maxRange: 300,
      perimeter: 100,
      ...overrides,
    };
  }

  function cellAtRadius(grid: Grid, tower: Tower, radius: number): number {
    const cx = Math.round((tower.x + radius) / grid.cellSize);
    const cy = Math.round(tower.y / grid.cellSize);
    return cy * grid.cols + cx;
  }

  const AURAS: readonly { name: string; radius: (perimeter: number) => number }[] = [
    { name: 'Blades', radius: (perimeter) => bladeRadius(1, perimeter) },
    { name: 'Frost', radius: (perimeter) => frostRadius(1, perimeter) },
    { name: 'Immolation', radius: (perimeter) => immolationRadius(1, perimeter) },
  ];

  for (const aura of AURAS) {
    it(`${aura.name}'s level-1 radius sits where the ambient ramp exceeds the CREEP_RAMP floor, not right at it`, () => {
      const grid = makeArenaGrid();
      const tower: Tower = { x: 400, y: 400, radius: 22, hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10, shake: 0 };
      const radius = aura.radius(grid.perimeter);
      const i = cellAtRadius(grid, tower, radius);

      // A single tick's growth increment is directly proportional to the
      // local rate — comparing it to CREEP_RAMP's own increment isolates
      // the ramp shape from AMBIENT_BASE/infectionMult, which apply
      // identically everywhere.
      applyAmbientGrowth(grid, tower, 1, 0.18, new Set());
      const auraGain = grid.growth[i]!;

      const floorGrid = makeArenaGrid();
      const floorI = cellAtRadius(floorGrid, tower, grid.perimeter + 1); // right at the line — the old vacuum zone
      applyAmbientGrowth(floorGrid, tower, 1, 0.18, new Set());
      const floorGain = floorGrid.growth[floorI]!;

      expect(auraGain).toBeGreaterThan(floorGain * 1.5);
    });

    it(`${aura.name} actually reveals ground within the first 90 seconds — not the "does nothing at first" failure 6C-2 fixed once`, () => {
      const grid = makeArenaGrid();
      const tower: Tower = { x: 400, y: 400, radius: 22, hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10, shake: 0 };
      const radius = aura.radius(grid.perimeter);
      const i = cellAtRadius(grid, tower, radius);
      grid.threshold[i] = 0.12; // a representative mid-range reveal threshold (grid.ts's real range is ~0.045-0.94)

      const dt = 0.18;
      const ticks = Math.round(90 / dt);
      for (let k = 0; k < ticks; k++) {
        applyAmbientGrowth(grid, tower, 1, dt, new Set());
      }

      expect(grid.growth[i]).toBeGreaterThan(grid.threshold[i]!);
    });
  }

  it('CREEP_RAMP itself is still the floor value used at the boundary (sanity check on the constant, not a mechanism pin)', () => {
    expect(CREEP_RAMP).toBeGreaterThan(0);
    expect(CREEP_RAMP).toBeLessThan(1);
  });
});
