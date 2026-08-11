import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from './frontier';
import { auraTargetingReading, targetingAcquire, targetingGemFor } from './targetingGems';

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
    perimeter: 100,
    ...overrides,
  };
}

describe('targetingGemFor', () => {
  it('finds the socketed Targeting gem among other gem kinds', () => {
    const state = freshState();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }, { id: 2, kind: 'triage' }] };
    expect(targetingGemFor(state, 'bolt')).toBe('triage');
  });

  it('returns undefined when no Targeting gem is socketed', () => {
    const state = freshState();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(targetingGemFor(state, 'bolt')).toBeUndefined();
  });
});

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S4 test 2): "no
// Targeting gem is silently inert" — for each gem, socketing it must
// change the acquired point versus not having it. Exercised through the
// dispatcher directly (weapon files each get their own thinner check that
// the wrapper is actually wired in).
describe('targetingAcquire — no gem is silently inert', () => {
  function setup() {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.tower.radius = 20;
    return state;
  }
  const defaultAcquire = () => ({ x: -1, y: -1, dist: 0 }); // a sentinel the default never legitimately returns

  it('uses the default when no Targeting gem is socketed', () => {
    const state = setup();
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).toEqual({ x: -1, y: -1, dist: 0 });
  });

  it('threatPriority overrides the default with the highest-mass coagulant', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'threatPriority' }] };
    state.coagulants = [makeCoagulant({ x: 320, y: 300, mass: 50 }), makeCoagulant({ x: 340, y: 300, mass: 500 })];
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).toMatchObject({ x: 340, y: 300 });
  });

  it('triage overrides the default with the lowest-mass coagulant', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'triage' }] };
    state.coagulants = [makeCoagulant({ x: 320, y: 300, mass: 500 }), makeCoagulant({ x: 340, y: 300, mass: 50 })];
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).toMatchObject({ x: 340, y: 300 });
  });

  it('vigilance overrides the default and excludes an inside-perimeter target entirely', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'vigilance' }] };
    state.coagulants = [makeCoagulant({ x: 320, y: 300, mass: 50 })]; // dist 20, inside perimeter 100
    computeFrontier(state);
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).toBeNull(); // not the sentinel default — the gem's own null
  });

  it('fieldPriority overrides the default with the densest revealed edge', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'fieldPriority' }] };
    const idx = 30 * state.grid!.cols + 34; // east, r=40
    state.grid!.threshold[idx] = 0;
    state.grid!.growth[idx] = 0.7;
    computeFrontier(state);
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).not.toEqual({ x: -1, y: -1, dist: 0 });
  });

  it('breachPriority overrides the default with the deepest ground incursion', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'breachPriority' }] };
    const idx = 30 * state.grid!.cols + 34;
    state.grid!.threshold[idx] = 0;
    state.grid!.growth[idx] = 0.5;
    computeFrontier(state);
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).not.toEqual({ x: -1, y: -1, dist: 0 });
  });

  it('fixation overrides the default and stays locked on the same coagulant across calls', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'fixation' }] };
    const a = makeCoagulant({ x: 320, y: 300, mass: 500 }); // highest mass — picked first
    const b = makeCoagulant({ x: 340, y: 300, mass: 100 });
    state.coagulants = [a, b];
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    const first = acquire(state);
    expect(first).toMatchObject({ x: a.x });

    // Introduce a THIRD, even bigger coagulant after the lock — Fixation
    // must ignore it, unlike threatPriority which would immediately
    // switch to it.
    state.coagulants.push(makeCoagulant({ x: 360, y: 300, mass: 5000 }));
    const second = acquire(state);
    expect(second).toEqual(first); // still locked onto `a`
  });

  it('opportunist targets the shared last-hit point within its window, and falls back once stale', () => {
    const state = setup();
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'opportunist' }] };
    state.time = 10;
    state.lastHitPoint = { x: 250, y: 260, time: 9.5 }; // 0.5s ago — fresh
    const acquire = targetingAcquire('bolt', (s) => s.grid!.maxRange, defaultAcquire);
    expect(acquire(state)).toMatchObject({ x: 250, y: 260 });

    state.lastHitPoint = { x: 250, y: 260, time: 5 }; // 5s ago — stale
    expect(acquire(state)).toEqual({ x: -1, y: -1, dist: 0 }); // falls back to default
  });
});

