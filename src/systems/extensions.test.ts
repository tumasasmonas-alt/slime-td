import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { extensionLevel, extensionMods } from './extensions';

describe('extensionLevel', () => {
  it('is 0 when nothing of that kind is socketed in this weapon', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    expect(extensionLevel(state, 'bolt', 'heavySlug')).toBe(0);
  });

  it('reads the level of a socketed extension', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 2 }], gems: [] };
    expect(extensionLevel(state, 'bolt', 'heavySlug')).toBe(2);
  });

  // A banked-but-unsocketed extension has no effect — the same rule a
  // banked gem already follows (weaponMods only reads sockets).
  it('is 0 for an extension sitting in extensionInventory, not socketed', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.extensionInventory = [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 3 }];
    expect(extensionLevel(state, 'bolt', 'heavySlug')).toBe(0);
  });

  it('never reads a different weapon’s socketed extension', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weapons.chain = 6;
    state.weaponSockets.chain = { extensions: [{ id: 1, weaponKey: 'chain', kind: 'staticBuildup', level: 1 }], gems: [] };
    expect(extensionLevel(state, 'bolt', 'staticBuildup' as never)).toBe(0);
  });
});

describe('extensionMods', () => {
  it('is empty (all zero) with no extensions socketed', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    expect(extensionMods(state, 'bolt')).toEqual({});
  });

  it('sums a mods-bearing extension’s delta', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], gems: [] };
    const mods = extensionMods(state, 'bolt');
    expect(mods.damage).toBeCloseTo(0.45, 5);
    expect(mods.rate).toBeCloseTo(-0.25, 5);
  });

  it('ignores a behaviour-only extension (no `mods` def)', () => {
    const state = freshState();
    state.weapons.bolt = 6;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'twinBarrel', level: 1 }], gems: [] };
    expect(extensionMods(state, 'bolt')).toEqual({ damage: 0, rate: 0, area: 0, duration: 0, velocity: 0 });
  });
});
