import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { dropGem, updateGems } from './gems';

describe('dropGem', () => {
  it('pushes a gem sized from its xp value', () => {
    const state = freshState();
    dropGem(state, 10, 20, 5);
    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]).toMatchObject({ x: 10, y: 20, xp: 5 });
    expect(state.gems[0]!.radius).toBeCloseTo(4 + Math.min(4, 5 * 0.15), 5);
  });
});

describe('updateGems', () => {
  it('drifts a distant gem toward the (stationary) core rather than requiring it to already be in range', () => {
    // This is exactly the bug documented in docs/PROTOTYPE_HANDOFF.md:
    // weapons clear tissue well outside any modest "pickup radius", so
    // gems must always drift, never gate on one.
    const state = freshState();
    dropGem(state, state.tower.x + 500, state.tower.y, 3);
    const startX = state.gems[0]!.x;

    updateGems(state, 0.1);

    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]!.x).toBeLessThan(startX);
  });

  it('grants xp, spawns particles, and removes the gem once it reaches the core', () => {
    const state = freshState();
    dropGem(state, state.tower.x + 1, state.tower.y, 7);

    updateGems(state, 0.016);

    expect(state.gems).toHaveLength(0);
    expect(state.tower.xp).toBeCloseTo(7, 5);
    expect(state.particles.length).toBeGreaterThan(0);
  });

  it('drifts faster with Magnetism (pickup) leveled', () => {
    const base = freshState();
    dropGem(base, base.tower.x + 500, base.tower.y, 3);
    updateGems(base, 0.1);
    const baseTravel = Math.abs(base.gems[0]!.x - (base.tower.x + 500));

    const magnetized = freshState();
    magnetized.passives.pickup = 1;
    dropGem(magnetized, magnetized.tower.x + 500, magnetized.tower.y, 3);
    updateGems(magnetized, 0.1);
    const magnetizedTravel = Math.abs(magnetized.gems[0]!.x - (magnetized.tower.x + 500));

    expect(magnetizedTravel).toBeGreaterThan(baseTravel);
  });
});
