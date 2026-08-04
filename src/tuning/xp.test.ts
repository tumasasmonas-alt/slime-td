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
  it('clamps to a 0-10 range', () => {
    expect(gemValueFromRemoved(0)).toBe(0);
    expect(gemValueFromRemoved(100)).toBe(10);
  });

  it('rounds removed * 1.3', () => {
    expect(gemValueFromRemoved(2)).toBe(3);
  });
});
