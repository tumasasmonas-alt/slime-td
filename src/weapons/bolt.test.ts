import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { updateBoltWeapon } from './bolt';

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
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
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

describe('updateBoltWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateBoltWeapon(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires at the nearest frontier point once its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    expect(state.weaponTimers.bolt).toBe(0);
    updateBoltWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('bolt');
    expect(p.x).toBe(150);
    expect(p.y).toBe(150);
    expect(p.vx).toBeGreaterThan(0); // aims east, toward the revealed cell
    expect(Math.abs(p.vy)).toBeLessThan(1);
    expect(state.weaponTimers.bolt).toBeGreaterThan(0); // cooldown now set
  });

  it('does not fire again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);
    updateBoltWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
  });

  it('fires faster with Overclock (atkSpeed) leveled', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    state.passives.atkSpeed = 5;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);

    // boltCooldown(1) / atkSpeedMult with atkSpeed=5 -> 0.55 / (1 + 5*0.09)
    expect(state.weaponTimers.bolt).toBeCloseTo(0.55 / (1 + 5 * 0.09), 5);
  });
});
