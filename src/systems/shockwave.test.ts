import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { updateShockwaveRings } from './shockwave';

function makeTestGrid(): Grid {
  const size = 3600;
  return {
    cols: 60,
    rows: 60,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size).fill(0.5),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
    maxRange: 500,
    perimeter: 20,
  };
}

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S2.1, S8): the
// ring's core invariant, tested as an outcome rather than by inspecting
// the mechanism — a cell anywhere inside the ring's eventual reach is
// damaged exactly once across the ring's WHOLE life, never re-hit as the
// band keeps advancing past it.
describe('updateShockwaveRings', () => {
  it('damages a cell exactly once across the whole life of an outward ring', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const grid = state.grid;
    const cx = 300;
    const cy = 300;
    // A cell 150px out — well inside the ring's eventual 200px reach.
    const gx = Math.floor((cx + 150) / grid.cellSize);
    const gy = Math.floor(cy / grid.cellSize);
    const idx = gy * grid.cols + gx;

    state.shockwaveRings.push({
      x: cx,
      y: cy,
      bornAt: 0,
      damagedTo: 40,
      radius: 40,
      startRadius: 40,
      maxRadius: 200,
      speed: 260,
      power: 200,
      color: '#7fd8ff',
    });

    // Advance in several small steps rather than one big one — this is
    // exactly the scenario a "damage a disc at the current radius" bug
    // would fail: the cell would take a fresh hit on every step once the
    // ring's growing radius has passed it.
    let removedAfterFirstHit = -1;
    for (let i = 0; i < 40; i++) {
      const before = grid.growth[idx]!;
      updateShockwaveRings(state, 0.05);
      const after = grid.growth[idx]!;
      if (before !== after && removedAfterFirstHit === -1) {
        removedAfterFirstHit = before - after;
      } else if (removedAfterFirstHit !== -1) {
        // Already hit once — must never change again.
        expect(after).toBe(before);
      }
    }

    expect(removedAfterFirstHit).toBeGreaterThan(0); // it WAS hit at some point
    expect(state.shockwaveRings).toHaveLength(0); // and the ring is gone once it reaches maxRadius
  });

  it('an inward (Implosion) ring stops AT its start radius, never inside it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const startRadius = 50; // e.g. shockwaveStartRadius(perimeter=20)

    state.shockwaveRings.push({
      x: 300,
      y: 300,
      bornAt: 0,
      damagedTo: 200,
      radius: 200,
      startRadius,
      maxRadius: 200,
      speed: 260,
      power: 100,
      color: '#7fd8ff',
      inward: true,
    });

    for (let i = 0; i < 40; i++) updateShockwaveRings(state, 0.05);

    // The ring must be gone (reached its floor and terminated) — if it
    // were still present, or if any bookkeeping let radius dip below
    // startRadius, that would mean it swept space inside the perimeter,
    // which docs/DECISIONS.md #16's tower-centered-radius rule forbids.
    expect(state.shockwaveRings).toHaveLength(0);
  });

  it('a higher-power ring removes more mass from the same cell than a lower-power one', () => {
    function totalRemoved(power: number): number {
      const state = freshState();
      state.grid = makeTestGrid();
      state.shockwaveRings.push({
        x: 300,
        y: 300,
        bornAt: 0,
        damagedTo: 40,
        radius: 40,
        startRadius: 40,
        maxRadius: 60,
        speed: 260,
        power,
        color: '#7fd8ff',
      });
      let removed = 0;
      const grid = state.grid;
      const before = grid.growth.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 10; i++) updateShockwaveRings(state, 0.05);
      const after = grid.growth.reduce((a, b) => a + b, 0);
      removed = before - after;
      return removed;
    }

    expect(totalRemoved(300)).toBeGreaterThan(totalRemoved(100));
  });

  it('does not start damaging a ring scheduled in the future (Second Wave) until its bornAt time', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const grid = state.grid;
    const idx = 30 * grid.cols + 34; // ~40px east of (300,300)
    state.time = 0;

    state.shockwaveRings.push({
      x: 300,
      y: 300,
      bornAt: 5, // well in the future
      damagedTo: 40,
      radius: 40,
      startRadius: 40,
      maxRadius: 60,
      speed: 260,
      power: 300,
      color: '#7fd8ff',
    });

    const before = grid.growth[idx]!;
    updateShockwaveRings(state, 0.05);
    expect(grid.growth[idx]).toBe(before); // untouched — bornAt hasn't arrived
    expect(state.shockwaveRings).toHaveLength(1); // still pending, not dropped
  });
});
