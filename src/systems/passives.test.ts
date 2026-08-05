import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { atkSpeedMult, damageMult, pickupMult, xpMult } from './passives';

describe('passive multipliers', () => {
  it('are 1x with no passives leveled', () => {
    const state = freshState();
    expect(damageMult(state)).toBe(1);
    expect(atkSpeedMult(state)).toBe(1);
    expect(pickupMult(state)).toBe(1);
    expect(xpMult(state)).toBe(1);
  });

  it('scale linearly per level', () => {
    const state = freshState();
    state.passives.damage = 3;
    state.passives.atkSpeed = 2;
    state.passives.pickup = 4;
    state.passives.xpGain = 5;
    expect(damageMult(state)).toBeCloseTo(1 + 3 * 0.1, 5);
    expect(atkSpeedMult(state)).toBeCloseTo(1 + 2 * 0.09, 5);
    expect(pickupMult(state)).toBeCloseTo(1 + 4 * 0.35, 5);
    expect(xpMult(state)).toBeCloseTo(1 + 5 * 0.14, 5);
  });
});
