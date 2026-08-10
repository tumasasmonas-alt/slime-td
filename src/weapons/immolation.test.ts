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
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
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
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
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

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S5): Immolation's
  // four extensions. Second Ring and Flare both go OUTWARD (S1's rule —
  // every tower-centred radius floors at `perimeter`, so an inward second
  // ring sweeps the safe zone and hits nothing).
  describe('extensions', () => {
    it('Backdraft scales damage up with the density currently crossing the ring', () => {
      const dense = freshState();
      dense.grid = makeTestGrid();
      dense.weapons.immolation = 1;
      dense.weaponSockets.immolation = { extensions: [{ id: 1, weaponKey: 'immolation', kind: 'backdraft', level: 3 }], gems: [] };
      dense.tower.x = 100;
      dense.tower.y = 100;
      // Fill the whole grid dense — the ring's own sample points all read high density.
      dense.grid.growth.fill(0.9);
      const i = 10 * dense.grid.cols + 10;

      const sparse = freshState();
      sparse.grid = makeTestGrid();
      sparse.weapons.immolation = 1;
      sparse.weaponSockets.immolation = { extensions: [{ id: 1, weaponKey: 'immolation', kind: 'backdraft', level: 3 }], gems: [] };
      sparse.tower.x = 100;
      sparse.tower.y = 100;
      sparse.grid.growth[i] = 0.9; // only the tower's own cell has anything

      updateImmolationWeapon(dense, 0.1);
      updateImmolationWeapon(sparse, 0.1);

      // Denser surroundings -> a bigger Backdraft multiplier -> more
      // cleared at the tower's own cell.
      expect(dense.grid.growth[i]!).toBeLessThan(sparse.grid.growth[i]!);
    });

    it('Second Ring adds a second, OUTWARD purge at 1.4x radius', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.immolation = 1;
      state.weaponSockets.immolation = { extensions: [{ id: 1, weaponKey: 'immolation', kind: 'secondRing', level: 1 }], gems: [] };
      state.tower.x = 100;
      state.tower.y = 100;
      // A cell well outside the base ring but inside 1.4x it.
      const baseRadius = 66 + (0) * 6; // IMMOLATION_REACH base at level 1 (perimeter=20 doesn't dominate: margin+perimeter=30 < 66)
      const cx = Math.floor((state.tower.x + baseRadius * 1.2) / state.grid.cellSize);
      const cy = Math.floor(state.tower.y / state.grid.cellSize);
      const i = cy * state.grid.cols + cx;
      state.grid.growth[i] = 0.9;

      updateImmolationWeapon(state, 0.1);

      expect(state.grid.growth[i]).toBeLessThan(0.9);
    });

    it('Flare fires an extra pulse every 4th tick', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.immolation = 1;
      state.weaponSockets.immolation = { extensions: [{ id: 1, weaponKey: 'immolation', kind: 'flare', level: 3 }], gems: [] };
      state.tower.x = 100;
      state.tower.y = 100;
      // Well outside the base ring but inside its 1.8x Flare radius.
      const cx = Math.floor((state.tower.x + 66 * 1.5) / state.grid.cellSize);
      const cy = Math.floor(state.tower.y / state.grid.cellSize);
      const i = cy * state.grid.cols + cx;
      state.grid.growth[i] = 0.9;

      for (let tick = 1; tick <= 3; tick++) {
        state.weaponTimers.immolation = 0;
        updateImmolationWeapon(state, 0.1);
      }
      const beforeFlare = state.grid.growth[i]!;
      expect(beforeFlare).toBeCloseTo(0.9, 3); // the base ring barely reaches this cell, if at all

      state.weaponTimers.immolation = 0;
      updateImmolationWeapon(state, 0.1); // the 4th tick — Flare fires

      expect(state.grid.growth[i]!).toBeLessThan(beforeFlare);
    });

    it('Ash sets suppressRegrowth on the burned cell', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.immolation = 1;
      state.weaponSockets.immolation = { extensions: [{ id: 1, weaponKey: 'immolation', kind: 'ash', level: 2 }], gems: [] };
      state.tower.x = 100;
      state.tower.y = 100;
      const i = 10 * state.grid.cols + 10;
      state.grid.growth[i] = 0.9;

      updateImmolationWeapon(state, 0.1);

      expect(state.grid.regrowMult[i]).toBeCloseTo(0.45, 5); // ASH_MULT level 2
      expect(state.grid.regrowTimer[i]).toBeCloseTo(2.0, 5); // ASH_SECONDS
    });
  });
});
