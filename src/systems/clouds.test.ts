import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { updateClouds } from './clouds';

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

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
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
    maxRange: 300,
    perimeter: 20,
    ...overrides,
  };
}

describe('updateClouds', () => {
  it('ticks damage on its own cadence, not every frame', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 30 * state.grid.cols + 30; // world (305,305)
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.6;
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 0.3, // not due yet
      bubbleSeeds: [],
    });

    updateClouds(state, 0.1); // tickTimer -> 0.2, not due
    expect(state.grid.growth[idx]).toBeCloseTo(0.6, 5);

    updateClouds(state, 0.25); // tickTimer -> -0.05, due — ticks once
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('removes a cloud once its life runs out', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 0.1,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5, // won't tick this call
      bubbleSeeds: [],
    });

    updateClouds(state, 0.2);

    expect(state.clouds).toHaveLength(0);
  });

  it('still ages the cloud without a grid — clearAt just no-ops safely', () => {
    const state = freshState();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 0,
      bubbleSeeds: [],
    });

    expect(() => updateClouds(state, 0.1)).not.toThrow();
    expect(state.clouds).toHaveLength(1);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Lingering
  // Spores' outward drift, distinct from Homing's toward-the-threat drift.
  describe('driftOutward (Lingering Spores)', () => {
    it('drifts a cloud along its own driftAngle over time', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push({
        x: 300,
        y: 300,
        radius: 30,
        life: 3.4,
        maxLife: 3.4,
        dmgPerSec: 10,
        color: '#8aff4d',
        tickTimer: 5,
        bubbleSeeds: [],
        driftOutward: 20,
        driftAngle: 0,
      });

      updateClouds(state, 0.5);

      const c = state.clouds[0]!;
      const distFromOrigin = Math.hypot(c.x - 300, c.y - 300);
      expect(distFromOrigin).toBeGreaterThan(0);
    });

    // 2026-08-10 bug fix regression guard: the original implementation
    // derived direction from atan2(c.y - originY, c.x - originX), which
    // is atan2(0, 0) = 0 at spawn — every cloud drifted due east
    // regardless of the extension's own "outward" claim. Two clouds with
    // different driftAngle values must end up in genuinely different
    // places, not just "moved."
    it('two clouds with different driftAngle values drift in different directions', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push(
        {
          x: 300,
          y: 300,
          radius: 30,
          life: 3.4,
          maxLife: 3.4,
          dmgPerSec: 10,
          color: '#8aff4d',
          tickTimer: 5,
          bubbleSeeds: [],
          driftOutward: 20,
          driftAngle: 0, // east
        },
        {
          x: 300,
          y: 300,
          radius: 30,
          life: 3.4,
          maxLife: 3.4,
          dmgPerSec: 10,
          color: '#8aff4d',
          tickTimer: 5,
          bubbleSeeds: [],
          driftOutward: 20,
          driftAngle: Math.PI, // west
        },
      );

      updateClouds(state, 0.5);

      const [east, west] = state.clouds;
      expect(east!.x).toBeGreaterThan(300);
      expect(west!.x).toBeLessThan(300);
    });

    it('does not drift a cloud with no driftOutward set (no regression)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.clouds.push({
        x: 300,
        y: 300,
        radius: 30,
        life: 3.4,
        maxLife: 3.4,
        dmgPerSec: 10,
        color: '#8aff4d',
        tickTimer: 5,
        bubbleSeeds: [],
      });

      updateClouds(state, 0.5);

      expect(state.clouds[0]!.x).toBe(300);
      expect(state.clouds[0]!.y).toBe(300);
    });
  });

  // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3, Decision
  // 91): same forwarding-gap regression guard as systems/projectiles.test.ts —
  // updateClouds' own clearAt call only forwarded a hardcoded field
  // subset, which would have made every Conditional gem silently inert
  // on Poison specifically.
  it('Penetration (armorIgnoreCap) reaches the coagulant loop on a tick', () => {
    const withGem = freshState();
    withGem.grid = makeTestGrid();
    withGem.coagulants = [
      {
        x: 300,
        y: 300,
        mass: 1000,
        armor: 40,
        kind: 'congealer',
        radius: 10,
        speed: 45,
        phase: 'active',
        phaseTimer: 0,
        seeds: [],
        splitAtMass: 0,
        sourceMaturity: 0,
        parts: [],
        startMass: 1000,
        lastHitAt: -Infinity,
        chilledUntil: 0,
        armorDebuff: 0,
        armorDebuffUntil: 0,
      },
    ];
    withGem.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 500,
      color: '#8aff4d',
      tickTimer: 0,
      bubbleSeeds: [],
      armorIgnoreCap: 30,
    });
    updateClouds(withGem, 0.1);
    const removedWith = 1000 - withGem.coagulants[0]!.mass;

    const without = freshState();
    without.grid = makeTestGrid();
    without.coagulants = [
      {
        x: 300,
        y: 300,
        mass: 1000,
        armor: 40,
        kind: 'congealer',
        radius: 10,
        speed: 45,
        phase: 'active',
        phaseTimer: 0,
        seeds: [],
        splitAtMass: 0,
        sourceMaturity: 0,
        parts: [],
        startMass: 1000,
        lastHitAt: -Infinity,
        chilledUntil: 0,
        armorDebuff: 0,
        armorDebuffUntil: 0,
      },
    ];
    without.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 500,
      color: '#8aff4d',
      tickTimer: 0,
      bubbleSeeds: [],
    });
    updateClouds(without, 0.1);
    const removedWithout = 1000 - without.coagulants[0]!.mass;

    expect(removedWith).toBeGreaterThan(removedWithout);
  });
});

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4, S7 test 1): Fork/
// Bounce/Ricochet's expiry/drift half — weapons/poison.test.ts covers the
// spawn-time half (that the flags actually reach the cloud).
describe('Fork/Bounce/Ricochet at expiry (Phase 6D-3)', () => {
  it('Fork replaces an expiring cloud with two smaller children instead of just vanishing', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 40,
      life: 0.05, // expires this tick
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      forkOnExpiry: true,
    });

    updateClouds(state, 0.1);

    expect(state.clouds).toHaveLength(2);
    expect(state.clouds[0]!.radius).toBeLessThan(40);
    expect(state.clouds[0]!.forkOnExpiry).toBeFalsy(); // children never re-fork
  });

  it('a plain expiring cloud (no forkOnExpiry) just vanishes — no regression', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 40,
      life: 0.05,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
    });

    updateClouds(state, 0.1);

    expect(state.clouds).toHaveLength(0);
  });

  it('Bounce relocates an expiring cloud to the nearest mass and keeps it alive instead of vanishing', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const target = makeCoagulant({ x: 450, y: 300, mass: 200 });
    state.coagulants = [target];
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 40,
      life: 0.05,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      bounceOnExpiry: true,
      bouncesLeft: 2,
    });

    updateClouds(state, 0.1);

    expect(state.clouds).toHaveLength(1); // relocated, not removed
    const c = state.clouds[0]!;
    expect(c.x).toBeCloseTo(target.x, 5);
    expect(c.y).toBeCloseTo(target.y, 5);
    expect(c.life).toBeGreaterThan(0); // refreshed
    expect(c.bouncesLeft).toBe(1); // one hop consumed
  });

  it('Bounce\'s hop budget terminates — once bouncesLeft reaches 0, the cloud vanishes on expiry like normal', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const target = makeCoagulant({ x: 450, y: 300, mass: 200 });
    state.coagulants = [target];
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 40,
      life: 0.05,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      bounceOnExpiry: true,
      bouncesLeft: 0, // budget already exhausted
    });

    updateClouds(state, 0.1);

    expect(state.clouds).toHaveLength(0);
  });

  it('Bounce with nothing nearby to hop to just vanishes, same as a plain expiry', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // no coagulants anywhere
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 40,
      life: 0.05,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      bounceOnExpiry: true,
      bouncesLeft: 2,
    });

    updateClouds(state, 0.1);

    expect(state.clouds).toHaveLength(0);
  });

  it('Ricochet moves a cloud even with no Lingering Spores extension socketed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      ricochetDrift: true,
      driftAngle: 0,
    });

    updateClouds(state, 0.5);

    const c = state.clouds[0]!;
    const distFromOrigin = Math.hypot(c.x - 300, c.y - 300);
    expect(distFromOrigin).toBeGreaterThan(0);
  });

  it('Ricochet flips driftAngle once, partway through the cloud\'s life, not every tick', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.clouds.push({
      x: 300,
      y: 300,
      radius: 30,
      life: 3.4,
      maxLife: 3.4,
      dmgPerSec: 10,
      color: '#8aff4d',
      tickTimer: 5,
      bubbleSeeds: [],
      ricochetDrift: true,
      driftAngle: 0,
    });

    // Advance well past the flip fraction (life <= maxLife * 0.5).
    for (let i = 0; i < 20 && state.clouds.length > 0; i++) updateClouds(state, 0.1);

    const c = state.clouds[0]!;
    expect(c.ricochetFlipped).toBe(true);
    expect(c.driftAngle).toBeCloseTo(Math.PI, 5); // flipped exactly once from 0
  });
});
