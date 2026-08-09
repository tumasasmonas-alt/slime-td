import { describe, expect, it } from 'vitest';
import { COAGULANT_XP_RISK_PREMIUM, gemValueFromRemoved, xpToNext } from './xp';

describe('xpToNext', () => {
  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S2): the old it.each
  // pinning exact values at levels 2/5/10 is gone on purpose — those are
  // now expected to move with XP_GROWTH, and pinning them would just
  // break on the very retune the plan calls "expected." Level 1 stays
  // pinned because the curve is built specifically to leave it untouched
  // (the `^(level-1)` exponent) — Decision 61's "the early rush survives."
  it('is unchanged at level 1 — the early rush survives by construction', () => {
    expect(xpToNext(1)).toBe(19);
  });

  it('is strictly increasing', () => {
    for (let level = 1; level < 100; level++) {
      expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
    }
  });

  it('is superpolynomial — the per-level ratio stays bounded away from 1, unlike any fixed polynomial', () => {
    // Any fixed polynomial's own consecutive-level ratio converges to 1 as
    // level rises — visible here using the exact 12/6.5/0.45 coefficients
    // Decision 61 fixed for the quadratic base alone (no growth factor):
    // by level 80 that ratio has already settled under 1.03. xpToNext must
    // NOT do that, or DPS (which 6A's gems grow faster than any
    // polynomial) eventually outpaces cost again — the "level 80 in under
    // ten minutes" finding this curve exists to fix.
    const quadraticOnlyRatio = (level: number) => {
      const base = (l: number) => 12 + 6.5 * l + 0.45 * l * l;
      return base(level + 1) / base(level);
    };
    const ratio = (level: number) => xpToNext(level + 1) / xpToNext(level);

    expect(quadraticOnlyRatio(80)).toBeLessThan(1.03); // the old curve, for contrast
    expect(ratio(80)).toBeGreaterThan(1.03); // xpToNext must clear it
  });

  it('is quadratic-plus in shape — the gap between consecutive levels widens as level rises', () => {
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
