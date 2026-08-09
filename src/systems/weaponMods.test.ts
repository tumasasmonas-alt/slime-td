import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { weaponMods } from './weaponMods';

describe('weaponMods', () => {
  it('is identity (all 1) for a weapon with no sockets at all', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(weaponMods(state, 'bolt')).toEqual({ damage: 1, rate: 1, area: 1, duration: 1, velocity: 1 });
  });

  it('is identity for a weapon with sockets but no gems', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [{ kind: 'placeholder', level: 1 }], gems: [] };
    expect(weaponMods(state, 'bolt')).toEqual({ damage: 1, rate: 1, area: 1, duration: 1, velocity: 1 });
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
