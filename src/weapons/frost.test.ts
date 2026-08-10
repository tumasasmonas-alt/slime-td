import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
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
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
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
    expect(state.novaFx).toHaveLength(0);
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
    expect(state.novaFx).toEqual([
      {
        x: 500,
        y: 500,
        radius: frostRadius(1, state.grid.perimeter),
        life: 0.4,
        maxLife: 0.4,
        color: '#bfe9ff',
      },
    ]);
    expect(state.weaponTimers.frost).toBeGreaterThan(0);
  });

  it('does not pulse again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.frost = 1;

    updateFrostWeapon(state, 0.016);
    state.novaFx = []; // clear so we can tell if a second pulse fires
    updateFrostWeapon(state, 0.016);

    expect(state.novaFx).toHaveLength(0);
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

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): Homing's pulse
  // reading — the pulse's centre offsets toward the nearest threat.
  it('Homing offsets the pulse away from dead-centre when a threat exists', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'homing' }] };
    const idx = 50 * state.grid.cols + 55; // east of the tower — the only revealed cell, so it's the nearest threat
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;
    computeFrontier(state);

    updateFrostWeapon(state, 0.016);

    expect(state.novaFx).toHaveLength(1);
    expect(state.novaFx[0]!.x).toBeGreaterThan(500); // offset toward the threat, east
  });

  it('without Homing, the pulse stays centred on the tower even with a threat nearby', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    const idx = 50 * state.grid.cols + 55;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;
    computeFrontier(state);

    updateFrostWeapon(state, 0.016);

    expect(state.novaFx[0]!.x).toBe(500);
    expect(state.novaFx[0]!.y).toBe(500);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S2-S4): Frost's
  // four extensions.
  describe('extensions', () => {
    it('Chill Field extends the freeze duration past the base pulse’s own', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'chillField', level: 3 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      // Adds to the base 2.0s rather than taking a max with it — a max()
      // would make this extension a silent no-op, since the base already
      // exceeds every one of Chill Field's own 0.4-0.8s values.
      expect(state.grid.frozen[idx]).toBeCloseTo(2.0 + 0.8, 5);
    });

    it('Shatter Core chills a coagulant it hits, and a later hit deals the shatter bonus', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'shatterCore', level: 3 }], gems: [] };
      const c = {
        x: 500,
        y: 500,
        mass: 1000,
        armor: 0,
        kind: 'congealer' as const,
        radius: 15,
        speed: 45,
        phase: 'active' as const,
        phaseTimer: 0,
        seeds: [],
        splitAtMass: 0,
        sourceMaturity: 0,
        parts: [],
        startMass: 1000,
        lastHitAt: -Infinity,
        chilledUntil: 0,
        armorDebuff: 0,
        armorDebuffUntil: 0,
      };
      state.coagulants = [c];

      updateFrostWeapon(state, 0.016); // first pulse — chills it, per S2's ordering rule doesn't benefit itself

      expect(c.chilledUntil).toBeGreaterThan(state.time);
      const afterFirst = c.mass;

      state.weaponTimers.frost = 0; // force it ready again
      updateFrostWeapon(state, 0.016); // second pulse — hits an already-chilled coagulant
      const secondRemoved = afterFirst - c.mass;

      // Control: an identical coagulant, hit once from full mass with no
      // prior chill — the shattered hit should remove more.
      const control = freshState();
      control.grid = makeTestGrid();
      control.tower.x = 500;
      control.tower.y = 500;
      control.weapons.frost = 1;
      const cControl = { ...c, mass: afterFirst, chilledUntil: 0 };
      control.coagulants = [cControl];
      updateFrostWeapon(control, 0.016);
      const controlRemoved = afterFirst - cControl.mass;

      expect(secondRemoved).toBeGreaterThan(controlRemoved);
    });

    it('Rime sets suppressRegrowth on its clearAt call, read back on the grid', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'rime', level: 2 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      expect(state.grid.regrowMult[idx]).toBeCloseTo(0.35, 5); // RIME_MULT level 2
      expect(state.grid.regrowTimer[idx]).toBeCloseTo(3.0, 5); // RIME_SECONDS
    });

    it('Freeze Duration extends the base freeze (mods channel)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'frostDuration', level: 3 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      expect(state.grid.frozen[idx]).toBeCloseTo(2.0 * 1.75, 5); // FREEZE_DURATION * (1 + 0.75)
    });
  });
});
