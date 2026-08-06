import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { updatePoisonWeapon } from './poison';

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
    perimeter: 20,
  };
}

function revealCellEastOfTower(grid: Grid, towerX: number, towerY: number): void {
  const cx = Math.floor((towerX + 40) / grid.cellSize);
  const cy = Math.floor(towerY / grid.cellSize);
  const idx = cy * grid.cols + cx;
  grid.threshold[idx] = 0.1;
  grid.growth[idx] = 0.9;
}

describe('updatePoisonWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updatePoisonWeapon(state, 1);
    expect(state.clouds).toHaveLength(0);
  });

  it('drops a cloud at the nearest frontier point', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20; // round number so the raycast's fixed steps land cleanly
    state.weapons.poison = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updatePoisonWeapon(state, 0.016);

    expect(state.clouds).toHaveLength(1);
    const cloud = state.clouds[0]!;
    expect(cloud.x).toBeCloseTo(190, 5);
    expect(cloud.y).toBeCloseTo(150, 5);
    expect(cloud.bubbleSeeds).toHaveLength(4);
    expect(state.weaponTimers.poison).toBeGreaterThan(0);
  });

  it('does not drop another cloud before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.poison = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updatePoisonWeapon(state, 0.016);
    updatePoisonWeapon(state, 0.016);

    expect(state.clouds).toHaveLength(1);
  });
});
