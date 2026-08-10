import { describe, expect, it } from 'vitest';
import { extensionSlotCount, gemSocketCount } from './sockets';

describe('gemSocketCount', () => {
  it('matches the five named breakpoints exactly', () => {
    expect(gemSocketCount(0)).toBe(1);
    expect(gemSocketCount(3)).toBe(2);
    expect(gemSocketCount(8)).toBe(3);
    expect(gemSocketCount(15)).toBe(4);
    expect(gemSocketCount(24)).toBe(5);
  });

  it('holds one below each breakpoint', () => {
    expect(gemSocketCount(2)).toBe(1);
    expect(gemSocketCount(7)).toBe(2);
    expect(gemSocketCount(14)).toBe(3);
    expect(gemSocketCount(23)).toBe(4);
  });

  it('never decreases as points invested rises', () => {
    let previous = 0;
    for (let points = 0; points <= 40; points++) {
      const count = gemSocketCount(points);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('never drops below 1, at any input including negative', () => {
    expect(gemSocketCount(0)).toBeGreaterThanOrEqual(1);
    expect(gemSocketCount(-5)).toBeGreaterThanOrEqual(1);
  });

  it('holds past the top breakpoint — no cap on points invested (Decision 40: no cap)', () => {
    expect(gemSocketCount(100)).toBe(5);
  });
});

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2, S8 Q5): the
// owner's own sub-proposal — no extension slot below 5 points, one at
// 5-9, two at 10+. Independent of gemSocketCount's ladder (§8's edge
// case: 9->10 opens an extension slot while gemSocketCount(9) ===
// gemSocketCount(10), and 8->9 opens nothing on either ladder).
describe('extensionSlotCount', () => {
  it('is 0 below the first threshold', () => {
    expect(extensionSlotCount(0)).toBe(0);
    expect(extensionSlotCount(4)).toBe(0);
  });

  it('is 1 at and above the first threshold, below the second', () => {
    expect(extensionSlotCount(5)).toBe(1);
    expect(extensionSlotCount(9)).toBe(1);
  });

  it('is 2 at and above the second threshold', () => {
    expect(extensionSlotCount(10)).toBe(2);
  });

  it('never decreases as points invested rises', () => {
    let previous = 0;
    for (let points = 0; points <= 40; points++) {
      const count = extensionSlotCount(points);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('holds past the top breakpoint — no cap on points invested', () => {
    expect(extensionSlotCount(100)).toBe(2);
  });

  it('never drops below 0, at any input including negative', () => {
    expect(extensionSlotCount(-5)).toBeGreaterThanOrEqual(0);
  });
});
