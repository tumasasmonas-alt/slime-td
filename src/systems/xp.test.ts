import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { grantXp } from './xp';

describe('grantXp', () => {
  it('accumulates xp without leveling below the threshold', () => {
    const state = freshState();
    grantXp(state, 5);
    expect(state.tower.xp).toBe(5);
    expect(state.tower.level).toBe(1);
    expect(state.pendingLevelUps).toBe(0);
  });

  it('levels up once and queues exactly one pending level-up', () => {
    const state = freshState();
    grantXp(state, 10); // freshState() hardcodes 10 as the level-1 requirement
    expect(state.tower.level).toBe(2);
    expect(state.tower.xp).toBe(0);
    expect(state.pendingLevelUps).toBe(1);
  });

  it('queues one pending level-up per threshold crossed, instead of overwriting cards inline', () => {
    // The prototype called onLevelUp() (which rebuilds the upgrade
    // overlay) inline on every crossing, so a grant crossing several
    // thresholds at once silently discarded all but the last card. Here
    // it should just count the crossings for the UI to consume one at a
    // time. See docs/KNOWN_ISSUES.md.
    const state = freshState();
    grantXp(state, 100);
    expect(state.pendingLevelUps).toBeGreaterThan(1);
    expect(state.tower.level).toBeGreaterThan(2);
    expect(state.tower.xp).toBeGreaterThanOrEqual(0);
    expect(state.tower.xp).toBeLessThan(state.tower.xpToNext);
  });

  it('applies the Insight (xpGain) passive multiplier', () => {
    const withoutInsight = freshState();
    grantXp(withoutInsight, 5);

    const withInsight = freshState();
    withInsight.passives.xpGain = 1;
    grantXp(withInsight, 5);

    expect(withInsight.tower.xp).toBeCloseTo(5 * 1.14, 5);
    expect(withInsight.tower.xp).toBeGreaterThan(withoutInsight.tower.xp);
  });
});
