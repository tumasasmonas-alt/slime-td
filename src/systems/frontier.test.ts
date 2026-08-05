import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier, nearestFrontierPoint } from './frontier';

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
    maxRange: 200,
    safeRadius: 60,
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
    // inside safeRadius, the raycast must be able to see and target a
    // breach there too — starting it at safeRadius (the old behavior)
    // would make any breach structurally unkillable, since weapons could
    // never aim at it. See the frontier.ts header comment.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20;
    // Reveal a cell inside safeRadius (60) but well outside the tower's
    // own radius (20) — a plausible breach location.
    const cx = Math.floor(190 / state.grid.cellSize);
    const cy = Math.floor(150 / state.grid.cellSize);
    const idx = cy * state.grid.cols + cx;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.9;

    computeFrontier(state);
    const nearest = nearestFrontierPoint(state);
    expect(nearest).not.toBeNull();
    expect(nearest!.dist).toBeLessThan(state.grid.safeRadius);
  });
});
