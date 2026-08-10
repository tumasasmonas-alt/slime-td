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
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
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

describe('updateMissileWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateMissileWeapon(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires at the frontier, starting stationary', () => {
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
    expect(p.targetPoint).toEqual({ x: 190, y: 150 });
    expect(state.weaponTimers.missile).toBeGreaterThan(0);
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

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Missile's
  // four extensions. Proximity Fuse and Cluster Warhead's own detonation
  // behaviour is exercised in systems/projectiles.test.ts, against the
  // fields checked here.
  describe('extensions', () => {
    it('Bunker Buster sets armorScaled on the spawned missile', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.missile = 1;
      state.weaponSockets.missile = { extensions: [{ id: 1, weaponKey: 'missile', kind: 'bunkerBuster', level: 2 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateMissileWeapon(state, 0.016);

      const p = state.projectiles[0]!;
      if (p.type !== 'missile') throw new Error('expected a missile');
      expect(p.armorScaled).toBeCloseTo(0.12, 5);
    });

    it('Proximity Fuse sets proximityFuseDist on the spawned missile', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.missile = 1;
      state.weaponSockets.missile = { extensions: [{ id: 1, weaponKey: 'missile', kind: 'proximityFuse', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateMissileWeapon(state, 0.016);

      const p = state.projectiles[0]!;
      if (p.type !== 'missile') throw new Error('expected a missile');
      expect(p.proximityFuseDist).toBe(35);
    });

    it('Cluster Warhead sets clusterCount on the spawned missile', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.missile = 1;
      state.weaponSockets.missile = { extensions: [{ id: 1, weaponKey: 'missile', kind: 'clusterWarhead', level: 3 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateMissileWeapon(state, 0.016);

      const p = state.projectiles[0]!;
      if (p.type !== 'missile') throw new Error('expected a missile');
      expect(p.clusterCount).toBe(5);
    });

    it('Salvo fires extra missiles, sequenced with a later armAt', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.missile = 1;
      state.weaponSockets.missile = { extensions: [{ id: 1, weaponKey: 'missile', kind: 'salvo', level: 3 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateMissileWeapon(state, 0.016);

      // Level 3 = +2 missiles (SALVO_BONUS), on top of the normal one.
      expect(state.projectiles).toHaveLength(3);
      const armTimes = state.projectiles.map((p) => (p.type === 'missile' ? p.armAt : -1)).sort((a, b) => a - b);
      expect(armTimes[0]).toBe(0); // the original shot, armed immediately
      expect(armTimes[1]).toBeGreaterThan(0);
      expect(armTimes[2]).toBeGreaterThan(armTimes[1]!);
    });
  });
});
