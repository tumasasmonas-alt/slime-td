import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { updateImmolationWeapon } from './immolation';

function makeTestGrid(): Grid {
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
    maxRange: 300,
    perimeter: 20,
  };
}

describe('updateImmolationWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.growth[0] = 0.5;
    updateImmolationWeapon(state, 5);
    expect(state.grid.growth[0]).toBe(0.5);
  });

  it('purges density right at the core once leveled, then waits out its own interval', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.tower.x = 100;
    state.tower.y = 100;
    const i = 10 * state.grid.cols + 10; // the cell the tower sits in
    state.grid.growth[i] = 0.5;

    // weaponTimers.immolation starts at 0, so the very first call always fires.
    updateImmolationWeapon(state, 0.1);
    const afterFirstPulse = state.grid.growth[i]!;
    expect(afterFirstPulse).toBeLessThan(0.5);

    // Nowhere near the freshly-reset 1.1s interval — no second pulse yet.
    updateImmolationWeapon(state, 0.1);
    expect(state.grid.growth[i]).toBe(afterFirstPulse);
  });

  it('reaches past a large safe radius rather than staying capped at its base formula', () => {
    // Confirmed decision 16: radius floors at perimeter + margin, so
    // Immolation Ring can't end up smaller than the zone it's meant to purge.
    const size = 2500;
    const grid: Grid = {
      cols: 50,
      rows: 50,
      size,
      cellSize: 10,
      vein: new Float32Array(size),
      threshold: new Float32Array(size),
      growth: new Float32Array(size),
      frozen: new Float32Array(size),
      bucket: new Int8Array(size),
      maturity: new Float32Array(size),
      matBucket: new Int8Array(size),
      maxRange: 500,
      perimeter: 200, // larger than the base+perLevel formula alone would give at level 1
    };
    const state = freshState();
    state.grid = grid;
    state.weapons.immolation = 1;
    state.tower.x = 250;
    state.tower.y = 250;
    // A cell 150px east — inside the 200px safe radius, but well outside
    // the old flat `60 + lvl*6 = 66` formula.
    const cx = Math.floor((state.tower.x + 150) / grid.cellSize);
    const cy = Math.floor(state.tower.y / grid.cellSize);
    const i = cy * grid.cols + cx;
    grid.growth[i] = 0.5;

    updateImmolationWeapon(state, 0.1);

    expect(grid.growth[i]).toBeLessThan(0.5);
  });

  it("does not respond to Overclock (atkSpeed) — matches Ward Pulse's prior behaviour, flagged as a discovered gap", () => {
    // Discovered during Phase 5A (docs/plans/phase-5-6-arsenal.md S12.6):
    // Ward Pulse's tick never divided by atkSpeedMult, unlike every
    // cooldown-based weapon built on pipeline.ts's cooldownReady().
    // Preserved deliberately rather than silently granted a new passive
    // interaction — this test pins that decision so it isn't undone by
    // accident in a later refactor.
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.passives.atkSpeed = 8; // would cut the interval roughly in half if respected

    updateImmolationWeapon(state, 0.1);
    expect(state.weaponTimers.immolation).toBeCloseTo(1.1, 5);
  });
});
