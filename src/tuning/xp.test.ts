import { describe, expect, it } from 'vitest';
import { gemValueFromRemoved, xpToNext } from './xp';

describe('xpToNext', () => {
  it.each([
    [1, 19],
    [2, 25],
    [5, 45],
    [10, 77],
  ])('level %i needs %i xp to the next level', (level, expected) => {
    expect(xpToNext(level)).toBe(expected);
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
