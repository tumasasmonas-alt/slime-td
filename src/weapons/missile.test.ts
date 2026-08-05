import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { updateMissileWeapon } from './missile';

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

describe('updateMissileWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateMissileWeapon(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires at the frontier with no target node, starting stationary', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20;
    state.weapons.missile = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateMissileWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.x).toBe(150);
    expect(p.y).toBe(150);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
    expect(p.targetNode).toBeNull();
    expect(p.targetPoint).toEqual({ x: 190, y: 150 });
    expect(state.weaponTimers.missile).toBeGreaterThan(0);
  });

  it('prefers a live growth node and threads it as the actual target', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.missile = 1;
    const node = {
      x: 50,
      y: 50,
      hp: 100,
      maxHp: 100,
      radius: 90,
      strength: 1,
      hitRadius: 16,
      dead: false,
      pulseSeed: 0,
    };
    state.nodes.push(node);

    updateMissileWeapon(state, 0.016);

    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.targetNode).toBe(node);
    expect(p.targetPoint).toEqual({ x: 50, y: 50 });
  });

  it('does not fire again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.missile = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateMissileWeapon(state, 0.016);
    updateMissileWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
  });
});
