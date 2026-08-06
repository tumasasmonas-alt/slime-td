import { describe, expect, it } from 'vitest';
import { circleOverlapArea, clamp, dist, fmtTime, lerp, pick, randInt } from './math';

describe('clamp', () => {
  it('clamps below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('passes through values already in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('lerp', () => {
  it('interpolates at the midpoint', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(3, 7, 0)).toBe(3);
    expect(lerp(3, 7, 1)).toBe(7);
  });
});

describe('dist', () => {
  it('computes a 3-4-5 triangle', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });
});

describe('fmtTime', () => {
  it('formats zero', () => {
    expect(fmtTime(0)).toBe('00:00');
  });
  it('formats over a minute', () => {
    expect(fmtTime(65)).toBe('01:05');
  });
  it('truncates fractional seconds rather than rounding', () => {
    expect(fmtTime(59.9)).toBe('00:59');
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds', () => {
    for (let i = 0; i < 200; i++) {
      const n = randInt(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});

describe('circleOverlapArea', () => {
  it('is 0 when the circles are separate', () => {
    expect(circleOverlapArea(0, 0, 5, 20, 0, 5)).toBe(0);
  });

  it('is 0 when the circles are exactly touching (edge case, not overlapping)', () => {
    expect(circleOverlapArea(0, 0, 5, 10, 0, 5)).toBe(0);
  });

  it('is the smaller circle\'s full area when one fully contains the other', () => {
    // A tiny circle centered inside a big one: the overlap is capped at
    // the small one's own area, not larger.
    const area = circleOverlapArea(0, 0, 20, 2, 0, 3);
    expect(area).toBeCloseTo(Math.PI * 3 * 3, 5);
  });

  it('is exactly half of each circle when identical circles are perfectly overlapping', () => {
    const r = 10;
    const area = circleOverlapArea(0, 0, r, 0, 0, r);
    expect(area).toBeCloseTo(Math.PI * r * r, 5);
  });

  it('grows monotonically as circles move closer together', () => {
    const far = circleOverlapArea(0, 0, 10, 15, 0, 10);
    const mid = circleOverlapArea(0, 0, 10, 10, 0, 10);
    const near = circleOverlapArea(0, 0, 10, 5, 0, 10);
    expect(mid).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(mid);
  });

  it('is symmetric — order of the two circles does not matter', () => {
    const a = circleOverlapArea(0, 0, 8, 6, 4, 5);
    const b = circleOverlapArea(6, 4, 5, 0, 0, 8);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('pick', () => {
  it('always returns an element from the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it('throws on an empty array rather than silently returning undefined', () => {
    expect(() => pick([])).toThrow();
  });
});
