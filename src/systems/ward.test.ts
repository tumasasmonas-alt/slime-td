import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { updateWardPulse } from './ward';

function makeTestGrid(): Grid {
  const size = 400;
  return {
    cols: 20,
    rows: 20,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 300,
    safeRadius: 20,
  };
}

describe('updateWardPulse', () => {
  it('does nothing without the Ward Pulse passive', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.growth[0] = 0.5;
    updateWardPulse(state, 5);
    expect(state.grid.growth[0]).toBe(0.5);
  });

  it('purges density right at the core once leveled, then waits out its own interval', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.passives.ward = 1;
    state.tower.x = 100;
    state.tower.y = 100;
    const i = 10 * state.grid.cols + 10; // the cell the tower sits in
    state.grid.growth[i] = 0.5;

    // wardTimer starts at 0, so the very first call always fires.
    updateWardPulse(state, 0.1);
    const afterFirstPulse = state.grid.growth[i]!;
    expect(afterFirstPulse).toBeLessThan(0.5);

    // Nowhere near the freshly-reset 1.1s interval — no second pulse yet.
    updateWardPulse(state, 0.1);
    expect(state.grid.growth[i]).toBe(afterFirstPulse);
  });
});