// Phase 6D-1: the self-centered reading for Blades/Frost/Immolation/
// Shockwave, none of which have an ACQUIRE stage.
describe('auraTargetingReading', () => {
  function setup() {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    return state;
  }

  it('returns no reading when no Targeting gem is socketed', () => {
    const state = setup();
    expect(auraTargetingReading(state, 'frost', 300, 300, 150)).toEqual({});
  });

  it('vigilance produces an annulus shape floored at the grid perimeter', () => {
    const state = setup();
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'vigilance' }] };
    const reading = auraTargetingReading(state, 'frost', 300, 300, 150);
    expect(reading.shape).toEqual({ kind: 'annulus', inner: 100, outer: 150 });
  });

  it('threatPriority picks the highest-mass coagulant within the aura radius as the focus target', () => {
    const state = setup();
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'threatPriority' }] };
    const small = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const big = makeCoagulant({ x: 340, y: 300, mass: 500 });
    state.coagulants = [small, big];
    const reading = auraTargetingReading(state, 'immolation', 300, 300, 200);
    expect(reading.focusTarget).toBe(big);
    expect(reading.focusBonus).toBeGreaterThan(0);
  });

  it('triage picks the lowest-mass coagulant within the aura radius', () => {
    const state = setup();
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'triage' }] };
    const small = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const big = makeCoagulant({ x: 340, y: 300, mass: 500 });
    state.coagulants = [small, big];
    const reading = auraTargetingReading(state, 'immolation', 300, 300, 200);
    expect(reading.focusTarget).toBe(small);
  });

  it('breachPriority picks whichever coagulant within the aura radius is closest to the tower', () => {
    const state = setup();
    state.weaponSockets.immolation = { extensions: [], gems: [{ id: 1, kind: 'breachPriority' }] };
    const near = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const far = makeCoagulant({ x: 340, y: 300, mass: 500 });
    state.coagulants = [near, far];
    const reading = auraTargetingReading(state, 'immolation', 300, 300, 200);
    expect(reading.focusTarget).toBe(near);
  });

  it('fixation stays on the same coagulant across repeated calls, even when a bigger one is now in range', () => {
    const state = setup();
    state.weaponSockets.blades = { extensions: [], gems: [{ id: 1, kind: 'fixation' }] };
    const first = makeCoagulant({ x: 320, y: 300, mass: 50 });
    state.coagulants = [first];
    const reading1 = auraTargetingReading(state, 'blades', 300, 300, 200);
    expect(reading1.focusTarget).toBe(first);

    const bigger = makeCoagulant({ x: 340, y: 300, mass: 500 });
    state.coagulants = [first, bigger];
    const reading2 = auraTargetingReading(state, 'blades', 300, 300, 200);
    expect(reading2.focusTarget).toBe(first); // still locked, ignores the newly-arrived bigger one
  });

  it('fixation re-targets once its locked coagulant dies', () => {
    const state = setup();
    state.weaponSockets.blades = { extensions: [], gems: [{ id: 1, kind: 'fixation' }] };
    const smaller = makeCoagulant({ x: 320, y: 300, mass: 50 });
    const bigger = makeCoagulant({ x: 340, y: 300, mass: 500 });
    state.coagulants = [smaller, bigger];
    const firstReading = auraTargetingReading(state, 'blades', 300, 300, 200);
    expect(firstReading.focusTarget).toBe(bigger); // highest-mass picked first, locks onto it

    bigger.mass = 0; // the locked target dies
    const reading = auraTargetingReading(state, 'blades', 300, 300, 200);
    expect(reading.focusTarget).toBe(smaller); // re-targets to whatever's left
  });

  it('fieldPriority and opportunist produce no reading — refused on self-centered archetypes at socket time, so this is unreachable in practice', () => {
    const state = setup();
    // Bypasses socket-time legality deliberately, to prove the dispatcher
    // itself degrades safely rather than throwing, in case a stale save
    // ever holds an illegal combination.
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'fieldPriority' }] };
    expect(auraTargetingReading(state, 'frost', 300, 300, 150)).toEqual({});
  });
});
