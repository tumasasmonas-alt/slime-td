import { describe, expect, it } from 'vitest';
import { generateVeinField, generateVeinFieldRaw } from './veinField';

// Same feed/kill as production; only iteration count and step vary per test.
const RD_TEST_FEED = 0.0545;
const RD_TEST_KILL = 0.062;

interface FieldStats {
  finite: boolean;
  variance: number;
}

function stats(field: Float32Array): FieldStats {
  let sum = 0;
  for (const v of field) {
    if (!Number.isFinite(v)) return { finite: false, variance: NaN };
    sum += v;
  }
  const mean = sum / field.length;
  let variance = 0;
  for (const v of field) variance += (v - mean) ** 2;
  variance /= field.length;
  return { finite: true, variance };
}

describe('generateVeinFieldRaw stability', () => {
  // This is a canary: it proves the test below (checking the production
  // step stays finite) would actually catch a real regression, rather
  // than passing vacuously because nothing in this suite can go NaN.
  it('diverges to NaN with an unstable step, as documented', () => {
    const field = generateVeinFieldRaw(20, 20, 100, RD_TEST_FEED, RD_TEST_KILL, 1.0);
    expect(stats(field).finite).toBe(false);
  });

  it('stays finite with real spatial variance at the production step', () => {
    // Gray-Scott needs both enough iterations and a domain not much
    // smaller than the pattern's characteristic wavelength to develop
    // real contrast — a too-small/short-lived run just relaxes to a
    // near-uniform field, which would make this test pass vacuously.
    const field = generateVeinFieldRaw(40, 40, 2000, RD_TEST_FEED, RD_TEST_KILL, 0.15);
    const s = stats(field);
    expect(s.finite).toBe(true);
    expect(s.variance).toBeGreaterThan(0.001);
  });
});

describe('generateVeinField', () => {
  it('returns a normalized field of the requested size with real contrast', () => {
    const cols = 80;
    const rows = 80;
    const field = generateVeinField(cols, rows);
    expect(field.length).toBe(cols * rows);

    let min = Infinity;
    let max = -Infinity;
    for (const v of field) {
      expect(Number.isFinite(v)).toBe(true);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    // Not a flat/blank field — genuine coral-pattern contrast.
    expect(max - min).toBeGreaterThan(0.5);
  });
});
