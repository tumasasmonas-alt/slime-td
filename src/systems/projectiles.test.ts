import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import { updateProjectiles } from './projectiles';

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
    maxRange: 300,
    safeRadius: 20,
    ...overrides,
  };
}

function revealAt(grid: Grid, x: number, y: number, density: number): number {
  const { cx, cy } = worldToCell(grid, x, y);
  const i = gIdx(grid, cx, cy);
  grid.threshold[i] = 0.1;
  grid.growth[i] = density;
  return i;
}

describe('updateProjectiles — bolt', () => {
  it('travels and is removed once its life expires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 0.05 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('is removed once it travels off the world bounds', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', x: -100, y: 300, vx: -1000, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('clears density and is consumed on hitting revealed tissue', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 30, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('keeps traveling while nothing revealed is in its path', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.x).toBeCloseTo(301, 5);
  });
});

describe('updateProjectiles — chain', () => {
  it('hops to a nearby revealed cluster, decaying damage, when one exists', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // first hit
    revealAt(state.grid, 340, 300, 0.6); // next hop target, within CHAIN_HOP_SEARCH_RADIUS (150)
    state.projectiles.push({
      type: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 2,
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('chain');
    if (p.type !== 'chain') return;
    expect(p.hopsLeft).toBe(1);
    expect(p.dmg).toBeCloseTo(20 * 0.82, 5);
    expect(p.visited.size).toBe(1);
    expect(state.chainFx.length).toBeGreaterThan(0);
  });

  it('is consumed once it runs out of hops', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    revealAt(state.grid, 340, 300, 0.6);
    state.projectiles.push({
      type: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 1, // this hit is its last
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('is consumed when hops remain but no further target is in range', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // only this one revealed, nothing else nearby
    state.projectiles.push({
      type: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 3,
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });
});
