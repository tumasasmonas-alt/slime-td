import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from './frontier';
import { findNearbyRevealedPoint, highestMassPoint } from './targeting';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 400,
    y: 300,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 15,
    speed: 45,
    phase: 'active',
    phaseTimer: 0,
    seeds: [],
    splitAtMass: 0,
    sourceMaturity: 0,
    parts: [],
    startMass: 50,
    lastHitAt: -Infinity,
    chilledUntil: 0,
    armorDebuff: 0,
    armorDebuffUntil: 0,
    ...overrides,
  };
}

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 3600;
  return {
    cols: 60,
    rows: 60,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
    maxRange: 300,
    perimeter: 20,
    ...overrides,
  };
}

describe('findNearbyRevealedPoint', () => {
  it('returns null when nothing revealed is within range', () => {
    const grid = makeTestGrid();
    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set())).toBeNull();
  });

  it('finds a revealed cell within the search radius', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32; // world ~(325, 315), near (300,300)
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.5;

    const result = findNearbyRevealedPoint(grid, 300, 300, 50, new Set());

    expect(result).not.toBeNull();
    expect(result!.i).toBe(idx);
  });

  it('ignores cells outside the search radius', () => {
    const grid = makeTestGrid();
    const idx = 50 * grid.cols + 50; // far away
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.9;

    expect(findNearbyRevealedPoint(grid, 300, 300, 20, new Set())).toBeNull();
  });

  it('skips visited cells', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32;
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.5;

    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set([idx]))).toBeNull();
  });

  it('prefers the most-grown candidate among several in range', () => {
    const grid = makeTestGrid();
    const lowIdx = 30 * grid.cols + 31; // ~(315, 305)
    const highIdx = 31 * grid.cols + 32; // ~(325, 315)
    grid.threshold[lowIdx] = 0.1;
    grid.growth[lowIdx] = 0.3;
    grid.threshold[highIdx] = 0.1;
    grid.growth[highIdx] = 0.9;

    const result = findNearbyRevealedPoint(grid, 300, 300, 50, new Set());

    expect(result!.i).toBe(highIdx);
  });

  it('ignores unrevealed density, even if raw growth is high', () => {
    const grid = makeTestGrid();
    const idx = 31 * grid.cols + 32;
    grid.threshold[idx] = 0.9; // high threshold — not revealed
    grid.growth[idx] = 0.5;

    expect(findNearbyRevealedPoint(grid, 300, 300, 50, new Set())).toBeNull();
  });
});

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S3, S9): Lance's ACQUIRE —
// biggest coagulant in range, never nearest, with a nearest-frontier
// fallback so the weapon isn't dead for a run's first ninety seconds.
describe('highestMassPoint', () => {
  it('picks the LARGER coagulant, not the nearer one', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const near = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const far = makeCoagulant({ x: 500, y: 300, mass: 500 });
    state.coagulants = [near, far];

    const result = highestMassPoint(state, 400);

    expect(result).not.toBeNull();
    expect(result!.x).toBe(far.x);
  });

  it('ignores a "forming" coagulant — it hasn\'t detached from the field yet', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const forming = makeCoagulant({ x: 320, y: 300, mass: 500, phase: 'forming' });
    state.coagulants = [forming];
    computeFrontier(state);

    const result = highestMassPoint(state, 400);

    // Nothing else on the field either — falls all the way through to
    // whatever nearestFrontierPoint finds (nothing revealed → null).
    expect(result).toBeNull();
  });

  it('the maxRange gate applies to the mass-priority search — a small in-range coagulant beats a huge out-of-range one', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const small = makeCoagulant({ x: 320, y: 300, mass: 50 }); // in range
    const huge = makeCoagulant({ x: 900, y: 300, mass: 5000 }); // far beyond maxRange
    state.coagulants = [small, huge];
    computeFrontier(state);

    const result = highestMassPoint(state, 200);

    // If maxRange were ignored, the huge one would win every time — this
    // is the property that actually distinguishes "capped mass search"
    // from "just nearestFrontierPoint with extra steps."
    expect(result!.x).toBe(small.x);
  });

  // The "does nothing for ninety seconds" guard — an early run has no
  // coagulants at all, and the weapon must still find SOMETHING to fire
  // at, not silently do nothing.
  it('falls back to the nearest frontier point when no coagulant qualifies', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.tower.radius = 20;
    const idx = 31 * state.grid.cols + 32;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;
    computeFrontier(state);

    const result = highestMassPoint(state, 400);

    expect(result).not.toBeNull();
  });
});
