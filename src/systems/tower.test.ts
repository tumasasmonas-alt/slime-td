import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { damageTower, updateTowerTick } from './tower';

describe('damageTower', () => {
  it('reduces hp by the damage amount', () => {
    const state = freshState();
    damageTower(state, 20);
    expect(state.tower.hp).toBe(80);
  });

  it('clamps hp at 0 rather than going negative', () => {
    const state = freshState();
    damageTower(state, 500);
    expect(state.tower.hp).toBe(0);
  });

  it('reduces incoming damage with Armor Plating leveled', () => {
    const withoutArmor = freshState();
    damageTower(withoutArmor, 20);

    const withArmor = freshState();
    withArmor.passives.armor = 3;
    damageTower(withArmor, 20);

    expect(withArmor.tower.hp).toBeGreaterThan(withoutArmor.tower.hp);
    expect(withArmor.tower.hp).toBeCloseTo(100 - 20 * (1 - 3 * 0.07), 5);
  });

  it('increases shake proportionally to the damage taken, unless skipped', () => {
    const state = freshState();
    expect(state.tower.shake).toBe(0);
    damageTower(state, 10);
    expect(state.tower.shake).toBeGreaterThan(0);

    const skipped = freshState();
    damageTower(skipped, 10, true);
    expect(skipped.tower.shake).toBe(0);
  });
});

describe('updateTowerTick', () => {
  it('does not heal without the Regeneration passive', () => {
    const state = freshState();
    state.tower.hp = 50;
    updateTowerTick(state, 5);
    expect(state.tower.hp).toBe(50);
  });

  it('heals over time with Regeneration leveled, capped at maxHp', () => {
    const state = freshState();
    state.tower.hp = 50;
    state.passives.regen = 2;
    updateTowerTick(state, 5);
    expect(state.tower.hp).toBeCloseTo(50 + 0.3 * 2 * 5, 5);

    state.tower.hp = 99;
    updateTowerTick(state, 5);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('decays shake over time, clamped at 0', () => {
    const state = freshState();
    state.tower.shake = 5;
    updateTowerTick(state, 0.1);
    expect(state.tower.shake).toBeCloseTo(5 - 0.1 * 30, 5);

    updateTowerTick(state, 10);
    expect(state.tower.shake).toBe(0);
  });
});
