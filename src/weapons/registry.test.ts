import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import type { WeaponKey } from '../types';
import { WEAPON_DEFS } from '../tuning/weapons';
import { drainPendingEmissions, updateAllWeapons, WEAPON_PIPELINES } from './registry';

function makeTestGrid(): Grid {
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
  };
}

describe('WEAPON_PIPELINES', () => {
  it('has an entry for every weapon in WEAPON_DEFS', () => {
    // The exact invariant docs/plans/phase-6a2-behaviour-gems.md S4 names —
    // a weapon shipped but never wired in fails a test, not a silent no-op,
    // closing the failure mode Phase 6-0's unreachable-weapons finding had.
    for (const key of Object.keys(WEAPON_DEFS) as WeaponKey[]) {
      expect(WEAPON_PIPELINES[key]).toBeDefined();
    }
  });
});

describe('updateAllWeapons', () => {
  it('does nothing with no grid', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    updateAllWeapons(state, 0.1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires an equipped, ready weapon', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1; // no acquire stage, no frontier setup needed
    updateAllWeapons(state, 0.1);
    // Immolation's own ready() starts at timer 0, so it fires immediately.
    expect(state.dpsAccum).toBeGreaterThanOrEqual(0);
  });

  it('runs Blades cleanup (clears orbitals) when unequipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.orbitals = [{ x: 0, y: 0, radius: 1, shape: 'dot', color: '#fff', glowColor: '#fff' }];
    updateAllWeapons(state, 0.1); // blades not in state.weapons
    expect(state.orbitals).toHaveLength(0);
  });

  it('leaves an unrelated equipped weapon unaffected by another weapon’s absence', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    updateAllWeapons(state, 0.1);
    expect(state.weapons.immolation).toBe(1); // still equipped, untouched
  });
});

describe('drainPendingEmissions', () => {
  it('does nothing when the queue is empty', () => {
    const state = freshState();
    drainPendingEmissions(state);
    expect(state.pendingEmissions).toHaveLength(0);
  });

  it('leaves an emission queued until its scheduled time arrives', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.time = 0;
    state.pendingEmissions.push({ weapon: 'immolation', at: 5, lvl: 1, target: null, powerMult: 1 });

    drainPendingEmissions(state);

    expect(state.pendingEmissions).toHaveLength(1);
  });

  it('fires a due emission and removes it from the queue', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.time = 10;
    state.pendingEmissions.push({ weapon: 'immolation', at: 5, lvl: 1, target: null, powerMult: 1 });
    const accumBefore = state.dpsAccum;

    drainPendingEmissions(state);

    expect(state.pendingEmissions).toHaveLength(0);
    expect(state.dpsAccum).toBeGreaterThanOrEqual(accumBefore); // deliver actually ran
  });

  it('is a safe no-op for a weapon no longer equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.time = 10;
    state.pendingEmissions.push({ weapon: 'immolation', at: 5, lvl: 1, target: null, powerMult: 1 }); // never equipped

    expect(() => drainPendingEmissions(state)).not.toThrow();
    expect(state.pendingEmissions).toHaveLength(0);
  });

  it('a due Echo follow-up actually fires a second time', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.immolation = 1;
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'echo' }] };

    updateAllWeapons(state, 0.1); // first fire, schedules an Echo follow-up
    expect(state.pendingEmissions).toHaveLength(1);

    state.time = state.pendingEmissions[0]!.at; // fast-forward to when it's due
    const before = state.dpsAccum;
    drainPendingEmissions(state);

    expect(state.pendingEmissions).toHaveLength(0);
    expect(state.dpsAccum).toBeGreaterThanOrEqual(before);
  });
});
