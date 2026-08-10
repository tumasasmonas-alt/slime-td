import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { updateClouds } from './clouds';

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

describe('updateClouds', () => {
  it('ticks damage on its own cadence, not every frame', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 30 * state.grid.cols + 30; // world (305,305)
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.6;
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 0.3, // not due yet
      bubbleSeeds: [],
    });

    updateClouds(state, 0.1); // tickTimer -> 0.2, not due
    expect(state.grid.growth[idx]).toBeCloseTo(0.6, 5);

    updateClouds(state, 0.25); // tickTimer -> -0.05, due — ticks once
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('removes a cloud once its life runs out', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 0.1,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5, // won't tick this call
      bubbleSeeds: [],
    });

    updateClouds(state, 0.2);

    expect(state.clouds).toHaveLength(0);
  });

  it('still ages the cloud without a grid — clearAt just no-ops safely', () => {
    const state = freshState();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 0,
      bubbleSeeds: [],
    });

    expect(() => updateClouds(state, 0.1)).not.toThrow();
    expect(state.clouds).toHaveLength(1);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Lingering
  // Spores' outward drift, distinct from Homing's toward-the-threat drift.
  describe('driftOutward (Lingering Spores)', () => {
    it('drifts a cloud along its own driftAngle over time', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push({
        x: 300,
        y: 300,
        radius: 30,
        life: 3.4,
        maxLife: 3.4,
        dmgPerSec: 10,
        color: '#8aff4d',
        tickTimer: 5,
        bubbleSeeds: [],
        driftOutward: 20,
        driftAngle: 0,
      });

      updateClouds(state, 0.5);

      const c = state.clouds[0]!;
      const distFromOrigin = Math.hypot(c.x - 300, c.y - 300);
      expect(distFromOrigin).toBeGreaterThan(0);
    });

    // 2026-08-10 bug fix regression guard: the original implementation
    // derived direction from atan2(c.y - originY, c.x - originX), which
    // is atan2(0, 0) = 0 at spawn — every cloud drifted due east
    // regardless of the extension's own "outward" claim. Two clouds with
    // different driftAngle values must end up in genuinely different
    // places, not just "moved."
    it('two clouds with different driftAngle values drift in different directions', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push(
        {
          x: 300,
          y: 300,
          radius: 30,
          life: 3.4,
          maxLife: 3.4,
          dmgPerSec: 10,
          color: '#8aff4d',
          tickTimer: 5,
          bubbleSeeds: [],
          driftOutward: 20,
          driftAngle: 0, // east
        },
        {
          x: 300,
          y: 300,
          radius: 30,
          life: 3.4,
          maxLife: 3.4,
          dmgPerSec: 10,
          color: '#8aff4d',
          tickTimer: 5,
          bubbleSeeds: [],
          driftOutward: 20,
          driftAngle: Math.PI, // west
        },
      );

      updateClouds(state, 0.5);

      const [east, west] = state.clouds;
      expect(east!.x).toBeGreaterThan(300);
      expect(west!.x).toBeLessThan(300);
    });

    it('does not drift a cloud with no driftOutward set (no regression)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push({
        x: 300,
        y: 300,
        radius: 30,
        life: 3.4,
        maxLife: 3.4,
        dmgPerSec: 10,
        color: '#8aff4d',
        tickTimer: 5,
        bubbleSeeds: [],
      });

      updateClouds(state, 0.5);

      expect(state.clouds[0]!.x).toBe(300);
      expect(state.clouds[0]!.y).toBe(300);
    });
  });
});
