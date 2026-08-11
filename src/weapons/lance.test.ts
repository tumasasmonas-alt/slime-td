import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { lanceChargeTime } from '../tuning/weapons';
import { updateLanceWeapon } from './lance';

function makeTestGrid(): Grid {
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
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    regrowMult: new Float32Array(size),
    regrowTimer: new Float32Array(size),
    maxRange: 600,
    perimeter: 20,
  };
}

// highestMassPoint's fallback (nearestFrontierPoint) needs SOMETHING
// revealed to find — an empty grid with no coagulants correctly returns
// null, and every test that expects the weapon to actually fire needs to
// give it a target first.
function revealCellEastOfTower(grid: Grid, towerX: number, towerY: number): void {
  const cx = Math.floor((towerX + 60) / grid.cellSize);
  const cy = Math.floor(towerY / grid.cellSize);
  const idx = cy * grid.cols + cx;
  grid.threshold[idx] = 0.1;
  grid.growth[idx] = 0.9;
}

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 400,
    y: 300,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 15,
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

describe('updateLanceWeapon', () => {
  it('does nothing without the weapon equipped, and cleans up any stale charge', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.lanceCharge = { progress: 1, chargeTime: 2, target: null };
    updateLanceWeapon(state, 0.1);
    expect(state.lanceCharge).toBeNull();
  });

  it('charges rather than firing immediately — no beam on the first tick', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.lance = 1;
    computeFrontier(state);

    updateLanceWeapon(state, 0.1);

    expect(state.beamFx).toHaveLength(0);
    expect(state.lanceCharge).not.toBeNull();
    expect(state.lanceCharge!.progress).toBeCloseTo(0.1);
  });

  it('fires once the charge completes, and resets progress', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.lance = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    const chargeTime = lanceChargeTime(1);
    updateLanceWeapon(state, chargeTime + 0.01);

    expect(state.beamFx).toHaveLength(1);
    expect(state.lanceCharge!.progress).toBe(0);
  });

  it('re-acquires its target every tick while charging — the line jumps to a newly-formed bigger coagulant', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.lance = 1;
    const small = makeCoagulant({ x: 320, y: 300, mass: 50 });
    state.coagulants = [small];
    computeFrontier(state);

    updateLanceWeapon(state, 0.1);
    expect(state.lanceCharge!.target!.x).toBe(small.x);

    // A bigger coagulant forms mid-charge.
    const big = makeCoagulant({ x: 500, y: 300, mass: 900 });
    state.coagulants.push(big);
    updateLanceWeapon(state, 0.1);

    expect(state.lanceCharge!.target!.x).toBe(big.x); // jumped, didn't stay locked on `small`
  });

  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3, S4 test 5):
  // Lance's own targeting IS Threat Priority, built in — the test above
  // already pins that default. This is the other half: a DIFFERENT
  // socketed Targeting gem must actually override it, proving the two
  // route through the same wrapper rather than Lance quietly ignoring
  // whatever's socketed.
  it('a socketed Triage gem overrides Lance\'s default highest-mass targeting with lowest-mass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.lance = 1;
    state.weaponSockets.lance = { extensions: [], gems: [{ id: 1, kind: 'triage' }] };
    const small = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const big = makeCoagulant({ x: 500, y: 300, mass: 900 });
    state.coagulants = [small, big];
    computeFrontier(state);

    updateLanceWeapon(state, 0.1);

    expect(state.lanceCharge!.target!.x).toBe(small.x); // lowest-mass now, not the default highest-mass
  });

  // The defining property: the beam pierces THROUGH its target, not just
  // to it — the one thing that distinguishes Lance from a large Bolt.
  it('damages a cell behind its target once the beam fires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const grid = state.grid;
    state.tower.x = 100;
    state.tower.y = 300;
    state.weapons.lance = 1;
    const target = makeCoagulant({ x: 300, y: 300, mass: 50 });
    state.coagulants = [target];
    computeFrontier(state);

    // A cell well behind the coagulant, along the same ray from the tower.
    const gx = Math.floor(450 / grid.cellSize);
    const gy = Math.floor(300 / grid.cellSize);
    const idx = gy * grid.cols + gx;
    grid.threshold[idx] = 0.1;
    grid.growth[idx] = 0.6;

    updateLanceWeapon(state, lanceChargeTime(1) + 0.01);

    expect(grid.growth[idx]).toBeLessThan(0.6);
  });

  it('schedules a linger re-fire after the beam\'s own base duration', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.lance = 1;
    revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
    computeFrontier(state);

    updateLanceWeapon(state, lanceChargeTime(1) + 0.01);

    const queued = state.pendingEmissions.filter((e) => e.weapon === 'lance');
    expect(queued).toHaveLength(1);
  });

  describe('extensions', () => {
    it('Piercing Core sets armorIgnoreCap, dealing more damage to an armoured coagulant than without it', () => {
      function damageDealt(withExtension: boolean): number {
        const state = freshState();
        state.grid = makeTestGrid();
        state.tower.x = 100;
        state.tower.y = 300;
        state.weapons.lance = 5;
        const target = makeCoagulant({ x: 300, y: 300, mass: 100_000, armor: 40 });
        state.coagulants = [target];
        computeFrontier(state);
        if (withExtension) {
          state.weaponSockets.lance = { extensions: [{ id: 1, weaponKey: 'lance', kind: 'piercingCore', level: 3 }], gems: [] };
        }
        updateLanceWeapon(state, lanceChargeTime(5) + 0.01);
        return 100_000 - target.mass;
      }

      expect(damageDealt(true)).toBeGreaterThan(damageDealt(false));
    });

    it('Twin Lance fires a second beam at reduced power', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 300;
      state.tower.y = 300;
      state.weapons.lance = 1;
      state.weaponSockets.lance = { extensions: [{ id: 1, weaponKey: 'lance', kind: 'twinLance', level: 1 }], gems: [] };
      revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
      computeFrontier(state);

      updateLanceWeapon(state, lanceChargeTime(1) + 0.01);

      expect(state.beamFx).toHaveLength(2);
      const [primary, twin] = state.beamFx;
      // Different angles — a real second beam, not a duplicate of the first.
      expect(twin!.toX !== primary!.toX || twin!.toY !== primary!.toY).toBe(true);
    });

    it('Afterglow lengthens the scheduled linger delay', () => {
      function lingerDelay(withExtension: boolean): number {
        const state = freshState();
        state.grid = makeTestGrid();
        state.tower.x = 300;
        state.tower.y = 300;
        state.weapons.lance = 1;
        revealCellEastOfTower(state.grid, state.tower.x, state.tower.y);
        computeFrontier(state);
        if (withExtension) {
          state.weaponSockets.lance = { extensions: [{ id: 1, weaponKey: 'lance', kind: 'afterglow', level: 3 }], gems: [] };
        }
        const chargeTime = lanceChargeTime(1);
        updateLanceWeapon(state, chargeTime + 0.01);
        const queued = state.pendingEmissions.find((e) => e.weapon === 'lance')!;
        return queued.at - state.time;
      }

      expect(lingerDelay(true)).toBeGreaterThan(lingerDelay(false));
    });

    it('Long Charge (lanceOvercharge) takes longer to charge but hits harder', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 300;
      state.tower.y = 300;
      state.weapons.lance = 1;
      state.weaponSockets.lance = { extensions: [{ id: 1, weaponKey: 'lance', kind: 'lanceOvercharge', level: 3 }], gems: [] };
      computeFrontier(state);

      const baseChargeTime = lanceChargeTime(1);
      updateLanceWeapon(state, baseChargeTime + 0.01);

      // Longer charge: the base charge time alone must NOT have been
      // enough to fire yet.
      expect(state.beamFx).toHaveLength(0);
      expect(state.lanceCharge!.chargeTime).toBeGreaterThan(baseChargeTime);

      // Finish charging against a target, then compare against the same
      // scenario with no extension socketed at all.
      const withExt = makeCoagulant({ x: 500, y: 300, mass: 100_000 });
      state.coagulants = [withExt];
      updateLanceWeapon(state, state.lanceCharge!.chargeTime);
      const removedWithExt = 100_000 - withExt.mass;

      const baseline = freshState();
      baseline.grid = makeTestGrid();
      baseline.tower.x = 300;
      baseline.tower.y = 300;
      baseline.weapons.lance = 1;
      computeFrontier(baseline);
      const withoutExt = makeCoagulant({ x: 500, y: 300, mass: 100_000 });
      baseline.coagulants = [withoutExt];
      updateLanceWeapon(baseline, lanceChargeTime(1) + 0.01);
      const removedWithoutExt = 100_000 - withoutExt.mass;

      expect(removedWithExt).toBeGreaterThan(removedWithoutExt);
    });
  });
});
