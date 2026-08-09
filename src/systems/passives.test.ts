import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { armorMult, pickupMult, xpMult } from './passives';

// Phase 6A-1: damageMult()/atkSpeedMult() are deleted along with the
// global damage/atkSpeed passives they read — see systems/weaponMods.ts
// for their per-weapon replacement.
describe('passive multipliers', () => {
  it('are 1x (or 0 reduction) with no passives leveled', () => {
    const state = freshState();
    expect(pickupMult(state)).toBe(1);
    expect(xpMult(state)).toBe(1);
    expect(armorMult(state)).toBe(1);
  });

  it('scale linearly per level', () => {
    const state = freshState();
    state.passives.pickup = 4;
    state.passives.xpGain = 5;
    state.passives.armor = 3;
    expect(pickupMult(state)).toBeCloseTo(1 + 4 * 0.35, 5);
    expect(xpMult(state)).toBeCloseTo(1 + 5 * 0.14, 5);
    expect(armorMult(state)).toBeCloseTo(1 - 3 * 0.07, 5);
  });

  it('caps armor reduction so it can never reach full immunity', () => {
    const state = freshState();
    state.passives.armor = 6; // maxLevel, 6*0.07 = 0.42, well under the 0.55 cap
    expect(armorMult(state)).toBeCloseTo(1 - 0.42, 5);

    state.passives.armor = 20; // hypothetically far past maxLevel
    expect(armorMult(state)).toBeCloseTo(1 - 0.55, 5);
  });
});
