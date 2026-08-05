import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { updateChainWeapon } from './chain';

function makeTestGrid(): Grid {
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
    safeRadius: 20,
  };
}

function revealCellEastOfTower(grid: Grid, towerX: number, towerY: number): void {
  const cx = Math.floor((towerX + 40) / grid.cellSize);
  const cy = Math.floor(towerY / grid.cellSize);
  const idx = cy * grid.cols + cx;
  grid.threshold[idx] = 0.1;
  grid.growth[idx] = 0.9;
}

describe('updateChainWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateChainWeapon(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires a chain projectile at the nearest frontier point, with hops and decayable damage', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.chain = 3; // chainCount(3) = 2
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateChainWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('chain');
    if (p.type !== 'chain') return;
    expect(p.x).toBe(150);
    expect(p.y).toBe(150);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.hopsLeft).toBe(2);
    expect(p.visited.size).toBe(0);
    expect(p.legStart).toEqual({ x: 150, y: 150 });
    expect(state.weaponTimers.chain).toBeGreaterThan(0);
  });

  it('does not fire again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.chain = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateChainWeapon(state, 0.016);
    updateChainWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
  });
});
