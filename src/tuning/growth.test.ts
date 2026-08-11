import { describe, expect, it } from 'vitest';
import { ambientInfectionMult } from './growth';

// 6D-0 (docs/plans/phase-6d0-balance-shape.md S2): the breakpoint table
// used to be the whole curve and stopped climbing at t=560s while player
// power never does — the same mismatch the 2026-08-05 playtest measured.
// This guards the fix: an outcome test (does it keep climbing?) rather
// than a mechanism test pinning a coefficient, per Decision 20.
describe('ambientInfectionMult — unbounded late-game escalation (Phase 6D-0)', () => {
  it('strictly increases well past the old breakpoint table ceiling (t=560)', () => {
    const at600 = ambientInfectionMult(600);
    const at1200 = ambientInfectionMult(1200);
    const at2400 = ambientInfectionMult(2400);
    expect(at1200).toBeGreaterThan(at600);
    expect(at2400).toBeGreaterThan(at1200);
  });

  it('still reaches the table’s known values by t=0 and t=560 within the late-growth factor', () => {
    // At t=0 the late-growth factor is 1, so this is exact.
    expect(ambientInfectionMult(0)).toBeCloseTo(1.0, 5);
    // At t=560 the late-growth factor has already compounded — the curve
    // is not "unchanged" at any t>0, only its *shape* (the breakpoints)
    // is preserved. This pins that the multiplier is applied on top,
    // not instead of, the table.
    expect(ambientInfectionMult(560)).toBeGreaterThan(3.1);
  });

  it('never decreases as elapsed time increases', () => {
    let prev = ambientInfectionMult(0);
    for (let t = 30; t <= 3000; t += 30) {
      const mult = ambientInfectionMult(t);
      expect(mult).toBeGreaterThanOrEqual(prev);
      prev = mult;
    }
  });
});
