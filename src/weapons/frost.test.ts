import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { frostRadius } from '../tuning/weapons';
import { updateFrostWeapon } from './frost';

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 10000;
  return {
    cols: 100,
    rows: 100,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    maxRange: 800,
    perimeter: 50,
    ...overrides,
  };
}

describe('updateFrostWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateFrostWeapon(state, 1);
    expect(state.novaFx).toBeNull();
  });

  it('pulses on its first call — the timer starts at 0', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    const idx = 50 * state.grid.cols + 51; // just east of the tower
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;

    updateFrostWeapon(state, 0.016);

    expect(state.grid.growth[idx]).toBeLessThan(0.5);
    expect(state.grid.frozen[idx]).toBe(2.0);
    expect(state.novaFx).toEqual({
      x: 500,
      y: 500,
      radius: frostRadius(1, state.grid.perimeter),
      life: 0.4,
      maxLife: 0.4,
    });
    expect(state.weaponTimers.frost).toBeGreaterThan(0);
  });

  it('does not pulse again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.frost = 1;

    updateFrostWeapon(state, 0.016);
    state.novaFx = null; // clear so we can tell if a second pulse fires
    updateFrostWeapon(state, 0.016);

    expect(state.novaFx).toBeNull();
  });

  it('never pulses closer than the safe radius, at any level', () => {
    // Regression guard for documented prototype bug #5.
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.perimeter = 200;

    for (let lvl = 1; lvl <= 8; lvl++) {
      expect(frostRadius(lvl, state.grid.perimeter)).toBeGreaterThan(state.grid.perimeter);
    }
  });
});
