import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { computeFrontier } from '../systems/frontier';
import { frostRadius } from '../tuning/weapons';
import { frostPipeline, updateFrostWeapon } from './frost';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 0,
    y: 0,
    mass: 200,
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
    startMass: 200,
    lastHitAt: -Infinity,
    chilledUntil: 0,
    armorDebuff: 0,
    armorDebuffUntil: 0,
    ...overrides,
  };
}

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 10000;
  return {
    cols: 100,
    rows: 100,
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
    maxRange: 800,
    perimeter: 50,
    ...overrides,
  };
}

describe('updateFrostWeapon', () => {
  it('does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    updateFrostWeapon(state, 1);
    expect(state.novaFx).toHaveLength(0);
  });

  it('pulses on its first call — the timer starts at 0', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    const idx = 50 * state.grid.cols + 51; // just east of the tower
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;

    updateFrostWeapon(state, 0.016);

    expect(state.grid.growth[idx]).toBeLessThan(0.5);
    expect(state.grid.frozen[idx]).toBe(2.0);
    expect(state.novaFx).toEqual([
      {
        x: 500,
        y: 500,
        radius: frostRadius(1, state.grid.perimeter),
        life: 0.4,
        maxLife: 0.4,
        color: '#bfe9ff',
      },
    ]);
    expect(state.weaponTimers.frost).toBeGreaterThan(0);
  });

  it('does not pulse again before its cooldown elapses', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.weapons.frost = 1;

    updateFrostWeapon(state, 0.016);
    state.novaFx = []; // clear so we can tell if a second pulse fires
    updateFrostWeapon(state, 0.016);

    expect(state.novaFx).toHaveLength(0);
  });

  it('never pulses closer than the safe radius, at any level', () => {
    // Regression guard for documented prototype bug #5.
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.perimeter = 200;

    for (let lvl = 1; lvl <= 8; lvl++) {
      expect(frostRadius(lvl, state.grid.perimeter)).toBeGreaterThan(state.grid.perimeter);
    }
  });

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): Homing's pulse
  // reading — the pulse's centre offsets toward the nearest threat.
  it('Homing offsets the pulse away from dead-centre when a threat exists', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'homing' }] };
    const idx = 50 * state.grid.cols + 55; // east of the tower — the only revealed cell, so it's the nearest threat
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;
    computeFrontier(state);

    updateFrostWeapon(state, 0.016);

    expect(state.novaFx).toHaveLength(1);
    expect(state.novaFx[0]!.x).toBeGreaterThan(500); // offset toward the threat, east
  });

  it('without Homing, the pulse stays centred on the tower even with a threat nearby', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    const idx = 50 * state.grid.cols + 55;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.5;
    computeFrontier(state);

    updateFrostWeapon(state, 0.016);

    expect(state.novaFx[0]!.x).toBe(500);
    expect(state.novaFx[0]!.y).toBe(500);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S2-S4): Frost's
  // four extensions.
  describe('extensions', () => {
    it('Chill Field extends the freeze duration past the base pulse’s own', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'chillField', level: 3 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      // Adds to the base 2.0s rather than taking a max with it — a max()
      // would make this extension a silent no-op, since the base already
      // exceeds every one of Chill Field's own 0.4-0.8s values.
      expect(state.grid.frozen[idx]).toBeCloseTo(2.0 + 0.8, 5);
    });

    it('Shatter Core chills a coagulant it hits, and a later hit deals the shatter bonus', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'shatterCore', level: 3 }], gems: [] };
      const c = {
        x: 500,
        y: 500,
        mass: 1000,
        armor: 0,
        kind: 'congealer' as const,
        radius: 15,
        speed: 45,
        phase: 'active' as const,
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
      };
      state.coagulants = [c];

      updateFrostWeapon(state, 0.016); // first pulse — chills it, per S2's ordering rule doesn't benefit itself

      expect(c.chilledUntil).toBeGreaterThan(state.time);
      const afterFirst = c.mass;

      state.weaponTimers.frost = 0; // force it ready again
      updateFrostWeapon(state, 0.016); // second pulse — hits an already-chilled coagulant
      const secondRemoved = afterFirst - c.mass;

      // Control: an identical coagulant, hit once from full mass with no
      // prior chill — the shattered hit should remove more.
      const control = freshState();
      control.grid = makeTestGrid();
      control.tower.x = 500;
      control.tower.y = 500;
      control.weapons.frost = 1;
      const cControl = { ...c, mass: afterFirst, chilledUntil: 0 };
      control.coagulants = [cControl];
      updateFrostWeapon(control, 0.016);
      const controlRemoved = afterFirst - cControl.mass;

      expect(secondRemoved).toBeGreaterThan(controlRemoved);
    });

    it('Rime sets suppressRegrowth on its clearAt call, read back on the grid', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'rime', level: 2 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      expect(state.grid.regrowMult[idx]).toBeCloseTo(0.35, 5); // RIME_MULT level 2
      expect(state.grid.regrowTimer[idx]).toBeCloseTo(3.0, 5); // RIME_SECONDS
    });

    it('Freeze Duration extends the base freeze (mods channel)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 500;
      state.tower.y = 500;
      state.weapons.frost = 1;
      state.weaponSockets.frost = { extensions: [{ id: 1, weaponKey: 'frost', kind: 'frostDuration', level: 3 }], gems: [] };
      const idx = 50 * state.grid.cols + 51;
      state.grid.threshold[idx] = 0.1;
      state.grid.growth[idx] = 0.5;

      updateFrostWeapon(state, 0.016);

      expect(state.grid.frozen[idx]).toBeCloseTo(2.0 * 1.75, 5); // FREEZE_DURATION * (1 + 0.75)
    });
  });
});

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3, S4 test 2): Frost
// has no ACQUIRE stage — Vigilance and the focus-bonus gems read against
// the pulse itself instead. End-to-end proof that frostPipeline actually
// consults auraTargetingReading, not just the dispatcher-level test in
// systems/targetingGems.test.ts.
describe('updateFrostWeapon — Targeting gems (Phase 6D-1)', () => {
  it('Vigilance leaves ground inside the perimeter untouched, while still clearing ground outside it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.perimeter = 100;
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 8; // high level, so its radius clears well past the perimeter
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'vigilance' }] };
    const insideIdx = 50 * state.grid.cols + 55; // ~50px east — inside the perimeter
    const outsideIdx = 50 * state.grid.cols + 65; // ~150px east — outside it, still within radius
    state.grid.threshold[insideIdx] = 0;
    state.grid.growth[insideIdx] = 0.5;
    state.grid.threshold[outsideIdx] = 0;
    state.grid.growth[outsideIdx] = 0.5;

    updateFrostWeapon(state, 0.016);

    expect(state.grid.growth[insideIdx]).toBe(0.5); // untouched
    expect(state.grid.growth[outsideIdx]).toBeLessThan(0.5); // cleared
  });

  it('Threat Priority deals more damage to a coagulant than the same hit does without it', () => {
    // Paired with/without comparison, not a loss-RATIO comparison between
    // different masses — a smaller coagulant loses a much larger fraction
    // of its own mass than a bigger one even with NO bonus at all (the
    // hit's absolute damage is roughly mass-independent), so comparing
    // ratios across different masses would measure that confound instead
    // of the gem's actual effect.
    const withGem = freshState();
    withGem.grid = makeTestGrid();
    withGem.tower.x = 500;
    withGem.tower.y = 500;
    withGem.weapons.frost = 1;
    withGem.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'threatPriority' }] };
    const target1 = makeCoagulant({ x: 560, y: 500, mass: 500 });
    withGem.coagulants = [target1];

    const withoutGem = freshState();
    withoutGem.grid = makeTestGrid();
    withoutGem.tower.x = 500;
    withoutGem.tower.y = 500;
    withoutGem.weapons.frost = 1;
    const target2 = makeCoagulant({ x: 560, y: 500, mass: 500 });
    withoutGem.coagulants = [target2];

    updateFrostWeapon(withGem, 0.016);
    updateFrostWeapon(withoutGem, 0.016);

    expect(500 - target1.mass).toBeGreaterThan(500 - target2.mass);
  });
});

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4, S7 test 1): Fork/
// Chaining/Bounce/Ricochet on Frost — used to be entirely dead on this
// weapon. Calling frostPipeline.deliver directly for a deterministic
// single pulse.
describe('updateFrostWeapon — Fork/Chaining/Bounce/Ricochet (Phase 6D-3)', () => {
  it('Fork adds a second, smaller pulse at the main pulse\'s rim', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'fork' }] };

    frostPipeline.deliver(state, 1, null);

    expect(state.novaFx).toHaveLength(2); // main pulse + Fork's rim pulse
    expect(state.novaFx[1]!.radius).toBeLessThan(state.novaFx[0]!.radius);
  });

  it('with no gem, only the main pulse fires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;

    frostPipeline.deliver(state, 1, null);

    expect(state.novaFx).toHaveLength(1);
  });

  it('Chaining fires a follow-up pulse on the farthest coagulant the main pulse actually touched', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'chaining' }] };
    const near = makeCoagulant({ x: 520, y: 500, mass: 200 });
    const far = makeCoagulant({ x: 500, y: 650, mass: 200 }); // still within the pulse's own radius
    state.coagulants = [near, far];

    frostPipeline.deliver(state, 1, null);

    expect(state.novaFx).toHaveLength(2);
    const followUp = state.novaFx[1]!;
    expect(Math.hypot(followUp.x - far.x, followUp.y - far.y)).toBeLessThan(5);
  });

  it('Chaining does nothing when the main pulse touches no coagulant — a bonus on a connecting hit, not a guaranteed emission', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'chaining' }] };
    // No coagulants, no revealed ground — the pulse hits nothing.

    frostPipeline.deliver(state, 1, null);

    expect(state.novaFx).toHaveLength(1); // just the main pulse
  });

  it('Bounce fires a second pulse offset from centre', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'bounce' }] };

    frostPipeline.deliver(state, 1, null);

    expect(state.novaFx).toHaveLength(2);
    const bounce = state.novaFx[1]!;
    expect(Math.hypot(bounce.x - 500, bounce.y - 500)).toBeGreaterThan(0); // offset from the tower
  });

  it('Ricochet schedules a deferred re-fire', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'ricochet' }] };

    frostPipeline.deliver(state, 1, null);

    expect(state.pendingEmissions.filter((e) => e.weapon === 'frost')).toHaveLength(1);
  });

  it('the deferred re-fire itself (powerMult !== 1) never re-schedules Ricochet again', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 500;
    state.tower.y = 500;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'ricochet' }] };

    frostPipeline.deliver(state, 1, null, 0.5); // simulating a replay

    expect(state.pendingEmissions.filter((e) => e.weapon === 'frost')).toHaveLength(0);
  });
});
