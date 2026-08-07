import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { GEM_SHOWER_MAX_COUNT, GEM_SHOWER_UNIT } from '../tuning/xp';
import { dropGem, dropGemShower, updateGems } from './gems';

describe('dropGem', () => {
  it('pushes a gem sized from its xp value', () => {
    const state = freshState();
    dropGem(state, 10, 20, 5);
    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]).toMatchObject({ x: 10, y: 20, xp: 5 });
    expect(state.gems[0]!.radius).toBeCloseTo(4 + Math.min(4, 5 * 0.15), 5);
  });

  it('defaults driftJitter to 1 — a plain drop is not scattered in time', () => {
    const state = freshState();
    dropGem(state, 10, 20, 5);
    expect(state.gems[0]!.driftJitter).toBe(1);
  });
});

describe('dropGemShower (2026-08-07, Phase 3D)', () => {
  it('drops exactly one gem for a value at or below the shower unit — same as dropGem', () => {
    const state = freshState();
    dropGemShower(state, 100, 100, GEM_SHOWER_UNIT);
    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]!.xp).toBeCloseTo(GEM_SHOWER_UNIT, 5);
  });

  it('does nothing for a value below 1', () => {
    const state = freshState();
    dropGemShower(state, 100, 100, 0.5);
    expect(state.gems).toHaveLength(0);
  });

  it('splits a large value into several gems whose total xp is conserved', () => {
    const state = freshState();
    const totalXp = GEM_SHOWER_UNIT * 4.5; // well above one shower unit
    dropGemShower(state, 100, 100, totalXp);

    expect(state.gems.length).toBeGreaterThan(1);
    const summed = state.gems.reduce((sum, g) => sum + g.xp, 0);
    expect(summed).toBeCloseTo(totalXp, 5);
  });

  it('caps gem count at GEM_SHOWER_MAX_COUNT, however large the kill', () => {
    const state = freshState();
    dropGemShower(state, 100, 100, GEM_SHOWER_UNIT * 1000); // an enormous behemoth kill
    expect(state.gems).toHaveLength(GEM_SHOWER_MAX_COUNT);
    const summed = state.gems.reduce((sum, g) => sum + g.xp, 0);
    expect(summed).toBeCloseTo(GEM_SHOWER_UNIT * 1000, 1);
  });

  it("gives each gem its own drift jitter so a shower doesn't arrive as one simultaneous clump", () => {
    const state = freshState();
    dropGemShower(state, 100, 100, GEM_SHOWER_UNIT * 4.5);
    const jitters = new Set(state.gems.map((g) => g.driftJitter));
    // Not a strict proof of randomness, but with several gems the odds of
    // every single one landing on an identical float are negligible.
    expect(jitters.size).toBeGreaterThan(1);
    for (const g of state.gems) {
      expect(g.driftJitter).toBeGreaterThan(0);
    }
  });
});

describe('updateGems', () => {
  it('drifts a distant gem toward the (stationary) core rather than requiring it to already be in range', () => {
    // This is exactly the bug documented in archive/PROTOTYPE_HANDOFF.md:
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
