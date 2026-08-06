import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { bladeCount, bladeRadius } from '../tuning/weapons';
import { updateBladesWeapon } from './blades';

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
    maxRange: 300,
    perimeter: 20,
    ...overrides,
  };
}

describe('updateBladesWeapon', () => {
  it('clears orbitals and does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.orbitals = [{ x: 1, y: 1, radius: 10 }];
    updateBladesWeapon(state, 0.016);
    expect(state.orbitals).toHaveLength(0);
  });

  it('places one orbital per blade, orbiting the tower at bladeRadius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 3; // bladeCount(3) = 2

    updateBladesWeapon(state, 0.016);

    const expectedCount = bladeCount(3);
    expect(state.orbitals).toHaveLength(expectedCount);
    const expectedRadius = bladeRadius(3, state.grid.perimeter);
    for (const o of state.orbitals) {
      const d = Math.hypot(o.x - state.tower.x, o.y - state.tower.y);
      expect(d).toBeCloseTo(expectedRadius, 3);
    }
  });

  it('clears revealed density a blade passes over', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 1;
    state.time = 0;

    // At t=0 with 1 blade, spin=0 and angle=0, so the blade sits due
    // east of the tower at bladeRadius(1, perimeter).
    const radius = bladeRadius(1, state.grid.perimeter);
    const bx = state.tower.x + radius;
    const by = state.tower.y;
    const cx = Math.floor(bx / state.grid.cellSize);
    const cy = Math.floor(by / state.grid.cellSize);
    const idx = cy * state.grid.cols + cx;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.6;

    updateBladesWeapon(state, 0.016);

    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it("puts each blade slot on its own cooldown, not shared across slots", () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 1;
    state.time = 5;
    // Reveal the whole grid so the blade's cell (wherever it lands at
    // t=5) is guaranteed to trigger a hit.
    state.grid.threshold.fill(0);
    state.grid.growth.fill(0.5);

    updateBladesWeapon(state, 0.016);
    expect(state.bladeNextHit[0]).toBeCloseTo(5.22, 5);
    expect(state.bladeNextHit[1]).toBeUndefined();
  });

  it('never orbits closer than the safe radius, at any level', () => {
    // Regression guard for documented prototype bug #5: a tower-centered
    // weapon smaller than perimeter is aimed at guaranteed-near-empty
    // space. See docs/DECISIONS.md.
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.perimeter = 100;
    state.tower.x = 300;
    state.tower.y = 300;

    for (let lvl = 1; lvl <= 8; lvl++) {
      state.weapons.blades = lvl;
      updateBladesWeapon(state, 0.016);
      for (const o of state.orbitals) {
        const d = Math.hypot(o.x - state.tower.x, o.y - state.tower.y);
        expect(d).toBeGreaterThan(state.grid.perimeter);
      }
    }
  });
});
