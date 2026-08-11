import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { bladeCount, bladeRadius } from '../tuning/weapons';
import { updateBladesWeapon } from './blades';

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

describe('updateBladesWeapon', () => {
  it('clears orbitals and does nothing without the weapon equipped', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.orbitals = [{ x: 1, y: 1, radius: 10, shape: 'shuriken', color: '#fff', glowColor: '#fff' }];
    updateBladesWeapon(state, 0.016);
    expect(state.orbitals).toHaveLength(0);
  });

  it('places one orbital per blade, orbiting the tower at bladeRadius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 3; // bladeCount(3) = 2

    updateBladesWeapon(state, 0.016);

    const expectedCount = bladeCount(3);
    expect(state.orbitals).toHaveLength(expectedCount);
    const expectedRadius = bladeRadius(3, state.grid.perimeter);
    for (const o of state.orbitals) {
      const d = Math.hypot(o.x - state.tower.x, o.y - state.tower.y);
      expect(d).toBeCloseTo(expectedRadius, 3);
    }
  });

  it('clears revealed density a blade passes over', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 1;
    state.time = 0;

    // At t=0 with 1 blade, spin=0 and angle=0, so the blade sits due
    // east of the tower at bladeRadius(1, perimeter).
    const radius = bladeRadius(1, state.grid.perimeter);
    const bx = state.tower.x + radius;
    const by = state.tower.y;
    const cx = Math.floor(bx / state.grid.cellSize);
    const cy = Math.floor(by / state.grid.cellSize);
    const idx = cy * state.grid.cols + cx;
    state.grid.threshold[idx] = 0.1;
    state.grid.growth[idx] = 0.6;

    updateBladesWeapon(state, 0.016);

    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it("puts each blade slot on its own cooldown, not shared across slots", () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    // 6D-0 (docs/plans/phase-6d0-balance-shape.md S4): bladeCount(1) is
    // now 2, not 1 — level-1 count was raised as part of the aura fix, so
    // this weapon fills slots 0 AND 1 at level 1. Slot 2 stays untouched,
    // which is what actually demonstrates "its own cooldown, not shared."
    state.weapons.blades = 1;
    state.time = 5;
    // Reveal the whole grid so both blades' cells (wherever they land at
    // t=5) are guaranteed to trigger a hit.
    state.grid.threshold.fill(0);
    state.grid.growth.fill(0.5);

    updateBladesWeapon(state, 0.016);
    expect(state.bladeNextHit[0]).toBeCloseTo(5.22, 5);
    expect(state.bladeNextHit[1]).toBeCloseTo(5.22, 5);
    expect(state.bladeNextHit[2]).toBeUndefined();
  });

  it('damages a coagulant sitting in already-cleared space, not just revealed grid cells', () => {
    // A blade currently gates its hit on isRevealedIdx alone, which can't
    // see a coagulant — an entity, not a grid cell — sitting in ground
    // the blade has already scrubbed clean.
    const state = freshState();
    state.grid = makeTestGrid(); // stays empty on purpose
    state.tower.x = 300;
    state.tower.y = 300;
    state.weapons.blades = 1;
    state.time = 0;

    const radius = bladeRadius(1, state.grid.perimeter);
    const c = makeCoagulant({ x: state.tower.x + radius, y: state.tower.y, mass: 50 });
    state.coagulants = [c];

    updateBladesWeapon(state, 0.016);

    expect(c.mass).toBeLessThan(50);
  });

  it('never orbits closer than the safe radius, at any level', () => {
    // Regression guard for documented prototype bug #5: a tower-centered
    // weapon smaller than perimeter is aimed at guaranteed-near-empty
    // space. See docs/DECISIONS.md.
    const state = freshState();
    state.grid = makeTestGrid();
    state.grid.perimeter = 100;
    state.tower.x = 300;
    state.tower.y = 300;

    for (let lvl = 1; lvl <= 8; lvl++) {
      state.weapons.blades = lvl;
      updateBladesWeapon(state, 0.016);
      for (const o of state.orbitals) {
        const d = Math.hypot(o.x - state.tower.x, o.y - state.tower.y);
        expect(d).toBeGreaterThan(state.grid.perimeter);
      }
    }
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7, S1): Blades'
  // four extensions.
  describe('extensions', () => {
    it('Counter-Rotation adds a second ring OUTWARD at 1.25x radius (never inward — S1)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 300;
      state.tower.y = 300;
      state.weapons.blades = 3;
      state.weaponSockets.blades = { extensions: [{ id: 1, weaponKey: 'blades', kind: 'counterRotation', level: 1 }], gems: [] };

      updateBladesWeapon(state, 0.016);

      const mainRadius = bladeRadius(3, state.grid.perimeter);
      const outerRadius = mainRadius * 1.25;
      const outerOrbitals = state.orbitals.filter((o) => Math.hypot(o.x - state.tower.x, o.y - state.tower.y) > mainRadius + 1);
      expect(outerOrbitals.length).toBeGreaterThan(0);
      for (const o of outerOrbitals) {
        const d = Math.hypot(o.x - state.tower.x, o.y - state.tower.y);
        expect(d).toBeCloseTo(outerRadius, 3);
        expect(d).toBeGreaterThan(state.grid.perimeter); // never sweeps the safe zone
      }
    });

    it('Serration ramps damage on consecutive hits by the same blade slot', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.grid.threshold.fill(0);
      state.grid.growth.fill(1); // full density everywhere — every hit lands and removeAmt is resistance-limited, not supply-limited
      state.tower.x = 300;
      state.tower.y = 300;
      state.weapons.blades = 1;
      state.weaponSockets.blades = { extensions: [{ id: 1, weaponKey: 'blades', kind: 'serration', level: 3 }], gems: [] };

      const removedPerHit: number[] = [];
      for (let i = 0; i < 3; i++) {
        const before = state.grid.growth.reduce((a, b) => a + b, 0);
        updateBladesWeapon(state, 0.016);
        state.time += 0.25; // past HIT_COOLDOWN, so the next call lands another hit on the same slot
        const after = state.grid.growth.reduce((a, b) => a + b, 0);
        removedPerHit.push(before - after);
      }

      expect(removedPerHit[2]!).toBeGreaterThan(removedPerHit[0]!);
    });

    it('Bladestorm speeds up orbit for a window after any coagulant dies', () => {
      const withStorm = freshState();
      withStorm.grid = makeTestGrid();
      withStorm.tower.x = 300;
      withStorm.tower.y = 300;
      withStorm.weapons.blades = 1;
      withStorm.weaponSockets.blades = { extensions: [{ id: 1, weaponKey: 'blades', kind: 'bladestorm', level: 3 }], gems: [] };
      withStorm.time = 5;
      withStorm.lastCoagulantDeathAt = 4.9; // well inside the 2s window

      const withoutStorm = freshState();
      withoutStorm.grid = makeTestGrid();
      withoutStorm.tower.x = 300;
      withoutStorm.tower.y = 300;
      withoutStorm.weapons.blades = 1;
      withoutStorm.time = 5;
      withoutStorm.lastCoagulantDeathAt = -Infinity;

      updateBladesWeapon(withStorm, 0.016);
      updateBladesWeapon(withoutStorm, 0.016);

      // Same angle formula, different spin speed — the stormed blade
      // should be at a different orbital angle than the un-stormed one at
      // the same instant, since its spin term is scaled up.
      const angleOf = (o: { x: number; y: number }, t: { x: number; y: number }) => Math.atan2(o.y - t.y, o.x - t.x);
      const stormAngle = angleOf(withStorm.orbitals[0]!, withStorm.tower);
      const plainAngle = angleOf(withoutStorm.orbitals[0]!, withoutStorm.tower);
      expect(stormAngle).not.toBeCloseTo(plainAngle, 3);
    });

    it('Whirl sets a per-slot flare window after a landed hit', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.grid.threshold.fill(0);
      state.grid.growth.fill(1);
      state.tower.x = 300;
      state.tower.y = 300;
      state.weapons.blades = 1;
      state.weaponSockets.blades = { extensions: [{ id: 1, weaponKey: 'blades', kind: 'whirl', level: 3 }], gems: [] };
      state.time = 0;

      updateBladesWeapon(state, 0.016);

      expect(state.bladeWhirlUntil[0]).toBeCloseTo(0.3, 5); // WHIRL_DURATION
    });

    it('a hit landed inside an active Whirl flare clears a wider area than an un-flared hit', () => {
      // A finer grid than the module default so radiusCells actually
      // differs between the base (26px) and flared (26*1.45px) hit radii
      // — the default 10px cellSize rounds both down to the same cell
      // count, which would mask the effect entirely. Built directly
      // rather than through makeTestGrid's dimension overrides — that
      // helper's typed arrays are sized off its own hardcoded local
      // `size`, not an override, so overriding cols/rows there silently
      // leaves the arrays too small.
      //
      // 6D-0 (docs/plans/phase-6d0-balance-shape.md S4) raised
      // BLADE_REACH's base from 64 to 165 — sized at 300x300 cells (600px
      // of arena) so a level-1 orbit radius of 165px has runway in every
      // direction from a centred tower, not just the quadrant it happened
      // to sample before.
      const fineGrid = (): Grid => {
        const size = 90000;
        return {
          cols: 300,
          rows: 300,
          size,
          cellSize: 2,
          vein: new Float32Array(size),
          threshold: new Float32Array(size),
          growth: new Float32Array(size),
          frozen: new Float32Array(size),
          bucket: new Int8Array(size),
          maturity: new Float32Array(size),
          matBucket: new Int8Array(size),
          regrowMult: new Float32Array(size),
          regrowTimer: new Float32Array(size),
          maxRange: 700,
          perimeter: 20,
        };
      };

      const withWhirl = freshState();
      withWhirl.grid = fineGrid();
      withWhirl.grid.threshold.fill(0);
      withWhirl.grid.growth.fill(0.4); // moderate density — clearAt's own radius clamp isn't floored at its minimum
      withWhirl.tower.x = 300;
      withWhirl.tower.y = 300;
      withWhirl.weapons.blades = 1;
      withWhirl.weaponSockets.blades = { extensions: [{ id: 1, weaponKey: 'blades', kind: 'whirl', level: 3 }], gems: [] };

      const plain = freshState();
      plain.grid = fineGrid();
      plain.grid.threshold.fill(0);
      plain.grid.growth.fill(0.4);
      plain.tower.x = 300;
      plain.tower.y = 300;
      plain.weapons.blades = 1;

      updateBladesWeapon(withWhirl, 0.016); // lands, sets the flare
      updateBladesWeapon(plain, 0.016);
      withWhirl.time += 0.25;
      plain.time += 0.25;

      // Second hit's target centre — same angle formula weapons/blades.ts
      // uses for a single un-formationed, un-homed blade: spin = time *
      // SPIN_SPEED * velocity (velocity mods are identity here). Summed
      // over a local window around it, not a single cell — the falloff
      // is ~1 at the centre regardless of radius, so a wider hit shows up
      // at the EDGE of the disc, not at its middle.
      const SPIN_SPEED = 2.4;
      const radius = bladeRadius(1, withWhirl.grid.perimeter);
      const spin = withWhirl.time * SPIN_SPEED;
      const bx = withWhirl.tower.x + Math.cos(spin) * radius;
      const by = withWhirl.tower.y + Math.sin(spin) * radius;
      const windowSum = (grid: typeof withWhirl.grid): number => {
        let sum = 0;
        const halfSpan = 40; // px — covers the plain radius (~22.1px) and the flared radius (~32px)
        for (let dy = -halfSpan; dy <= halfSpan; dy += grid!.cellSize) {
          for (let dx = -halfSpan; dx <= halfSpan; dx += grid!.cellSize) {
            const cx = Math.floor((bx + dx) / grid!.cellSize);
            const cy = Math.floor((by + dy) / grid!.cellSize);
            if (cx < 0 || cx >= grid!.cols || cy < 0 || cy >= grid!.rows) continue;
            sum += grid!.growth[cy * grid!.cols + cx]!;
          }
        }
        return sum;
      };

      const beforeWhirl = windowSum(withWhirl.grid);
      const beforePlain = windowSum(plain.grid);
      updateBladesWeapon(withWhirl, 0.016); // the flared hit
      updateBladesWeapon(plain, 0.016);
      const removedWhirl = beforeWhirl - windowSum(withWhirl.grid);
      const removedPlain = beforePlain - windowSum(plain.grid);

      expect(removedWhirl).toBeGreaterThan(removedPlain);
    });
  });
});

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3, S4 test 2):
// Blades has no ACQUIRE stage — same focus-bonus reading as Frost/
// Immolation for Threat/Triage/Breach/Fixation, but Vigilance is refused
// here (tuning/gems.ts's TARGETING_GEM_DEFS comment): the orbit already
// floors outside the perimeter by construction, so it would be a
// guaranteed no-op.
describe('updateBladesWeapon — Targeting gems (Phase 6D-1)', () => {
  it('Threat Priority deals more damage to a coagulant a blade hits than the same hit does without it', () => {
    // Paired with/without comparison — see frost.test.ts's equivalent test
    // for why a loss-RATIO comparison across different masses would be
    // measuring the wrong thing.
    const radius = bladeRadius(1, makeTestGrid().perimeter);

    const withGem = freshState();
    withGem.grid = makeTestGrid();
    withGem.tower.x = 300;
    withGem.tower.y = 300;
    withGem.weapons.blades = 1;
    withGem.weaponSockets.blades = { extensions: [], gems: [{ id: 1, kind: 'threatPriority' }] };
    withGem.time = 0;
    const target1 = makeCoagulant({ x: withGem.tower.x + radius, y: withGem.tower.y, mass: 500 });
    withGem.coagulants = [target1];

    const withoutGem = freshState();
    withoutGem.grid = makeTestGrid();
    withoutGem.tower.x = 300;
    withoutGem.tower.y = 300;
    withoutGem.weapons.blades = 1;
    withoutGem.time = 0;
    const target2 = makeCoagulant({ x: withoutGem.tower.x + radius, y: withoutGem.tower.y, mass: 500 });
    withoutGem.coagulants = [target2];

    updateBladesWeapon(withGem, 0.016);
    updateBladesWeapon(withoutGem, 0.016);

    expect(500 - target1.mass).toBeGreaterThan(500 - target2.mass);
  });
});
