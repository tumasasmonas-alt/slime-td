import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { updateBoltWeapon } from './bolt';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 0,
    y: 0,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 12,
    speed: 45,
    phase: 'active',
    phaseTimer: 0,
    seeds: [],
    splitAtMass: 0,
    sourceMaturity: 0,
    parts: [],
    startMass: 50,
    lastHitAt: -Infinity,
    chilledUntil: 0,
    armorDebuff: 0,
    armorDebuffUntil: 0,
    ...overrides,
  };
}

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

  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3, S4 test 2):
  // Threat Priority replaces frontierAcquire wholesale — the end-to-end
  // proof (not just the dispatcher-level test in systems/targetingGems.test.ts)
  // that boltPipeline actually reads it, using the same fixture as the
  // "fires at the nearest frontier point" test above but with a coagulant
  // added that's farther away than the revealed cell.
  it('fires at the highest-mass coagulant instead of the nearer frontier point, with Threat Priority socketed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 150;
    state.tower.y = 150;
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'threatPriority' }] };
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y); // dist ~40, east
    state.coagulants = [makeCoagulant({ x: 150, y: 250, mass: 500 })]; // due south, dist 100 — farther, but the only mass in range
    computeFrontier(state);

    updateBoltWeapon(state, 0.016);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(Math.abs(p.vx)).toBeLessThan(1); // no longer aiming east
    expect(p.vy).toBeGreaterThan(0); // aims south, toward the coagulant
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

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Bolt's
  // four extensions.
  describe('extensions', () => {
    it('Heavy Slug raises damage and lowers fire rate (mods channel — no bolt-specific code)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 6;
      state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      const plain = freshState();
      plain.grid = makeTestGrid();
      plain.tower.x = 150;
      plain.tower.y = 150;
      plain.weapons.bolt = 6;
      revealCellEastOfTower(plain.grid, plain.tower.x, plain.tower.y);
      computeFrontier(plain);

      updateBoltWeapon(state, 0.016);
      updateBoltWeapon(plain, 0.016);

      expect(state.projectiles[0]!.dmg).toBeGreaterThan(plain.projectiles[0]!.dmg);
      expect(state.weaponTimers.bolt).toBeGreaterThan(plain.weaponTimers.bolt); // slower fire rate
    });

    it('Twin Barrel fires a second bolt from an offset origin', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 6;
      state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'twinBarrel', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateBoltWeapon(state, 0.016);

      expect(state.projectiles).toHaveLength(2);
      const dist = Math.hypot(state.projectiles[1]!.x - state.projectiles[0]!.x, state.projectiles[1]!.y - state.projectiles[0]!.y);
      expect(dist).toBeGreaterThan(0); // a genuinely different origin, not the same bolt twice
    });

    it('Overcharge boosts every 5th shot', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 6;
      state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'overcharge', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      let normalDmg = 0;
      let boostedDmg = 0;
      for (let shot = 1; shot <= 5; shot++) {
        state.weaponTimers.bolt = 0;
        updateBoltWeapon(state, 0.016);
        const p = state.projectiles[state.projectiles.length - 1]!;
        if (shot < 5) normalDmg = p.dmg;
        else boostedDmg = p.dmg;
      }

      expect(boostedDmg).toBeGreaterThan(normalDmg);
    });

    it('Tracking Rounds sets a reacquire rate on the projectile', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 150;
      state.weapons.bolt = 6;
      state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'trackingRounds', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateBoltWeapon(state, 0.016);

      expect(state.projectiles[0]!.reacquireRate).toBeGreaterThan(0);
    });
  });
});
