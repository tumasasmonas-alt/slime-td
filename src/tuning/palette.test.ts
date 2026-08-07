import { describe, expect, it } from 'vitest';
import { MATURITY_BUCKETS } from './maturity';
import { BARE_SCAR_ALPHA, DENSITY_ALPHA, MATURITY_COLORS } from './palette';

// Perceptual distance between two 'r,g,b' component strings — Euclidean in
// RGB space is a crude but sufficient proxy for "can a player tell these
// apart," and it's exactly the kind of check that would have caught the
// original palette's collapse (two dark-maroon buckets, two bright-pink
// buckets) if it had existed then.
function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = a.split(',').map(Number);
  const [br, bg, bb] = b.split(',').map(Number);
  return Math.hypot(ar! - br!, ag! - bg!, ab! - bb!);
}

describe('DENSITY_ALPHA', () => {
  it('is monotonically increasing with a real gap between adjacent steps', () => {
    // The direct regression guard for the "5 buckets read as 3" collapse:
    // the old palette failed because adjacent steps were too close, not
    // because the hues were wrong. A minimum gap makes that impossible.
    const MIN_GAP = 0.1;
    for (let i = 1; i < DENSITY_ALPHA.length; i++) {
      expect(DENSITY_ALPHA[i]!).toBeGreaterThan(DENSITY_ALPHA[i - 1]!);
      expect(DENSITY_ALPHA[i]! - DENSITY_ALPHA[i - 1]!).toBeGreaterThanOrEqual(MIN_GAP);
    }
  });

  it('has one entry per cellBucket output (0-5) and stays within [0,1]', () => {
    expect(DENSITY_ALPHA).toHaveLength(6);
    for (const a of DENSITY_ALPHA) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('bucket 0 (unrevealed) is fully transparent', () => {
    expect(DENSITY_ALPHA[0]).toBe(0);
  });
});

describe('MATURITY_COLORS', () => {
  it('has exactly MATURITY_BUCKETS entries', () => {
    expect(MATURITY_COLORS).toHaveLength(MATURITY_BUCKETS);
  });

  it('adjacent maturity colours are perceptually distinct', () => {
    // Guards the other axis against the same collapse DENSITY_ALPHA guards
    // against — a future retune can't quietly recreate "4 buckets read as
    // 2" by picking two similar hues next to each other.
    const MIN_DISTANCE = 20;
    for (let i = 1; i < MATURITY_COLORS.length; i++) {
      expect(colorDistance(MATURITY_COLORS[i]!, MATURITY_COLORS[i - 1]!)).toBeGreaterThanOrEqual(MIN_DISTANCE);
    }
  });

  it('every colour is a valid 3-component rgb string', () => {
    for (const c of MATURITY_COLORS) {
      const parts = c.split(',').map(Number);
      expect(parts).toHaveLength(3);
      for (const p of parts) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('BARE_SCAR_ALPHA', () => {
  it('has exactly MATURITY_BUCKETS entries', () => {
    expect(BARE_SCAR_ALPHA).toHaveLength(MATURITY_BUCKETS);
  });

  it('is strictly below the lowest slime alpha at every maturity bucket — terrain never reads as more than tissue', () => {
    const lowestSlimeAlpha = DENSITY_ALPHA[1]!;
    for (const a of BARE_SCAR_ALPHA) {
      expect(a).toBeLessThan(lowestSlimeAlpha);
    }
  });

  it('bucket 0 (unscarred) is fully transparent', () => {
    expect(BARE_SCAR_ALPHA[0]).toBe(0);
  });
});
