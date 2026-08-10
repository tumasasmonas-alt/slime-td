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

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Poison's
  // four extensions.
  describe('extensions', () => {
    it('Corrosive sets armorShred on the dropped cloud', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'corrosive', level: 2 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updatePoisonWeapon(state, 0.016);

      expect(state.clouds[0]!.armorShred).toBeCloseTo(0.45, 5);
    });

    it('Lingering Spores sets driftOutward and a driftAngle on the cloud', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'lingeringSpores', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updatePoisonWeapon(state, 0.016);

      const cloud = state.clouds[0]!;
      expect(cloud.driftOutward).toBe(12);
      expect(cloud.driftAngle).toBeGreaterThanOrEqual(0);
      expect(cloud.driftAngle).toBeLessThan(Math.PI * 2);
    });

    // 2026-08-10 bug fix regression guard — see systems/clouds.test.ts's
    // matching test for the full story: the old implementation derived
    // direction from the cloud's own position relative to an "origin"
    // that was always identical to it at spawn, so every cloud drifted
    // due east no matter what. Firing the weapon twice must not produce
    // the same angle twice in a row (astronomically unlikely by chance).
    it('Lingering Spores does not give every cloud the same drift angle', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'lingeringSpores', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      const angles = new Set<number>();
      for (let i = 0; i < 20; i++) {
        state.weaponTimers.poison = 0;
        updatePoisonWeapon(state, 0.016);
        angles.add(state.clouds[state.clouds.length - 1]!.driftAngle!);
      }

      expect(angles.size).toBeGreaterThan(1);
    });

    it('Lingering Spores extends the cloud’s lifetime (mods channel)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'lingeringSpores', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      const plain = freshState();
      plain.grid = makeTestGrid();
      plain.tower.x = 150;
      plain.tower.y = 150;
      plain.weapons.poison = 1;
      revealCellEastOfTower(plain.grid, plain.tower.x, plain.tower.y);
      computeFrontier(plain);

      updatePoisonWeapon(state, 0.016);
      updatePoisonWeapon(plain, 0.016);

      expect(state.clouds[0]!.life).toBeGreaterThan(plain.clouds[0]!.life);
    });

    it('Twin Canister drops a second, smaller, longer-lived cloud', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'twinCanister', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updatePoisonWeapon(state, 0.016);

      expect(state.clouds).toHaveLength(2);
      const [first, second] = state.clouds;
      expect(second!.radius).toBeLessThan(first!.radius);
      expect(second!.life).toBeGreaterThan(first!.life);
    });

    // 2026-08-10 bug fix: was a fixed +40/+40 diagonal offset every single
    // shot — the owner's report ("spread the drops randomly"). Firing
    // twice must not land the second canister in the same spot twice.
    it('Twin Canister lands at a different offset each shot', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'twinCanister', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      const positions = new Set<string>();
      for (let i = 0; i < 20; i++) {
        state.weaponTimers.poison = 0;
        state.clouds = [];
        updatePoisonWeapon(state, 0.016);
        const second = state.clouds[1]!;
        positions.add(`${second.x.toFixed(2)},${second.y.toFixed(2)}`);
      }

      expect(positions.size).toBeGreaterThan(1);
    });

    it('Cloud Radius raises the cloud’s radius (mods channel)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.poison = 1;
      state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'cloudRadius', level: 3 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      const plain = freshState();
      plain.grid = makeTestGrid();
      plain.tower.x = 150;
      plain.tower.y = 150;
      plain.weapons.poison = 1;
      revealCellEastOfTower(plain.grid, plain.tower.x, plain.tower.y);
      computeFrontier(plain);

      updatePoisonWeapon(state, 0.016);
      updatePoisonWeapon(plain, 0.016);

      expect(state.clouds[0]!.radius).toBeGreaterThan(plain.clouds[0]!.radius);
    });
  });
});
