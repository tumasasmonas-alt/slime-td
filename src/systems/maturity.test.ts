import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import type { Grid } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, worldToCell } from '../grid/grid';
import { AGE_CEILING, ageFloorAt, maturityBucket } from '../tuning/maturity';
import { updateMaturity } from './maturity';

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

describe('updateMaturity', () => {
  it('does nothing without a grid', () => {
    const state = freshState();
    updateMaturity(state, 0.1); // must not throw
  });

  it('decays a scarred cell toward the age floor', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.time = 0; // floor is 0 at t=0
    state.grid.maturity[0] = 0.5;

    updateMaturity(state, 0.1);

    expect(state.grid.maturity[0]).toBeLessThan(0.5);
    expect(state.grid.maturity[0]).toBeGreaterThanOrEqual(0);
  });

  it('never decays a cell below the current age floor', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.time = 10_000; // floor is pinned at AGE_CEILING by now
    state.grid.maturity[0] = AGE_CEILING; // already sitting at the floor

    updateMaturity(state, 5); // a big dt — decay alone would drive it well below

    expect(state.grid.maturity[0]).toBeCloseTo(AGE_CEILING, 5);
  });

  it('raises a virgin cell up to the age floor — the slow global age drift', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.time = 60_000; // well past a minute of "elapsed run time"
    state.grid.maturity[0] = 0; // never touched

    updateMaturity(state, 0.1);

    const floor = ageFloorAt(state.time);
    expect(floor).toBeGreaterThan(0);
    expect(state.grid.maturity[0]).toBeCloseTo(floor, 5);
  });

  it('marks a cell dirty only when its quantized bucket actually changes', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.time = 0;
    // Set maturity and matBucket consistent with each other, then decay by
    // an amount too small to cross into the next bucket down.
    state.grid.maturity[0] = 0.9;
    state.grid.matBucket[0] = maturityBucket(0.9, ageFloorAt(state.time));

    updateMaturity(state, 0.001); // tiny dt -> tiny decay step

    expect(state.dirty.has(0)).toBe(false);

    // A large dt drives it across a bucket boundary.
    updateMaturity(state, 1000);
    expect(state.dirty.has(0)).toBe(true);
    expect(state.grid.matBucket[0]).toBe(maturityBucket(state.grid.maturity[0]!, ageFloorAt(state.time)));
  });
});

describe('the wilderness never calcifies (Phase 4A outcome test, Decision 25/63)', () => {
  // §7's core inversion, as a real-simulation outcome test rather than a
  // mechanism test — this is the one that would catch a regression back to
  // the design's original, wrong, age-based approach. A cell fought over
  // continuously must scar well past the global age ceiling; a cell the
  // player never reaches must not, however long the run goes.
  it('the kill zone scars well past AGE_CEILING while an untouched cell stays at or below it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const kill = worldToCell(state.grid, 25, 25);
    const killIdx = gIdx(state.grid, kill.cx, kill.cy);
    const wildIdx = gIdx(state.grid, 15, 15); // never touched by clearAt

    const dt = 0.18; // SIM_TICK
    for (let tick = 0; tick < 1000; tick++) {
      state.time += dt;
      // Simulate the player continuously fighting here: growth regenerates
      // (ambient growth isn't run in this test, so refill it directly),
      // the hit scars it, decay runs every tick regardless.
      state.grid.growth[killIdx] = 0.9;
      clearAt(state, 25, 25, 50, { radiusPx: 5 });
      updateMaturity(state, dt);
    }

    expect(state.grid.maturity[killIdx]).toBeGreaterThan(AGE_CEILING);
    expect(state.grid.maturity[wildIdx]).toBeLessThanOrEqual(AGE_CEILING);
  });

  it('accumulates through realistic gaps between hits, not just point-blank fire every single tick — regression guard for the balance bug found live 2026-08-07', () => {
    // The test above hits the same cell every tick, which can't distinguish
    // a working balance from a broken one: scar gain landing as often as
    // decay does will always win regardless of either rate. Real weapons
    // have cooldowns and a moving frontier, so any one cell gets gaps of
    // several ticks between hits. The original constants (SCAR_PER_DENSITY
    // 0.06, MATURITY_DECAY 0.01) passed the always-hit test above but
    // produced *zero* net scarring anywhere on the grid once realistic gaps
    // existed — confirmed live via the debug-harness methodology from
    // Decision 59, not caught by any unit test until this one. Decay's flat
    // per-tick rate simply outpaced sparse gains faster than combat could
    // ever build them up. Reproduces that gap pattern directly.
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 10 * state.grid.cols + 10; // world (105,105)
    const HIT_EVERY_N_TICKS = 8; // ~1.4s between hits — a plausible weapon cadence
    const dt = 0.18;
    for (let tick = 0; tick < 2000; tick++) {
      state.time += dt;
      if (tick % HIT_EVERY_N_TICKS === 0) {
        state.grid.growth[idx] = 0.9;
        clearAt(state, 105, 105, 50, { radiusPx: 5 });
      }
      updateMaturity(state, dt);
    }
    expect(state.grid.maturity[idx]).toBeGreaterThan(0.5);
  });
});
