import { describe, expect, it } from 'vitest';
import { COAGULANT_XP_RISK_PREMIUM, gemValueFromRemoved, xpToNext } from './xp';

describe('xpToNext', () => {
  it.each([
    [1, 19],
    [2, 27],
    [5, 56],
    [10, 122],
  ])('level %i needs %i xp to the next level', (level, expected) => {
    expect(xpToNext(level)).toBe(expected);
  });

  it('is quadratic — the gap between consecutive levels widens as level rises', () => {
    // The invariant that matters (Decision 61): xp *cost per level*
    // increases with level, not just xp granted. A mechanism test on the
    // exact coefficients would break the moment the curve is retuned; this
    // survives that and only fails if the curve stops bending.
    const gapAt = (level: number) => xpToNext(level + 1) - xpToNext(level);
    expect(gapAt(20)).toBeGreaterThan(gapAt(10));
    expect(gapAt(10)).toBeGreaterThan(gapAt(1));
  });
});

describe('COAGULANT_XP_RISK_PREMIUM', () => {
  it('is a modest bonus, not the 25-50% range originally floated', () => {
    // Decision 31 floated 25-50%; the project owner's call landed lower
    // (15%) specifically because a bigger bonus makes the farming trap
    // Decision 31 exists to avoid worse, not better.
    expect(COAGULANT_XP_RISK_PREMIUM).toBeGreaterThan(0);
    expect(COAGULANT_XP_RISK_PREMIUM).toBeLessThanOrEqual(0.15);
  });
});

describe('gemValueFromRemoved', () => {
  it('floors at 0, never negative', () => {
    expect(gemValueFromRemoved(0)).toBe(0);
  });

  it('rounds removed * 1.3', () => {
    expect(gemValueFromRemoved(2)).toBe(3);
  });

  it('is uncapped — a big coagulant kill pays proportionally, not a flat 10', () => {
    // Decision 31, pulled forward into Phase 3C: a behemoth kill should
    // not pay the same XP as a routine bolt hit. See tuning/xp.ts.
    expect(gemValueFromRemoved(100)).toBe(130);
    expect(gemValueFromRemoved(400)).toBe(520);
  });
});
