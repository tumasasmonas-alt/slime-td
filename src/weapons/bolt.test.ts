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

  // Phase 6A-1: Overclock is a per-weapon socketed gem now
  // (systems/weaponMods.ts), not a global atkSpeed passive.
  it('fires faster with an Overclock gem socketed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'overclock' }] };
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);

    // boltCooldown(1) / (1 + 0.4) — Overclock's +40% rate delta
    expect(state.weaponTimers.bolt).toBeCloseTo(0.55 / 1.4, 5);
  });

  it('an Overclock gem socketed in a DIFFERENT weapon has no effect on bolt', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    state.weapons.chain = 1;
    state.weaponSockets.chain = { extensions: [], gems: [{ id: 1, kind: 'overclock' }] };
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);

    expect(state.weaponTimers.bolt).toBeCloseTo(0.55, 5);
  });

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S5): emission
  // multiplication — Multishot/Formation.
  describe('Multishot / Formation', () => {
    it('fires more than one projectile with a Multishot gem socketed', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 1;
      state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'multishot' }] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateBoltWeapon(state, 0.016);

      expect(state.projectiles.length).toBeGreaterThan(1);
    });

    it('splits power across the extra shots rather than multiplying total damage', () => {
      const withGem = freshState();
      withGem.grid = makeTestGrid();
      withGem.tower.x = 150;
      withGem.tower.y = 150;
      withGem.weapons.bolt = 1;
      withGem.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'multishot' }] };
      revealCellEastOfTower(withGem.grid, withGem.tower.x, withGem.tower.y);
      computeFrontier(withGem);
      updateBoltWeapon(withGem, 0.016);
      const totalWithGem = withGem.projectiles.reduce((sum, p) => sum + p.dmg, 0);

      const without = freshState();
      without.grid = makeTestGrid();
      without.tower.x = 150;
      without.tower.y = 150;
      without.weapons.bolt = 1;
      revealCellEastOfTower(without.grid, without.tower.x, without.tower.y);
      computeFrontier(without);
      updateBoltWeapon(without, 0.016);
      const totalWithoutGem = without.projectiles.reduce((sum, p) => sum + p.dmg, 0);

      expect(totalWithGem).toBeCloseTo(totalWithoutGem, 5);
    });

    it('Formation fires the same shot count as plain Multishot, deterministically spread', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 1;
      state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'formation' }] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateBoltWeapon(state, 0.016);

      expect(state.projectiles.length).toBeGreaterThan(1);
    });
  });

  it('Pierce lets a bolt survive its first impact instead of despawning', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'pierce' }] };
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);

    expect(state.projectiles[0]!.pierce).toBeGreaterThan(0);
  });
});
