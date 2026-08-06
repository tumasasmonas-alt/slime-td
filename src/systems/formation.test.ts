import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { cellBucket, gIdx, worldToCell } from '../grid/grid';
import {
  FORMATION_RADIUS_CAP,
  MASS_BEHEMOTH,
  MASS_CONGEALER,
  MASS_MIN_FORMATION,
  coagulantKindFromMass,
  coagulantRadius,
} from '../tuning/coagulants';
import { attemptFormation } from './formation';

// Large enough to hold FORMATION_RADIUS_CAP (180px) comfortably at this
// cellSize, with room to spare for "outside the cap" assertions.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 6400;
  return {
    cols: 80,
    rows: 80,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size), // 0 everywhere -> any growth > 0 is revealed
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 1000,
    perimeter: 100,
    ...overrides,
  };
}

// Fills a square block of revealed cells around the grid center at a
// given density, for controlled flood-fill scenarios.
function fillSquare(grid: Grid, centerX: number, centerY: number, halfWidthPx: number, density: number): void {
  const { cx: ccx, cy: ccy } = worldToCell(grid, centerX, centerY);
  const half = Math.ceil(halfWidthPx / grid.cellSize);
  for (let oy = -half; oy <= half; oy++) {
    const cy = ccy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -half; ox <= half; ox++) {
      const cx = ccx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      const i = gIdx(grid, cx, cy);
      grid.growth[i] = density;
      // Real growth-writing code always keeps `bucket` in sync with
      // `growth` as it writes (see clearAt, applyAmbientGrowth) — stamp
      // it here too, so a synthetic fixture doesn't leave a stale
      // "everything defaults to bucket 0" array that makes every drain
      // look like a no-op transition regardless of what actually changed.
      grid.bucket[i] = cellBucket(grid, i);
    }
  }
}

describe('attemptFormation', () => {
  it('does nothing without a grid yet', () => {
    const state = freshState();
    const result = attemptFormation(state, 400, 400);
    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
  });

  it('forms nothing when the spark lands on unrevealed ground', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // growth stays 0 everywhere -> not revealed anywhere.
    const result = attemptFormation(state, 400, 400);
    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
  });

  it('forms nothing when the contiguous mass is below the minimum threshold', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A single thin revealed cell — nowhere near enough mass.
    const { cx, cy } = worldToCell(state.grid, 400, 400);
    state.grid.growth[gIdx(state.grid, cx, cy)] = 0.05;

    const result = attemptFormation(state, 400, 400);

    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
    // And nothing was drained — the untouched cell still holds its density.
    expect(state.grid.growth[gIdx(state.grid, cx, cy)]).toBeCloseTo(0.05, 5);
  });

  it('forms a coagulant and drains exactly the flood-filled cells, once mass clears the minimum', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9); // well above MASS_MIN_FORMATION

    const before = state.grid.growth.reduce((a, b) => a + b, 0);
    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(state.coagulants).toHaveLength(1);
    expect(state.coagulants[0]).toBe(result);
    expect(result!.mass).toBeGreaterThanOrEqual(MASS_MIN_FORMATION);

    const after = state.grid.growth.reduce((a, b) => a + b, 0);
    // Rule 1: formation is a sink. Whatever mass the coagulant now holds
    // came directly out of the grid, not from nowhere.
    expect(before - after).toBeCloseTo(result!.mass, 5);
  });

  it('gates on revealed density, never raw density — bug #3 discipline', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const { cx, cy } = worldToCell(state.grid, 400, 400);
    const i = gIdx(state.grid, cx, cy);
    state.grid.threshold[i] = 0.9; // high threshold -- not revealed yet
    state.grid.growth[i] = 0.5; // well above MASS_MIN_FORMATION in isolation, but unrevealed

    const result = attemptFormation(state, 400, 400);

    expect(result).toBeNull();
    expect(state.grid.growth[i]).toBe(0.5); // untouched
  });

  it("bounds mass to a formation footprint — doesn't scale with a saturated field far past the radius cap", () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A field far larger than FORMATION_RADIUS_CAP in every direction,
    // fully saturated. Under an unbounded flood-fill this would return
    // "the entire field" as one region (2026-08-05 record §9); bounded,
    // it should return only what fits inside the radius cap.
    fillSquare(state.grid, 400, 400, FORMATION_RADIUS_CAP * 3, 1.0);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    // Area within the radius cap at density 1: pi * r^2 / cellSize^2,
    // generously bounded (flood-fill is a diamond/box approximation of a
    // circle, not exact) rather than asserting an exact figure.
    const looseUpperBound = (FORMATION_RADIUS_CAP * FORMATION_RADIUS_CAP * 4) / (state.grid.cellSize * state.grid.cellSize);
    expect(result!.mass).toBeLessThan(looseUpperBound);

    // Cells well outside the cap must be untouched.
    const farOut = worldToCell(state.grid, 400 + FORMATION_RADIUS_CAP * 2.5, 400);
    expect(state.grid.growth[gIdx(state.grid, farOut.cx, farOut.cy)]).toBe(1.0);
  });

  it('picks the coagulant kind from the mass thresholds, consistently with coagulantKindFromMass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A modest patch that should land as a mote.
    fillSquare(state.grid, 400, 400, 15, 0.5);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe(coagulantKindFromMass(result!.mass));
  });

  it('sets radius from coagulantRadius(mass) and armor to 0 (Wave 1)', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.radius).toBeCloseTo(coagulantRadius(result!.mass), 5);
    expect(result!.armor).toBe(0);
  });

  it('generates seeds up front rather than leaving them empty for a draw call to fill in', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.seeds.length).toBeGreaterThan(0);
  });

  it('marks touched cells dirty so the slime layer repaints the crater', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    attemptFormation(state, 400, 400);

    expect(state.dirty.size).toBeGreaterThan(0);
  });
});

describe('coagulantKindFromMass', () => {
  it('is a mote below the congealer threshold', () => {
    expect(coagulantKindFromMass(MASS_MIN_FORMATION)).toBe('mote');
    expect(coagulantKindFromMass(MASS_CONGEALER - 0.01)).toBe('mote');
  });

  it('is a congealer at/above the congealer threshold, below the behemoth threshold', () => {
    expect(coagulantKindFromMass(MASS_CONGEALER)).toBe('congealer');
    expect(coagulantKindFromMass(MASS_BEHEMOTH - 0.01)).toBe('congealer');
  });

  it('is a behemoth at/above the behemoth threshold', () => {
    expect(coagulantKindFromMass(MASS_BEHEMOTH)).toBe('behemoth');
    expect(coagulantKindFromMass(MASS_BEHEMOTH * 10)).toBe('behemoth');
  });
});

describe('coagulantRadius', () => {
  it('grows with mass — area is proportional to mass, not a flat size stat', () => {
    const small = coagulantRadius(MASS_MIN_FORMATION);
    const big = coagulantRadius(MASS_BEHEMOTH);
    expect(big).toBeGreaterThan(small);
    // r = k*sqrt(mass), so area (pi*r^2) scales linearly with mass.
    const areaRatio = (big * big) / (small * small);
    expect(areaRatio).toBeCloseTo(MASS_BEHEMOTH / MASS_MIN_FORMATION, 1);
  });
});
