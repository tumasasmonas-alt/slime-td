import { describe, expect, it } from 'vitest';
import { eventSpawnInterval } from './events';

// 6D-0 (docs/plans/phase-6d0-balance-shape.md S2): eventSpawnInterval used
// to hit a hard floor at t=420s — another axis that plateaus while player
// power doesn't. It now keeps shrinking toward an asymptotic 3s floor
// that protects the simulation, not the difficulty. Outcome tests, per
// Decision 20, since every number here is expected to move.
describe('eventSpawnInterval — asymptotic late-game floor (Phase 6D-0)', () => {
  it('never returns below the hard floor, at any elapsed time', () => {
    for (const t of [0, 420, 421, 1000, 5000, 100000]) {
      expect(eventSpawnInterval(t)).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps shrinking past the old ramp end (t=420) rather than plateauing', () => {
    const at420 = eventSpawnInterval(420);
    const at1000 = eventSpawnInterval(1000);
    const at3000 = eventSpawnInterval(3000);
    expect(at1000).toBeLessThan(at420);
    expect(at3000).toBeLessThan(at1000);
  });

  it('is monotonically non-increasing across the whole domain', () => {
    let prev = eventSpawnInterval(0);
    for (let t = 10; t <= 6000; t += 10) {
      const interval = eventSpawnInterval(t);
      expect(interval).toBeLessThanOrEqual(prev + 1e-9);
      prev = interval;
    }
  });

  it('approaches, but never reaches, the 3s floor', () => {
    // Not an arbitrarily large t — the exponential decay underflows to
    // exactly 0 in floating point past a few thousand seconds' worth of
    // half-lives, which would make the floor technically reachable in
    // this representation. 10,000s (~2.8h) is well past any real run but
    // still resolves to a value distinguishably above 3.
    const veryLate = eventSpawnInterval(10_000);
    expect(veryLate).toBeGreaterThan(3);
    expect(veryLate).toBeCloseTo(3, 2);
  });
});
