import { describe, expect, it } from 'vitest';
import {
  AGE_CEILING,
  CEILING_MATURE_FRAC,
  CEILING_VIRGIN_FRAC,
  MATURITY_BUCKETS,
  MATURITY_MAX,
  MATURITY_YIELD_FLOOR,
  ageFloorAt,
  growthCeiling,
  maturityBucket,
  maturityYieldMult,
  regrowthRateMult,
} from './maturity';

describe('growthCeiling', () => {
  it('fills the configured fraction of a cell\'s headroom above its own threshold', () => {
    // At threshold 0, headroom is the whole 0..1 range, so the ceiling is
    // the fraction itself — the easiest case to read.
    expect(growthCeiling(0, 0)).toBeCloseTo(CEILING_VIRGIN_FRAC, 5);
    expect(growthCeiling(MATURITY_MAX, 0)).toBeCloseTo(CEILING_MATURE_FRAC, 5);
  });

  it('interpolates monotonically between virgin and mature', () => {
    expect(growthCeiling(MATURITY_MAX / 2, 0)).toBeGreaterThan(growthCeiling(0, 0));
    expect(growthCeiling(MATURITY_MAX / 2, 0)).toBeLessThan(growthCeiling(MATURITY_MAX, 0));
  });

  it('is ALWAYS strictly above the cell\'s own threshold, at every threshold and every maturity — no cell can be permanently unrevealable', () => {
    // The regression guard that matters. An absolute (threshold-blind)
    // ceiling below grid.ts's 0.94 threshold cap left 22.3% of the arena —
    // 2,876 cells — invisible forever, since cellBucket renders nothing
    // while growth <= threshold. Measured directly in the browser after the
    // project owner's playtest reported "top left area all black, the slime
    // never was there."
    for (let threshold = 0; threshold <= 0.94; threshold += 0.02) {
      for (const maturity of [0, 0.5, MATURITY_MAX]) {
        expect(growthCeiling(maturity, threshold)).toBeGreaterThan(threshold);
      }
    }
    // Explicitly at grid.ts's exact clamp bounds.
    expect(growthCeiling(0, 0.94)).toBeGreaterThan(0.94);
    expect(growthCeiling(0, 0.045)).toBeGreaterThan(0.045);
  });

  it('never exceeds 1, even at the maximum threshold and full maturity', () => {
    expect(growthCeiling(MATURITY_MAX, 0.94)).toBeLessThanOrEqual(1);
    expect(growthCeiling(MATURITY_MAX, 1)).toBeLessThanOrEqual(1);
  });

  it('leaves virgin ground one render bucket short of scarred ground — otherwise the mechanic is visually inert', () => {
    // cellBucket quantizes (growth - threshold) / (1 - threshold) into 5
    // steps, so a virgin fraction of 0.8+ would land in the same top bucket
    // as fully mature ground and nothing would be visible.
    expect(CEILING_VIRGIN_FRAC).toBeLessThan(0.8);
  });
});

describe('regrowthRateMult', () => {
  it('is 1 (unslowed) at zero maturity, slower at max — a durability threat, not a speed threat', () => {
    expect(regrowthRateMult(0)).toBe(1);
    expect(regrowthRateMult(MATURITY_MAX)).toBeLessThan(1);
    expect(regrowthRateMult(MATURITY_MAX)).toBeGreaterThan(0);
  });
});

describe('maturityYieldMult', () => {
  it('is 1 (no penalty) at zero maturity, reduced at max, but never below the floor', () => {
    expect(maturityYieldMult(0)).toBe(1);
    expect(maturityYieldMult(MATURITY_MAX)).toBeLessThan(1);
    expect(maturityYieldMult(MATURITY_MAX)).toBeGreaterThanOrEqual(MATURITY_YIELD_FLOOR);
  });

  it('clamps out-of-range maturity rather than producing a negative or runaway multiplier', () => {
    expect(maturityYieldMult(MATURITY_MAX * 100)).toBe(maturityYieldMult(MATURITY_MAX));
  });
});

describe('ageFloorAt', () => {
  it('starts at 0 and rises with elapsed time', () => {
    expect(ageFloorAt(0)).toBe(0);
    expect(ageFloorAt(60)).toBeGreaterThan(ageFloorAt(0));
  });

  it('never exceeds AGE_CEILING, however long the run — the wilderness can never approach a wall', () => {
    expect(ageFloorAt(1_000_000)).toBe(AGE_CEILING);
  });
});

describe('maturityBucket', () => {
  it('is 0 at zero maturity and the top bucket at max, at a zero floor', () => {
    expect(maturityBucket(0, 0)).toBe(0);
    expect(maturityBucket(MATURITY_MAX, 0)).toBe(MATURITY_BUCKETS - 1);
  });

  it('is monotonic non-decreasing across the range, at a fixed floor', () => {
    let prev = maturityBucket(0, 0);
    for (let i = 1; i <= 10; i++) {
      const m = (MATURITY_MAX * i) / 10;
      const b = maturityBucket(m, 0);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it('is always bucket 0 for a cell sitting exactly at the current age floor, however high that floor has risen — untouched ground never reads as scarred', () => {
    expect(maturityBucket(0, 0)).toBe(0);
    expect(maturityBucket(AGE_CEILING, AGE_CEILING)).toBe(0);
    // Degenerate (floor at MATURITY_MAX) must not divide by zero or go negative.
    expect(maturityBucket(MATURITY_MAX, MATURITY_MAX)).toBe(0);
  });

  it('stays legible once the age floor has risen — regression guard for the bucketing half of the failure found live 2026-08-07', () => {
    // A fixed 0..1 split would put AGE_CEILING itself inside bucket 1, so
    // once the floor reaches it (~6 minutes into any run) every cell —
    // fought-over or not — lands in the same bucket and the placeholder
    // overlay goes invisible. This tests only that half of the bug (the
    // bucket math); the *other* half — MATURITY_DECAY erasing scar gains
    // faster than sparse real hits could ever produce them, so nothing
    // ever climbed meaningfully above the floor in the first place — was a
    // balance bug in tuning/maturity.ts's constants, not in this function,
    // and is guarded by the live-simulation outcome test in
    // systems/maturity.test.ts instead (the one that actually verified,
    // via debug harness, real scarring up to ~0.97 after the fix).
    expect(maturityBucket(0.7, AGE_CEILING)).toBeGreaterThan(0);
    // Untouched ground at that same floor must still read as unscarred.
    expect(maturityBucket(AGE_CEILING, AGE_CEILING)).toBe(0);
  });

  it('front-loads sensitivity — modest scarring above the floor already crosses out of bucket 0, well before a uniform split would', () => {
    const floor = 0;
    const span = MATURITY_MAX - floor;
    const t = 0.1; // well below where a uniform scheme's first boundary (0.25) would sit
    expect(maturityBucket(floor + t * span, floor)).toBeGreaterThan(0);
  });
});
