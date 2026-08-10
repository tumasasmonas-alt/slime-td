import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { fissionCount } from '../tuning/weapons';
import { updateFissionWeapon } from './fission';

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

describe('updateFissionWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateFissionWeapon(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires at the frontier, carrying fissionCount(lvl) - 1 as its clusterCount', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.tower.radius = 20;
    state.weapons.fission = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateFissionWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('fission');
    if (p.type !== 'fission') return;
    expect(p.clusterCount).toBe(fissionCount(1) - 1);
    expect(p.childPowerShare).toBe(1); // full power, not Missile's own 0.25 share
    expect(state.weaponTimers.fission).toBeGreaterThan(0);
  });

  it('a higher level carries more clusterCount, reading as "more bombs"', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.fission = 8;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateFissionWeapon(state, 0.016);

    const p = state.projectiles[0]!;
    if (p.type !== 'fission') throw new Error('expected a fission projectile');
    expect(p.clusterCount).toBeGreaterThan(fissionCount(1) - 1);
  });

  describe('extensions', () => {
    it('Wider Scatter increases scatterDist via mods.area', () => {
      const withoutExt = freshState();
      withoutExt.grid = makeTestGrid();
      withoutExt.tower.x = 150;
      withoutExt.tower.y = 150;
      withoutExt.weapons.fission = 1;
      revealCellEastOfTower(withoutExt.grid, withoutExt.tower.x, withoutExt.tower.y);
      computeFrontier(withoutExt);
      updateFissionWeapon(withoutExt, 0.016);
      const baseScatter = (withoutExt.projectiles[0] as { scatterDist?: number }).scatterDist!;

      const withExt = freshState();
      withExt.grid = makeTestGrid();
      withExt.tower.x = 150;
      withExt.tower.y = 150;
      withExt.weapons.fission = 1;
      withExt.weaponSockets.fission = { extensions: [{ id: 1, weaponKey: 'fission', kind: 'widerScatter', level: 3 }], gems: [] };
      revealCellEastOfTower(withExt.grid, withExt.tower.x, withExt.tower.y);
      computeFrontier(withExt);
      updateFissionWeapon(withExt, 0.016);
      const widerScatter = (withExt.projectiles[0] as { scatterDist?: number }).scatterDist!;

      expect(widerScatter).toBeGreaterThan(baseScatter);
    });

    it('Chain Fission tags the shot with chainFissionLvl for systems/projectiles.ts to read', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.fission = 1;
      state.weaponSockets.fission = { extensions: [{ id: 1, weaponKey: 'fission', kind: 'chainFission', level: 2 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateFissionWeapon(state, 0.016);

      const p = state.projectiles[0]!;
      if (p.type !== 'fission') throw new Error('expected a fission projectile');
      expect(p.chainFissionLvl).toBe(2);
      expect(p.fissionGen).toBe(0);
    });

    it('Sticky attaches a stickyBurn descriptor to every shot', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.fission = 1;
      state.weaponSockets.fission = { extensions: [{ id: 1, weaponKey: 'fission', kind: 'sticky', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateFissionWeapon(state, 0.016);

      const p = state.projectiles[0]!;
      if (p.type !== 'fission') throw new Error('expected a fission projectile');
      expect(p.stickyBurn).toBeDefined();
      expect(p.stickyBurn!.dmgPerSec).toBeGreaterThan(0);
    });
  });
});
