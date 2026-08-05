import { describe, expect, it } from 'vitest';
import { computeTierIndex, TIERS_LIST } from './tiers';

describe('computeTierIndex', () => {
  it('starts at tier 0 and holds until the next threshold', () => {
    expect(computeTierIndex(0)).toBe(0);
    expect(computeTierIndex(89)).toBe(0);
  });

  it('advances exactly at each tier start time', () => {
    expect(computeTierIndex(90)).toBe(1);
    expect(computeTierIndex(219)).toBe(1);
    expect(computeTierIndex(220)).toBe(2);
    expect(computeTierIndex(379)).toBe(2);
    expect(computeTierIndex(380)).toBe(3);
    expect(computeTierIndex(559)).toBe(3);
    expect(computeTierIndex(560)).toBe(4);
  });

  it('plateaus on the last tier past its start time (see docs/BACKLOG.md)', () => {
    expect(computeTierIndex(999_999)).toBe(TIERS_LIST.length - 1);
  });
});
