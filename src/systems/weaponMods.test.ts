import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { weaponMods } from './weaponMods';

describe('weaponMods', () => {
  it('is identity (all 1) for a weapon with no sockets at all', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(weaponMods(state, 'bolt')).toEqual({ damage: 1, rate: 1, area: 1, duration: 1, velocity: 1 });
  });

  // twinBarrel carries no `mods` — a purely behavioural extension
  // (weapons/bolt.ts reads its level directly), so a weapon holding only
  // this one should still read as pure identity.
  it('is identity for a weapon with a behaviour-only extension socketed', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'twinBarrel', level: 1 }], gems: [] };
    expect(weaponMods(state, 'bolt')).toEqual({ damage: 1, rate: 1, area: 1, duration: 1, velocity: 1 });
  });

  // Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S5.2): the
  // load-bearing change — a mods-bearing extension (Heavy Slug) folds
  // into weaponMods() exactly like an Amplifier gem's delta does, with no
  // separate read path for callers.
  it('folds a mods-bearing extension in additively, same as a gem', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], gems: [] };
    const mods = weaponMods(state, 'bolt');
    expect(mods.damage).toBeCloseTo(1.45, 5);
    expect(mods.rate).toBeCloseTo(0.75, 5);
  });

  // Extension and gem deltas combine additively on the same field, same
  // as two gems already do (the "combines two different gems" case above).
  it('combines an extension and a gem additively on the same field', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = {
      extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], // +0.45 damage
      gems: [{ id: 2, kind: 'amplifier' }], // +0.45 damage
    };
    expect(weaponMods(state, 'bolt').damage).toBeCloseTo(1 + 0.45 + 0.45, 5);
  });

  it('applies a single gem’s delta additively over 1', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(weaponMods(state, 'bolt').damage).toBeCloseTo(1.45, 5);
  });

  it('combines two different gems additively on the same field', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = {
      extensions: [],
      gems: [
        { id: 1, kind: 'amplifier' }, // +0.45 damage
        { id: 2, kind: 'attunement' }, // +0.03*points damage
      ],
    };
    // points = state.weapons.bolt = 1 -> attunement contributes 0.03
    expect(weaponMods(state, 'bolt').damage).toBeCloseTo(1 + 0.45 + 0.03, 5);
  });

  it('a gem socketed in one weapon never affects a different weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weapons.chain = 1;
    state.weaponSockets.chain = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(weaponMods(state, 'bolt').damage).toBe(1);
    expect(weaponMods(state, 'chain').damage).toBeCloseTo(1.45, 5);
  });

  it('Attunement scales with enhancement points invested in that weapon', () => {
    const state = freshState();
    state.weapons.bolt = 15;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'attunement' }] };
    expect(weaponMods(state, 'bolt').damage).toBeCloseTo(1 + 15 * 0.03, 5);
  });

  it('Overclock affects rate only, never damage', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'overclock' }] };
    const mods = weaponMods(state, 'bolt');
    expect(mods.rate).toBeCloseTo(1.4, 5);
    expect(mods.damage).toBe(1);
  });

  it('Expansion affects area only', () => {
    const state = freshState();
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'expansion' }] };
    const mods = weaponMods(state, 'frost');
    expect(mods.area).toBeCloseTo(1.3, 5);
    expect(mods.damage).toBe(1);
    expect(mods.rate).toBe(1);
  });

  it('Velocity affects velocity only', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'velocity' }] };
    expect(weaponMods(state, 'bolt').velocity).toBeCloseTo(1.35, 5);
  });

  it('Extension affects duration only', () => {
    const state = freshState();
    state.weapons.poison = 1;
    state.weaponSockets.poison = { extensions: [], gems: [{ id: 1, kind: 'extension' }] };
    expect(weaponMods(state, 'poison').duration).toBeCloseTo(1.4, 5);
  });
});
