import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier, nearestFrontierPoint } from './frontier';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 0,
    y: 0,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 15,
    speed: 45,
    phase: 'active',
    phaseTimer: 0,
    seeds: [],
    ...overrides,
  };
}

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 900;
  return {
    cols: 30,
    rows: 30,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    maxRange: 200,
    perimeter: 60,
    ...overrides,
  };
}

describe('computeFrontier / nearestFrontierPoint', () => {
  it('returns null when nothing in the field is revealed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    computeFrontier(state);
    expect(nearestFrontierPoint(state)).toBeNull();
  });

  it('finds the nearest revealed cell along its exact ray direction', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20; // round number so the raycast's fixed steps land cleanly
    // Sector 0 casts due east (angle 0). Reveal a cell 40 world units out
    // along that ray so the frontier's sector-0 entry lands there exactly.
    const cx = Math.floor(190 / state.grid.cellSize);
    const cy = Math.floor(150 / state.grid.cellSize);
    const idx = cy * state.grid.cols + cx;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.9;

    computeFrontier(state);

    expect(state.frontier).not.toBeNull();
    expect(state.frontier![0]).toBeCloseTo(40, 5);
    // A sector pointing due west sees nothing, so it reports maxRange.
    expect(state.frontier![24]).toBe(state.grid.maxRange);

    const nearest = nearestFrontierPoint(state);
    expect(nearest).not.toBeNull();
    expect(nearest!.dist).toBeCloseTo(40, 5);
    expect(nearest!.x).toBeCloseTo(190, 5);
    expect(nearest!.y).toBeCloseTo(150, 5);
  });

  it('can target a breach inside the safe radius', () => {
    // Since docs/DECISIONS.md #15 lets ambient growth creep
    // inside perimeter, the raycast must be able to see and target a
    // breach there too — starting it at perimeter (the old behavior)
    // would make any breach structurally unkillable, since weapons could
    // never aim at it. See the frontier.ts header comment.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20;
    // Reveal a cell inside perimeter (60) but well outside the tower's
    // own radius (20) — a plausible breach location.
    const cx = Math.floor(190 / state.grid.cellSize);
    const cy = Math.floor(150 / state.grid.cellSize);
    const idx = cy * state.grid.cols + cx;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.9;

    computeFrontier(state);
    const nearest = nearestFrontierPoint(state);
    expect(nearest).not.toBeNull();
    expect(nearest!.dist).toBeLessThan(state.grid.perimeter);
  });

  describe('coagulant targeting (Decision 45 — nearest-thing-wins, unchanged)', () => {
    it('targets a coagulant when nothing in the field is revealed', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.coagulants = [makeCoagulant({ x: 250, y: 150, radius: 15 })];
      computeFrontier(state);

      const nearest = nearestFrontierPoint(state);

      expect(nearest).not.toBeNull();
      expect(nearest!.x).toBe(250);
      expect(nearest!.y).toBe(150);
    });

    it('prefers a closer coagulant over a farther revealed frontier cell', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.tower.radius = 20;
      const cx = Math.floor(190 / state.grid.cellSize);
      const cy = Math.floor(150 / state.grid.cellSize);
      state.grid.threshold[cy * state.grid.cols + cx] = 0.1;
      state.grid.growth[cy * state.grid.cols + cx] = 0.9; // frontier ~40px out
      computeFrontier(state);
      state.coagulants = [makeCoagulant({ x: 155, y: 150, radius: 2 })]; // surface ~3px out — much closer

      const nearest = nearestFrontierPoint(state);

      expect(nearest).not.toBeNull();
      expect(nearest!.x).toBe(155);
      expect(nearest!.y).toBe(150);
    });

    it('prefers a closer revealed frontier cell over a farther coagulant', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.tower.radius = 20;
      const cx = Math.floor(170 / state.grid.cellSize);
      const cy = Math.floor(150 / state.grid.cellSize);
      state.grid.threshold[cy * state.grid.cols + cx] = 0.1;
      state.grid.growth[cy * state.grid.cols + cx] = 0.9; // frontier ~20px out
      computeFrontier(state);
      state.coagulants = [makeCoagulant({ x: 400, y: 150, radius: 15 })]; // surface ~235px out

      const nearest = nearestFrontierPoint(state);

      expect(nearest).not.toBeNull();
      expect(nearest!.x).toBeCloseTo(170, 5);
    });

    it('compares by surface distance, not center distance — a big body counts as closer', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      // Center is far, but the body is huge, so its surface is near.
      state.coagulants = [makeCoagulant({ x: 250, y: 150, radius: 90 })];
      computeFrontier(state);

      const nearest = nearestFrontierPoint(state);

      expect(nearest).not.toBeNull();
      expect(nearest!.dist).toBeCloseTo(10, 5); // 100px center distance - 90px radius
    });

    it('ignores a coagulant already reduced to 0 mass', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.coagulants = [makeCoagulant({ x: 250, y: 150, mass: 0 })];
      computeFrontier(state); // vacuous otherwise — frontier defaults to null, which alone returns null

      expect(nearestFrontierPoint(state)).toBeNull();
    });

    it("ignores a 'forming' coagulant — it hasn't detached from the field yet (2026-08-06 follow-up session)", () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.coagulants = [makeCoagulant({ x: 250, y: 150, phase: 'forming', phaseTimer: 1 })];
      computeFrontier(state); // vacuous otherwise — frontier defaults to null, which alone returns null

      expect(nearestFrontierPoint(state)).toBeNull();
    });

    it("targets a coagulant once it turns 'active', at the same spot it was ignored while forming", () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.coagulants = [makeCoagulant({ x: 250, y: 150, phase: 'active', phaseTimer: 0 })];
      computeFrontier(state);

      const nearest = nearestFrontierPoint(state);

      expect(nearest).not.toBeNull();
      expect(nearest!.x).toBe(250);
      expect(nearest!.y).toBe(150);
    });
  });
});
