import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import { applyAmbientGrowth } from './growth';
import { tickContactDamage } from './contact';

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
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
    maxRange: 300,
    perimeter: 100,
    ...overrides,
  };
}

function revealAt(grid: Grid, x: number, y: number, density: number): number {
  const { cx, cy } = worldToCell(grid, x, y);
  const i = gIdx(grid, cx, cy);
  grid.threshold[i] = 0.1;
  grid.growth[i] = density;
  return i;
}

// Fills the entire safe-zone disc with high revealed density so
// tickContactDamage always finds something, regardless of exactly which
// cells its weighting favors.
function fillSafeZoneDisc(grid: Grid, towerX: number, towerY: number, density: number): void {
  const radiusCells = Math.ceil(grid.perimeter / grid.cellSize);
  const { cx: tcx, cy: tcy } = worldToCell(grid, towerX, towerY);
  for (let oy = -radiusCells; oy <= radiusCells; oy++) {
    for (let ox = -radiusCells; ox <= radiusCells; ox++) {
      const cx = tcx + ox;
      const cy = tcy + oy;
      if (cx < 0 || cx >= grid.cols || cy < 0 || cy >= grid.rows) continue;
      const wx = cx * grid.cellSize + grid.cellSize / 2;
      const wy = cy * grid.cellSize + grid.cellSize / 2;
      if (Math.hypot(wx - towerX, wy - towerY) > grid.perimeter) continue;
      const i = gIdx(grid, cx, cy);
      grid.threshold[i] = 0.1;
      grid.growth[i] = density;
    }
  }
}

describe('tickContactDamage', () => {
  it('does no damage when the safe zone is entirely clear', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBe(0);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('damages the core when revealed density sits inside the safe zone', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    fillSafeZoneDisc(state.grid, state.tower.x, state.tower.y, 0.9);

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBeGreaterThan(0);
    expect(state.tower.hp).toBeLessThan(state.tower.maxHp);
  });

  it('weighs density near the core more heavily than density near the line (depth-aware)', () => {
    const nearCore = freshState();
    nearCore.grid = makeTestGrid();
    nearCore.tower.x = 300;
    nearCore.tower.y = 300;
    revealAt(nearCore.grid, nearCore.tower.x + 10, nearCore.tower.y, 0.9);
    tickContactDamage(nearCore, 1);

    const nearLine = freshState();
    nearLine.grid = makeTestGrid();
    nearLine.tower.x = 300;
    nearLine.tower.y = 300;
    revealAt(nearLine.grid, nearLine.tower.x + nearLine.grid.perimeter - 10, nearLine.tower.y, 0.9);
    tickContactDamage(nearLine, 1);

    expect(nearCore.contactPressure).toBeGreaterThan(nearLine.contactPressure);
  });

  it('gates on revealed density, never raw density below its threshold', () => {
    // Regression guard for the (unaffected) other half of documented bug
    // #2: raw density can cross the damage floor before a cell
    // individually crosses its own reveal threshold, which drained hp
    // with no visible slime on screen.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const { cx, cy } = worldToCell(state.grid, state.tower.x + 10, state.tower.y);
    const i = gIdx(state.grid, cx, cy);
    state.grid.threshold[i] = 0.9; // high threshold — not revealed yet
    state.grid.growth[i] = 0.5; // well above the contact floor, but still unrevealed

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBe(0);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('deals identical damage regardless of tierIndex — contact no longer scales on a timer', () => {
    // Decision 24, 2026-08-06: the field is "the clock, not the
    // executioner"; contact damage escalates via arrival splatter (Rule
    // 3), not a per-tier multiplier. tierIndex is flavour-only now.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    fillSafeZoneDisc(state.grid, state.tower.x, state.tower.y, 0.9);
    state.tierIndex = 4; // Apocalypse — presentation only, must not affect damage

    tickContactDamage(state, 1);
    const laterTierDamage = state.tower.maxHp - state.tower.hp;

    const baseline = freshState();
    baseline.grid = makeTestGrid();
    baseline.tower.x = 300;
    baseline.tower.y = 300;
    fillSafeZoneDisc(baseline.grid, baseline.tower.x, baseline.tower.y, 0.9);

    tickContactDamage(baseline, 1);
    const baselineDamage = baseline.tower.maxHp - baseline.tower.hp;

    expect(laterTierDamage).toBeCloseTo(baselineDamage, 10);
  });
});

describe('tickContactDamage — outcome guard for superseded bug #2', () => {
  // Bug #2 originally required sampling exactly at the safe-zone ring,
  // never closer, because growth was hard-gated to zero inside it —
  // sampling closer meant sampling guaranteed-empty space and the core
  // was structurally unkillable. Decision 15 removes that gate on
  // purpose and decision 18 replaces the ring sample with the
  // depth-weighted disc average above, so the *mechanism* bug #2
  // guarded no longer applies. This guards the actual invariant instead,
  // by running the real growth+damage simulation rather than asserting
  // how/where the sample is taken: an undefended core in a dirty zone
  // must be killable, and a core kept clean must take no damage,
  // regardless of the exact sampling method. See docs/DECISIONS.md #20.
  const BASELINE_INFECTION_MULT = 1;

  it('an undefended core eventually dies when the safe zone is left dirty', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.threshold.fill(0); // reveals the instant any growth accumulates
    state.tower.x = 300;
    state.tower.y = 300;

    // Current tuning kills the core in ~520 ticks; this budget keeps a
    // ~10x margin so the test tolerates reasonable balance-pass retuning
    // without needing recalibration.
    const MAX_TICKS = 5000;
    let ticks = 0;
    while (state.tower.hp > 0 && ticks < MAX_TICKS) {
      applyAmbientGrowth(state.grid, state.tower, BASELINE_INFECTION_MULT, 0.18, state.dirty);
      tickContactDamage(state, 0.18);
      ticks++;
    }

    expect(state.tower.hp).toBe(0);
    expect(ticks).toBeLessThan(MAX_TICKS);
  });

  it('a core in a permanently scrubbed-clean zone takes no damage, however long the sim runs', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.threshold.fill(0);
    state.tower.x = 300;
    state.tower.y = 300;
    const radiusCells = Math.ceil(state.grid.perimeter / state.grid.cellSize) + 1;
    const { cx: tcx, cy: tcy } = worldToCell(state.grid, state.tower.x, state.tower.y);

    for (let i = 0; i < 3000; i++) {
      // Growth genuinely ticks (so the field could fill in), but the
      // safe zone is scrubbed clean before contact damage samples it —
      // the scenario a working defense actually produces.
      applyAmbientGrowth(state.grid, state.tower, BASELINE_INFECTION_MULT, 0.18, state.dirty);
      for (let oy = -radiusCells; oy <= radiusCells; oy++) {
        const cy = tcy + oy;
        if (cy < 0 || cy >= state.grid.rows) continue;
        for (let ox = -radiusCells; ox <= radiusCells; ox++) {
          const cx = tcx + ox;
          if (cx < 0 || cx >= state.grid.cols) continue;
          state.grid.growth[cy * state.grid.cols + cx] = 0;
        }
      }
      tickContactDamage(state, 0.18);
    }

    expect(state.tower.hp).toBe(state.tower.maxHp);
  });
});
