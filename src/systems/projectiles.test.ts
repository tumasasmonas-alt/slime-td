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

describe('updateProjectiles — missile', () => {
  it('steers toward its target point and keeps flying while short of it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({
      type: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetNode: null,
      targetPoint: { x: 500, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.vx).toBeGreaterThan(0); // steering toward +x
    expect(p.x).toBeGreaterThan(300);
  });

  it('detonates and clears density once it reaches its target point', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = revealAt(state.grid, 305, 300, 0.6); // near the target, within splash
    state.projectiles.push({
      type: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetNode: null,
      targetPoint: { x: 302, y: 300 }, // already within MISSILE_REACH_DIST
    });

    updateProjectiles(state, 0.001); // negligible travel — reach check dominates

    expect(state.projectiles).toHaveLength(0);
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('detonates early on touching revealed tissue, before reaching its target', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // where this frame's step will land
    state.projectiles.push({
      type: 'missile',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetNode: null,
      targetPoint: { x: 1000, y: 300 }, // far beyond the revealed wall
    });

    // A small dt so this frame's step (vx*dt = 6px) lands inside the
    // revealed cell rather than overshooting past it — the check is
    // "revealed at the new position," not "did it cross revealed space
    // somewhere along the way."
    updateProjectiles(state, 0.02);

    expect(state.projectiles).toHaveLength(0);
  });

  it('homes on a live target node in preference to its stale target point', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const node = {
      x: 300,
      y: 500,
      hp: 100,
      maxHp: 100,
      radius: 90,
      strength: 1,
      hitRadius: 16,
      dead: false,
      pulseSeed: 0,
    };
    state.projectiles.push({
      type: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetNode: node,
      targetPoint: { x: 500, y: 300 }, // stale — should be ignored while the node is alive
    });

    updateProjectiles(state, 0.1);

    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.vy).toBeGreaterThan(0); // steering toward the node (+y), not the stale point (+x)
  });

  it('falls back to the target point once its target node has died', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const node = {
      x: 300,
      y: 500,
      hp: 0,
      maxHp: 100,
      radius: 90,
      strength: 1,
      hitRadius: 16,
      dead: true,
      pulseSeed: 0,
    };
    state.projectiles.push({
      type: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetNode: node,
      targetPoint: { x: 500, y: 300 },
    });

    updateProjectiles(state, 0.1);

    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.vx).toBeGreaterThan(0); // steering toward the target point (+x), node is dead
    expect(p.vy).toBe(0);
  });
});
