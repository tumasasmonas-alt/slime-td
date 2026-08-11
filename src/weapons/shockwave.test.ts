import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { updateShockwaveWeapon } from './shockwave';

function makeTestGrid(): Grid {
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
    maxRange: 500,
    perimeter: 20,
  };
}

describe('updateShockwaveWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateShockwaveWeapon(state, 1);
    expect(state.shockwaveRings).toHaveLength(0);
  });

  it('fires a ring starting at the perimeter floor, centred on the tower', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.shockwave = 1;

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(1);
    const ring = state.shockwaveRings[0]!;
    expect(ring.x).toBe(300);
    expect(ring.y).toBe(300);
    expect(ring.startRadius).toBeGreaterThan(state.grid.perimeter); // floors above perimeter, not at it (S2.3's margin)
    expect(ring.maxRadius).toBeGreaterThan(ring.startRadius);
    expect(ring.inward).toBeFalsy();
    expect(state.weaponTimers.shockwave).toBeGreaterThan(0);
  });

  it('does not fire again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;

    updateShockwaveWeapon(state, 0.016);
    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(1);
  });

  // Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S5): Shockwave's
  // four extensions.
  describe('extensions', () => {
    it('Knockback sets kickback on the ring', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.shockwave = 1;
      state.weaponSockets.shockwave = { extensions: [{ id: 1, weaponKey: 'shockwave', kind: 'knockback', level: 2 }], gems: [] };

      updateShockwaveWeapon(state, 0.016);

      expect(state.shockwaveRings[0]!.kickback).toBe(32);
    });

    it('Resonant Ring sets densityScaled on the ring, measurably scaling damage against dense ground', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.shockwave = 1;
      state.weaponSockets.shockwave = { extensions: [{ id: 1, weaponKey: 'shockwave', kind: 'resonantRing', level: 3 }], gems: [] };

      updateShockwaveWeapon(state, 0.016);

      expect(state.shockwaveRings[0]!.densityScaled).toBe(0.9);
    });

    it('Implosion replaces the outward ring with an inward one starting at max reach', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.shockwave = 3;
      state.weaponSockets.shockwave = { extensions: [{ id: 1, weaponKey: 'shockwave', kind: 'implosion', level: 1 }], gems: [] };

      updateShockwaveWeapon(state, 0.016);

      const ring = state.shockwaveRings[0]!;
      expect(ring.inward).toBe(true);
      expect(ring.radius).toBe(ring.maxRadius); // starts at max reach, travels inward
    });

    it('Second Wave adds a follow-up ring scheduled later, at reduced power', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.weapons.shockwave = 1;
      state.weaponSockets.shockwave = { extensions: [{ id: 1, weaponKey: 'shockwave', kind: 'secondWave', level: 1 }], gems: [] };

      updateShockwaveWeapon(state, 0.016);

      expect(state.shockwaveRings).toHaveLength(2);
      const [first, second] = state.shockwaveRings;
      expect(second!.bornAt).toBeGreaterThan(first!.bornAt);
      expect(second!.power).toBeLessThan(first!.power);
    });
  });
});

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4, S7 test 1): Fork/
// Chaining/Bounce/Ricochet on Shockwave — used to be entirely dead on
// this weapon. Every one reuses Second Wave (extra delayed ring) or
// Implosion (`inward: true`)'s own machinery — see weapons/shockwave.ts's
// own comment for exactly how each differs.
describe('updateShockwaveWeapon — Fork/Chaining/Bounce/Ricochet (Phase 6D-3)', () => {
  it('with no gem, only the main outward ring fires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(1);
  });

  it('Fork adds a second outward ring, delayed and at reduced power', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;
    state.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'fork' }] };

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(2);
    const [main, fork] = state.shockwaveRings;
    expect(fork!.inward).toBeFalsy();
    expect(fork!.bornAt).toBeGreaterThan(main!.bornAt);
    expect(fork!.power).toBeLessThan(main!.power);
  });

  it('Chaining adds a delayed ring at double the max radius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;
    state.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'chaining' }] };

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(2);
    const [main, chained] = state.shockwaveRings;
    expect(chained!.maxRadius).toBeCloseTo(main!.maxRadius * 2, 5);
    expect(chained!.bornAt).toBeGreaterThan(main!.bornAt);
  });

  it('Bounce adds an inward ring travelling alongside the outward one, at the same bornAt', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;
    state.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'bounce' }] };

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(2);
    const [main, bounce] = state.shockwaveRings;
    expect(bounce!.inward).toBe(true);
    expect(bounce!.bornAt).toBe(main!.bornAt); // simultaneous, not delayed
  });

  it('Ricochet adds an inward ring that starts only once the outward one would reach max radius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.shockwave = 1;
    state.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'ricochet' }] };

    updateShockwaveWeapon(state, 0.016);

    expect(state.shockwaveRings).toHaveLength(2);
    const [main, ricochet] = state.shockwaveRings;
    expect(ricochet!.inward).toBe(true);
    expect(ricochet!.bornAt).toBeGreaterThan(main!.bornAt); // sequential — after, not alongside
  });

  it('Bounce and Ricochet both add an inward ring, but at different bornAt times — distinct readings, not duplicates', () => {
    const withBounce = freshState();
    withBounce.grid = makeTestGrid();
    withBounce.weapons.shockwave = 1;
    withBounce.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'bounce' }] };
    updateShockwaveWeapon(withBounce, 0.016);

    const withRicochet = freshState();
    withRicochet.grid = makeTestGrid();
    withRicochet.weapons.shockwave = 1;
    withRicochet.weaponSockets.shockwave = { extensions: [], gems: [{ id: 1, kind: 'ricochet' }] };
    updateShockwaveWeapon(withRicochet, 0.016);

    expect(withRicochet.shockwaveRings[1]!.bornAt).toBeGreaterThan(withBounce.shockwaveRings[1]!.bornAt);
  });
});
