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

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md's Immolation note,
  // tuning/weapons.ts's IMMOLATION_TICK comment): this used to pin the
  // OPPOSITE of what it asserts now. Ward Pulse never divided by the old
  // GLOBAL atkSpeedMult passive, which was a real, flagged balance gap.
  // That passive is gone; Immolation is now built on the same
  // cooldownReady()/weaponMods() every other weapon uses, and Overclock is
  // a per-weapon gem instead of a whole-game multiplier. Responding to a
  // gem explicitly socketed into THIS weapon is correct, not a regression
  // of the old gap — see BACKLOG.md.
  it('responds to an Overclock gem socketed into it, unlike the old global atkSpeed passive it used to ignore', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'overclock' }] };

    updateImmolationWeapon(state, 0.1);

    // IMMOLATION_TICK / (1 + 0.4) — Overclock's +40% rate delta
    expect(state.weaponTimers.immolation).toBeCloseTo(1.1 / 1.4, 5);
  });

  it('an Amplifier gem socketed into it scales its damage', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    state.tower.x = 100;
    state.tower.y = 100;
    const i = 10 * state.grid.cols + 10;
    state.grid.growth[i] = 0.9;

    const stateNoGem = freshState();
    stateNoGem.grid = makeTestGrid();
    stateNoGem.weapons.immolation = 1;
    stateNoGem.tower.x = 100;
    stateNoGem.tower.y = 100;
    stateNoGem.grid.growth[i] = 0.9;

    updateImmolationWeapon(state, 0.1);
    updateImmolationWeapon(stateNoGem, 0.1);

    // Amplified damage clears strictly more density than the un-amplified run.
    expect(state.grid.growth[i]!).toBeLessThan(stateNoGem.grid.growth[i]!);
  });
});
