import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { clearAt } from './clear';

// Synthetic small grid, matching the fixture pattern used elsewhere
// (grid.test.ts, systems/growth.test.ts) — independent of the real
// reaction-diffusion output.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 400;
  return {
    cols: 20,
    rows: 20,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size).fill(0.1),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 300,
    safeRadius: 20,
    ...overrides,
  };
}

describe('clearAt', () => {
  it('does nothing and returns 0 when there is no grid yet', () => {
    const state = freshState();
    expect(clearAt(state, 0, 0, 10)).toBe(0);
  });

  it('removes more density near the hit center than at the edge of the radius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const centerIdx = 10 * state.grid.cols + 10; // world (105,105)
    const edgeIdx = 10 * state.grid.cols + 12; // world (125,105), 20px east
    state.grid.growth[centerIdx] = 0.6;
    state.grid.growth[edgeIdx] = 0.6;

    // Note: clearAt scales the requested radius by local density at the
    // hit origin (clamp(1.25-density, 0.4, 1.25)) — at density 0.6 that's
    // 40 * 0.65 = 26px, so the edge cell at 20px is inside it, not the
    // requested 40px.
    clearAt(state, 105, 105, 50, { radiusPx: 40 });

    expect(state.grid.growth[centerIdx]).toBe(0);
    expect(state.grid.growth[edgeIdx]).toBeGreaterThan(0);
    expect(state.grid.growth[edgeIdx]).toBeLessThan(0.6);
  });

  it('lets sparse tissue clear in one chunk while mature tissue only chips down', () => {
    // Same power, same radius — density itself is what resists the hit.
    // See archive/PROTOTYPE_HANDOFF.md "Density -> toughness".
    const sparse = freshState();
    sparse.grid = makeTestGrid();
    const sparseIdx = 10 * sparse.grid.cols + 10;
    sparse.grid.growth[sparseIdx] = 0.05;

    const dense = freshState();
    dense.grid = makeTestGrid();
    const denseIdx = 10 * dense.grid.cols + 10;
    dense.grid.growth[denseIdx] = 0.95;

    clearAt(sparse, 105, 105, 10, { radiusPx: 15 });
    clearAt(dense, 105, 105, 10, { radiusPx: 15 });

    const sparseFractionRemoved = 1 - sparse.grid.growth[sparseIdx]! / 0.05;
    const denseFractionRemoved = 1 - dense.grid.growth[denseIdx]! / 0.95;

    expect(sparseFractionRemoved).toBeCloseTo(1, 5); // fully cleared
    expect(denseFractionRemoved).toBeLessThan(0.15); // only chipped
    expect(sparseFractionRemoved).toBeGreaterThan(denseFractionRemoved);
  });

  it('marks a cell dirty only on the hit that actually changes its bucket', () => {
    const state = freshState();
    state.grid = makeTestGrid({ threshold: new Float32Array(400).fill(0) });
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 1;
    state.grid.bucket[idx] = 5; // top bucket, matching growth=1 over threshold=0

    // A tiny hit barely dents growth — stays in the top bucket.
    clearAt(state, 105, 105, 0.001, { radiusPx: 15 });
    expect(state.dirty.has(idx)).toBe(false);

    // A real hit drops it out of the top bucket.
    clearAt(state, 105, 105, 50, { radiusPx: 15 });
    expect(state.dirty.has(idx)).toBe(true);
  });

  it('drops a gem once total removed density clears the drop threshold', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 0.6;

    clearAt(state, 105, 105, 50, { radiusPx: 15 });

    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]!.xp).toBeGreaterThan(0);
    expect(state.particles.length).toBeGreaterThan(0);
  });

  it('does not drop a gem for a trivial hit that removes almost nothing', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 0.01;

    clearAt(state, 105, 105, 1, { radiusPx: 15 });

    expect(state.gems).toHaveLength(0);
  });

  it('damages a growth node within radius + hitRadius of the hit', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodes.push({
      x: 105,
      y: 105,
      hp: 100,
      maxHp: 100,
      radius: 90,
      strength: 1,
      hitRadius: 16,
      dead: false,
      pulseSeed: 0,
    });

    clearAt(state, 105, 105, 30, { radiusPx: 20 });

    expect(state.nodes[0]!.hp).toBe(70); // hp -= power, not scaled by falloff/resistance
    expect(state.nodes[0]!.dead).toBe(false);
  });

  it('destroys a node once a hit brings its hp to 0 or below', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodes.push({
      x: 105,
      y: 105,
      hp: 10,
      maxHp: 100,
      radius: 90,
      strength: 1,
      hitRadius: 16,
      dead: false,
      pulseSeed: 0,
    });

    clearAt(state, 105, 105, 30, { radiusPx: 20 });

    expect(state.nodes[0]!.dead).toBe(true);
    expect(state.nodesPurged).toBe(1);
    expect(state.tower.xp).toBeGreaterThan(0);
  });

  it('leaves a node untouched when the hit lands outside radius + hitRadius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodes.push({
      x: 195,
      y: 105,
      hp: 100,
      maxHp: 100,
      radius: 5,
      strength: 1,
      hitRadius: 5,
      dead: false,
      pulseSeed: 0,
    });

    clearAt(state, 105, 105, 30, { radiusPx: 20 });

    expect(state.nodes[0]!.hp).toBe(100);
  });

  it('freezes cells within the hit radius when a freeze duration is given', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const nearIdx = 10 * state.grid.cols + 10; // world (105,105), at the hit
    const farIdx = 10 * state.grid.cols + 19; // world (195,105), far outside a 15px radius

    clearAt(state, 105, 105, 10, { radiusPx: 15, freezeDuration: 1.5 });

    expect(state.grid.frozen[nearIdx]).toBe(1.5);
    expect(state.grid.frozen[farIdx]).toBe(0);
  });
});
