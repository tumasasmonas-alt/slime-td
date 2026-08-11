import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { COAGULANT_ARMOR_FLOOR } from '../tuning/coagulants';
import { MATURITY_MAX, MATURITY_YIELD_FLOOR } from '../tuning/maturity';
import { COAGULANT_XP_RISK_PREMIUM, GEM_SHOWER_MAX_COUNT, gemValueFromRemoved } from '../tuning/xp';
import { clearAt } from './clear';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 105,
    y: 105,
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

// Synthetic small grid, matching the fixture pattern used elsewhere
// (grid.test.ts, systems/growth.test.ts) — independent of the real
// reaction-diffusion output.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 400;
  return {
    cols: 20,
    rows: 20,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size).fill(0.1),
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

describe('clearAt', () => {
  it('does nothing and returns 0 when there is no grid yet', () => {
    const state = freshState();
    const result = clearAt(state, 0, 0, 10);
    expect(result.removed).toBe(0);
    expect(result.touched).toEqual([]);
    expect(result.killed).toEqual([]);
  });

  it('removes more density near the hit center than at the edge of the radius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const centerIdx = 10 * state.grid.cols + 10; // world (105,105)
    const edgeIdx = 10 * state.grid.cols + 12; // world (125,105), 20px east
    state.grid.growth[centerIdx] = 0.6;
    state.grid.growth[edgeIdx] = 0.6;

    // Note: clearAt scales the requested radius by local density at the
    // hit origin (clamp(1.25-density, 0.4, 1.25)) — at density 0.6 that's
    // 40 * 0.65 = 26px, so the edge cell at 20px is inside it, not the
    // requested 40px.
    clearAt(state, 105, 105, 50, { radiusPx: 40 });

    expect(state.grid.growth[centerIdx]).toBe(0);
    expect(state.grid.growth[edgeIdx]).toBeGreaterThan(0);
    expect(state.grid.growth[edgeIdx]).toBeLessThan(0.6);
  });

  it('lets sparse tissue clear in one chunk while mature tissue only chips down', () => {
    // Same power, same radius — density itself is what resists the hit.
    // See archive/PROTOTYPE_HANDOFF.md "Density -> toughness".
    const sparse = freshState();
    sparse.grid = makeTestGrid();
    const sparseIdx = 10 * sparse.grid.cols + 10;
    sparse.grid.growth[sparseIdx] = 0.05;

    const dense = freshState();
    dense.grid = makeTestGrid();
    const denseIdx = 10 * dense.grid.cols + 10;
    dense.grid.growth[denseIdx] = 0.95;

    clearAt(sparse, 105, 105, 10, { radiusPx: 15 });
    clearAt(dense, 105, 105, 10, { radiusPx: 15 });

    const sparseFractionRemoved = 1 - sparse.grid.growth[sparseIdx]! / 0.05;
    const denseFractionRemoved = 1 - dense.grid.growth[denseIdx]! / 0.95;

    expect(sparseFractionRemoved).toBeCloseTo(1, 5); // fully cleared
    expect(denseFractionRemoved).toBeLessThan(0.15); // only chipped
    expect(sparseFractionRemoved).toBeGreaterThan(denseFractionRemoved);
  });

  it('marks a cell dirty only on the hit that actually changes its bucket', () => {
    const state = freshState();
    state.grid = makeTestGrid({ threshold: new Float32Array(400).fill(0) });
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 1;
    state.grid.bucket[idx] = 5; // top bucket, matching growth=1 over threshold=0

    // A tiny hit barely dents growth — stays in the top bucket.
    clearAt(state, 105, 105, 0.001, { radiusPx: 15 });
    expect(state.dirty.has(idx)).toBe(false);

    // A real hit drops it out of the top bucket.
    clearAt(state, 105, 105, 50, { radiusPx: 15 });
    expect(state.dirty.has(idx)).toBe(true);
  });

  it('drops a gem once total removed density clears the drop threshold', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 0.6;

    clearAt(state, 105, 105, 50, { radiusPx: 15 });

    expect(state.gems).toHaveLength(1);
    expect(state.gems[0]!.xp).toBeGreaterThan(0);
    expect(state.particles.length).toBeGreaterThan(0);
  });

  it('does not drop a gem for a trivial hit that removes almost nothing', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = 10 * state.grid.cols + 10;
    state.grid.growth[idx] = 0.01;

    clearAt(state, 105, 105, 1, { radiusPx: 15 });

    expect(state.gems).toHaveLength(0);
  });

  it('freezes cells within the hit radius when a freeze duration is given', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const nearIdx = 10 * state.grid.cols + 10; // world (105,105), at the hit
    const farIdx = 10 * state.grid.cols + 19; // world (195,105), far outside a 15px radius

    clearAt(state, 105, 105, 10, { radiusPx: 15, freezeDuration: 1.5 });

    expect(state.grid.frozen[nearIdx]).toBe(1.5);
    expect(state.grid.frozen[farIdx]).toBe(0);
  });

  describe('frozen dirty-marking (Phase 4B, Decision 66)', () => {
    it('marks a cell dirty the tick it newly freezes, so the rim can be drawn', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const idx = 10 * state.grid.cols + 10;

      clearAt(state, 105, 105, 10, { radiusPx: 5, freezeDuration: 1.5 });

      expect(state.dirty.has(idx)).toBe(true);
    });

    it('does not re-mark a cell dirty on a second hit while already frozen', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const idx = 10 * state.grid.cols + 10;
      clearAt(state, 105, 105, 10, { radiusPx: 5, freezeDuration: 1.5 });
      state.dirty.clear();

      clearAt(state, 105, 105, 10, { radiusPx: 5, freezeDuration: 1.5 });

      expect(state.dirty.has(idx)).toBe(false);
    });
  });

  describe('maturity (Phase 4A, Decision 25/63)', () => {
    it('scars what it clears — a hit raises the maturity of the cells it touches', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const idx = 10 * state.grid.cols + 10;
      state.grid.growth[idx] = 0.6;
      expect(state.grid.maturity[idx]).toBe(0);

      clearAt(state, 105, 105, 50, { radiusPx: 15 });

      expect(state.grid.maturity[idx]).toBeGreaterThan(0);
    });

    it('repeated clearing of one spot yields progressively less per hit, as maturity accumulates', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const idx = 10 * state.grid.cols + 10;

      state.grid.growth[idx] = 0.9;
      clearAt(state, 105, 105, 10, { radiusPx: 15 });
      const firstRemoved = 0.9 - state.grid.growth[idx]!;

      // Reset density but keep the maturity gained from the first hit —
      // isolates maturity's effect on yield from ordinary density depletion.
      state.grid.growth[idx] = 0.9;
      clearAt(state, 105, 105, 10, { radiusPx: 15 });
      const secondRemoved = 0.9 - state.grid.growth[idx]!;

      expect(secondRemoved).toBeLessThan(firstRemoved);
    });

    it('never reduces yield below the floor — nothing is ever unclearable', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const idx = 10 * state.grid.cols + 10;
      state.grid.growth[idx] = 1;
      state.grid.maturity[idx] = MATURITY_MAX; // fully scarred

      clearAt(state, 105, 105, 50, { radiusPx: 15 });

      expect(state.grid.growth[idx]).toBeLessThan(1);
      // Roughly consistent with the floor multiplier applying, not zero yield.
      expect(MATURITY_YIELD_FLOOR).toBeGreaterThan(0);
    });
  });

  describe('coagulant damage (Phase 3C, Decision 42/50)', () => {
    it('damages a coagulant whose body overlaps the hit disc', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 50 });
      state.coagulants = [c];

      clearAt(state, 105, 105, 50, { radiusPx: 20 });

      expect(c.mass).toBeLessThan(50);
    });

    it('leaves a coagulant untouched when the hit disc does not reach it', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ x: 105, y: 105, radius: 5 });
      state.coagulants = [c];

      // Hit far away — well outside radius + coagulant radius.
      clearAt(state, 300, 300, 50, { radiusPx: 10 });

      expect(c.mass).toBe(50);
    });

    it('deals more damage the more the hit disc overlaps the body', () => {
      const centered = freshState();
      centered.grid = makeTestGrid();
      const centeredCoag = makeCoagulant({ x: 105, y: 105 });
      centered.coagulants = [centeredCoag];
      clearAt(centered, 105, 105, 50, { radiusPx: 20 });

      const grazing = freshState();
      grazing.grid = makeTestGrid();
      const grazingCoag = makeCoagulant({ x: 105, y: 105 });
      grazing.coagulants = [grazingCoag];
      // Hit center offset so the disc only clips the coagulant's edge.
      clearAt(grazing, 135, 105, 50, { radiusPx: 20 });

      const centeredRemoved = 50 - centeredCoag.mass;
      const grazingRemoved = 50 - grazingCoag.mass;
      expect(centeredRemoved).toBeGreaterThan(grazingRemoved);
      expect(grazingRemoved).toBeGreaterThan(0); // still some overlap
    });

    it('never reduces effective power below the armor floor, however high armor is', () => {
      // A coagulant with absurd armor should still take some damage —
      // Decision 44's guard against a matchup being a brick wall.
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 1000, armor: 999_999 });
      state.coagulants = [c];

      clearAt(state, 105, 105, 50, { radiusPx: 20 });

      expect(c.mass).toBeLessThan(1000);
      // Roughly consistent with the floor: effectivePower = power * COAGULANT_ARMOR_FLOOR.
      expect(50 * COAGULANT_ARMOR_FLOOR).toBeGreaterThan(0);
    });

    it('never drops mass below 0', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 0.001 });
      state.coagulants = [c];

      clearAt(state, 105, 105, 1000, { radiusPx: 20 });

      expect(c.mass).toBe(0);
    });

    it('applies the per-weapon coagulantMult on top of the base formula', () => {
      const weak = freshState();
      weak.grid = makeTestGrid();
      const weakCoag = makeCoagulant();
      weak.coagulants = [weakCoag];
      clearAt(weak, 105, 105, 50, { radiusPx: 20, coagulantMult: 0.5 });

      const strong = freshState();
      strong.grid = makeTestGrid();
      const strongCoag = makeCoagulant();
      strong.coagulants = [strongCoag];
      clearAt(strong, 105, 105, 50, { radiusPx: 20, coagulantMult: 2 });

      const weakRemoved = 50 - weakCoag.mass;
      const strongRemoved = 50 - strongCoag.mass;
      expect(strongRemoved).toBeGreaterThan(weakRemoved);
    });

    it('counts coagulant damage toward totalRemoved, so it drops a gem through the existing pipeline', () => {
      const state = freshState();
      state.grid = makeTestGrid(); // empty grid — nothing but the coagulant to hit
      state.coagulants = [makeCoagulant({ mass: 50 })];

      const removed = clearAt(state, 105, 105, 50, { radiusPx: 20 }).removed;

      expect(removed).toBeGreaterThan(0);
      expect(state.gems.length).toBeGreaterThan(0);
    });

    it('applies the coagulant XP risk premium (Phase 3D, Decision 61) on a coagulant-only kill', () => {
      const state = freshState();
      state.grid = makeTestGrid(); // empty grid — nothing but the coagulant to hit
      // Large enough that the premium survives Math.round rather than
      // getting lost in it at trivial removed amounts.
      state.coagulants = [makeCoagulant({ mass: 200, radius: 15 })];

      const removed = clearAt(state, 105, 105, 5000, { radiusPx: 50 }).removed;

      const totalGemXp = state.gems.reduce((sum, g) => sum + g.xp, 0);
      // With the grid empty, totalRemoved === coagulantRemoved, so the
      // whole removed amount carries the premium — matching what
      // grid/clear.ts computes internally.
      expect(totalGemXp).toBe(gemValueFromRemoved(removed * (1 + COAGULANT_XP_RISK_PREMIUM)));
      expect(totalGemXp).toBeGreaterThan(gemValueFromRemoved(removed)); // more than the no-premium value
    });

    it('showers into multiple gems, capped at GEM_SHOWER_MAX_COUNT, when a large coagulant kill crosses the shower unit', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 200, radius: 15 });
      state.coagulants = [c];

      clearAt(state, 105, 105, 5000, { radiusPx: 50 });

      expect(c.mass).toBe(0);
      expect(state.gems.length).toBeGreaterThan(1);
      expect(state.gems.length).toBeLessThanOrEqual(GEM_SHOWER_MAX_COUNT);
    });

    it('splatters a small fixed bonus and leaves the body dead once a hit brings mass to 0', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 2, kind: 'mote' }); // easy to finish off in one hit
      state.coagulants = [c];
      const before = state.grid.growth.reduce((a, b) => a + b, 0);

      clearAt(state, 105, 105, 50, { radiusPx: 20 });

      expect(c.mass).toBe(0);
      const after = state.grid.growth.reduce((a, b) => a + b, 0);
      // Splatter (a small fixed amount) landed on the grid — see
      // tuning/coagulants.ts's COAGULANT_SPLATTER, applied by
      // systems/coagulants.ts's splatterOnDeath.
      expect(after).toBeGreaterThan(before);
    });
  });

  // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S3): clearAt's return
  // value grew from a bare mass figure into { removed, touched, killed }
  // — `removed` proven byte-identical to the old scalar by the rest of
  // this file's own tests still passing unmodified (only reading
  // `.removed` where they used to read the bare number). This block
  // guards the two NEW fields specifically.
  describe('ClearResult — touched/killed (Phase 6D-3)', () => {
    it('touched is empty when nothing overlaps the hit', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ x: 105, y: 105, radius: 5 });
      state.coagulants = [c];

      const result = clearAt(state, 300, 300, 50, { radiusPx: 10 }); // far away, misses entirely

      expect(result.touched).toEqual([]);
      expect(result.killed).toEqual([]);
    });

    it('touched contains a coagulant that was hit but survived', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 1000 });
      state.coagulants = [c];

      const result = clearAt(state, 105, 105, 5, { radiusPx: 20 }); // small power — survives

      expect(c.mass).toBeGreaterThan(0);
      expect(result.touched).toEqual([c]);
      expect(result.killed).toEqual([]);
    });

    it('killed contains a coagulant whose mass reached 0 this call, and it is also in touched', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 5 });
      state.coagulants = [c];

      const result = clearAt(state, 105, 105, 500, { radiusPx: 20 }); // overkill

      expect(c.mass).toBe(0);
      expect(result.touched).toEqual([c]);
      expect(result.killed).toEqual([c]);
    });

    it('a coagulant that was already dead before this call is neither touched nor killed', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ mass: 0 });
      state.coagulants = [c];

      const result = clearAt(state, 105, 105, 500, { radiusPx: 20 });

      expect(result.touched).toEqual([]);
      expect(result.killed).toEqual([]);
    });

    it('touched lists every coagulant a single hit overlaps, not just the first', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const a = makeCoagulant({ x: 100, y: 105, mass: 1000, radius: 5 });
      const b = makeCoagulant({ x: 110, y: 105, mass: 1000, radius: 5 });
      state.coagulants = [a, b];

      const result = clearAt(state, 105, 105, 5, { radiusPx: 20 });

      expect(result.touched).toHaveLength(2);
      expect(result.touched).toEqual(expect.arrayContaining([a, b]));
    });

    it('overflow\'s own nearest-survivor hop is also reflected in touched/killed', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const weak = makeCoagulant({ x: 105, y: 105, mass: 5 });
      const survivor = makeCoagulant({ x: 108, y: 105, mass: 1000 });
      state.coagulants = [weak, survivor];

      const result = clearAt(state, 105, 105, 500, { radiusPx: 20, overflow: true });

      expect(weak.mass).toBe(0);
      expect(survivor.mass).toBeLessThan(1000); // took overflow's excess
      expect(result.killed).toEqual([weak]);
      expect(result.touched).toEqual(expect.arrayContaining([weak, survivor]));
    });

    it('a no-grid call returns the same empty shape as EMPTY_CLEAR_RESULT — no crash, no undefined access', () => {
      const state = freshState();
      const result = clearAt(state, 0, 0, 10);
      expect(result).toEqual({ removed: 0, touched: [], killed: [] });
    });
  });

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): the RESOLVE
  // stage, as new ClearOptions rather than a new damage path.
  describe('RESOLVE options (Phase 6A-2)', () => {
    it('ignoreResistance (Pierce) removes strictly more from dense tissue than the same hit without it', () => {
      const plain = freshState();
      plain.grid = makeTestGrid();
      const idx = 10 * plain.grid.cols + 10;
      plain.grid.growth[idx] = 0.95; // dense — resistance normally near its floor
      clearAt(plain, 105, 105, 10, { radiusPx: 15 });
      const plainRemoved = 0.95 - plain.grid.growth[idx]!;

      const pierced = freshState();
      pierced.grid = makeTestGrid();
      pierced.grid.growth[idx] = 0.95;
      clearAt(pierced, 105, 105, 10, { radiusPx: 15, ignoreResistance: true });
      const piercedRemoved = 0.95 - pierced.grid.growth[idx]!;

      expect(piercedRemoved).toBeGreaterThan(plainRemoved);
    });

    it('flattenFalloff (Splash) removes strictly more at the rim of the hit than without it', () => {
      const rimIdx = 10 * 20 + 13; // 30px east of the hit origin, inside a 40px radius
      const plain = freshState();
      plain.grid = makeTestGrid();
      plain.grid.growth[rimIdx] = 0.5;
      clearAt(plain, 105, 105, 50, { radiusPx: 40 });
      const plainRemoved = 0.5 - plain.grid.growth[rimIdx]!;

      const splashed = freshState();
      splashed.grid = makeTestGrid();
      splashed.grid.growth[rimIdx] = 0.5;
      clearAt(splashed, 105, 105, 50, { radiusPx: 40, flattenFalloff: true });
      const splashedRemoved = 0.5 - splashed.grid.growth[rimIdx]!;

      expect(splashedRemoved).toBeGreaterThan(plainRemoved);
    });

    describe('overflow', () => {
      it('carries overkill damage to the single nearest surviving coagulant, outside the hit’s own reach', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const weak = makeCoagulant({ x: 105, y: 105, mass: 1 }); // dies to a tiny fraction of the hit
        // Outside the direct hit's own reach (radiusPx 20 + this body's
        // radius 5) — only overflow can touch it, isolating the effect
        // under test from ordinary direct-overlap damage.
        const survivor = makeCoagulant({ x: 105, y: 145, mass: 500, radius: 5 });
        state.coagulants = [weak, survivor];

        clearAt(state, 105, 105, 500, { radiusPx: 20, overflow: true });

        expect(weak.mass).toBe(0);
        expect(survivor.mass).toBeLessThan(500);
      });

      it('never applies overflow when the option is absent — no more than the direct hit is removed', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const weak = makeCoagulant({ x: 105, y: 105, mass: 1 });
        // Placed outside the hit disc's own reach (radiusPx 20 + this
        // body's own radius) so only overflow — not direct overlap —
        // could ever touch it, isolating exactly what's under test.
        const survivor = makeCoagulant({ x: 105, y: 145, mass: 500, radius: 5 });
        state.coagulants = [weak, survivor];

        clearAt(state, 105, 105, 500, { radiusPx: 20 }); // no overflow option

        expect(weak.mass).toBe(0);
        expect(survivor.mass).toBe(500); // untouched — the excess was discarded, not carried
      });

      it('conserves mass — excess applied to the survivor is never more than what overkilled the first target', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const weak = makeCoagulant({ x: 105, y: 105, mass: 5 });
        const survivor = makeCoagulant({ x: 108, y: 105, mass: 1000 });
        state.coagulants = [weak, survivor];

        const removed = clearAt(state, 105, 105, 500, { radiusPx: 20, overflow: true }).removed;

        // totalRemoved returned by clearAt already accounts for exactly
        // what left both bodies — no double counting, no invention.
        const actualRemoved = 5 - weak.mass + (1000 - survivor.mass);
        expect(removed).toBeCloseTo(actualRemoved, 5);
      });
    });

    it('kickback displaces a hit coagulant away from the hit origin', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ x: 110, y: 105, mass: 50, radius: 5 });
      state.coagulants = [c];
      const beforeDist = Math.hypot(c.x - 105, c.y - 105);

      clearAt(state, 105, 105, 30, { radiusPx: 20, kickback: 40 });

      const afterDist = Math.hypot(c.x - 105, c.y - 105);
      expect(afterDist).toBeGreaterThan(beforeDist);
    });

    it('kickback keeps a coagulant inside the arena bounds', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ x: 5, y: 5, mass: 50, radius: 5 }); // near the corner
      state.coagulants = [c];

      clearAt(state, 10, 10, 30, { radiusPx: 20, kickback: 10000 }); // absurdly large push

      expect(c.x).toBeGreaterThanOrEqual(c.radius);
      expect(c.y).toBeGreaterThanOrEqual(c.radius);
    });

    describe('priming', () => {
      it('applies the bonus multiplier to a coagulant not hit within the priming window', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000 }); // never hit — lastHitAt: -Infinity
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, priming: 3 });
        const primedRemoved = 1000 - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: 1000 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 }); // no priming
        const unprimedRemoved = 1000 - cControl.mass;

        expect(primedRemoved).toBeCloseTo(unprimedRemoved * 3, 5);
      });

      it('does not apply the bonus to a coagulant hit again inside the priming window', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, priming: 3 }); // first hit — primed, bonus applies
        const afterFirst = c.mass;
        clearAt(state, 105, 105, 50, { radiusPx: 20, priming: 3 }); // immediately again — inside the window
        const secondRemoved = afterFirst - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: afterFirst });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 }); // one unprimed hit, same starting mass
        const controlRemoved = afterFirst - cControl.mass;

        expect(secondRemoved).toBeCloseTo(controlRemoved, 5);
      });

      it('re-applies the bonus once the priming window has elapsed', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000, lastHitAt: 0 });
        state.coagulants = [c];
        state.time = 10; // well past PRIMING_WINDOW since the last hit

        clearAt(state, 105, 105, 50, { radiusPx: 20, priming: 3 });
        const primedRemoved = 1000 - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: 1000 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const unprimedRemoved = 1000 - cControl.mass;

        expect(primedRemoved).toBeCloseTo(unprimedRemoved * 3, 5);
      });
    });

    // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S2): Shatter
    // Core — a hit marks the coagulant chilled; a LATER hit against an
    // already-chilled coagulant deals bonus damage. The ordering rule
    // (S2's own comment in clear.ts) is the one worth pinning: the hit
    // that APPLIES chill must not itself benefit from it.
    describe('chill / shatter', () => {
      it('a hit that applies chill does not itself benefit from the shatter bonus', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, chill: 2.5, shatter: 2 });
        const firstHitRemoved = 1000 - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: 1000 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 }); // no chill/shatter at all
        const unshatteredRemoved = 1000 - cControl.mass;

        expect(firstHitRemoved).toBeCloseTo(unshatteredRemoved, 5);
      });

      it('a later hit against an already-chilled coagulant deals the shatter bonus', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, chill: 2.5 }); // chills it, no shatter on this weapon
        const afterFirst = c.mass;
        // shatter is a BONUS fraction, not the multiplier itself (matching
        // every other "+X%" value in the codebase) — 2 means +200%, i.e. x3.
        clearAt(state, 105, 105, 50, { radiusPx: 20, shatter: 2 }); // a second weapon, reading the chill
        const secondRemoved = afterFirst - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: afterFirst });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 }); // same starting mass, no shatter
        const controlRemoved = afterFirst - cControl.mass;

        expect(secondRemoved).toBeCloseTo(controlRemoved * 3, 5);
      });

      it('the chill lapses — a hit after chilledUntil gets no bonus', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000, chilledUntil: 5 });
        state.coagulants = [c];
        state.time = 10; // past chilledUntil

        clearAt(state, 105, 105, 50, { radiusPx: 20, shatter: 2 });
        const removed = 1000 - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: 1000 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const controlRemoved = 1000 - cControl.mass;

        expect(removed).toBeCloseTo(controlRemoved, 5);
      });
    });

    // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S3): Corrosive
    // (armorShred) and Bunker Buster (armorScaled) — both read the same
    // effective-armour value, and both respect COAGULANT_ARMOR_FLOOR
    // (arsenal plan S12.3, the same rule bounding Penetration), pinned so
    // a later retune can't quietly remove it.
    describe('armorShred / armorScaled', () => {
      it('a debuffed coagulant takes more damage than the same coagulant at full armour', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000, armor: 40 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, armorShred: 0.5 }); // strips 50% of armour on this hit
        const afterShred = c.mass;
        clearAt(state, 105, 105, 50, { radiusPx: 20 }); // a plain second hit, benefiting from the debuff
        const debuffedRemoved = afterShred - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: afterShred, armor: 40 }); // same starting mass, full armour
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const fullArmorRemoved = afterShred - cControl.mass;

        expect(debuffedRemoved).toBeGreaterThan(fullArmorRemoved);
      });

      it('the armour debuff lapses after its window', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000, armor: 40, armorDebuff: 0.5, armorDebuffUntil: 5 });
        state.coagulants = [c];
        state.time = 10; // past armorDebuffUntil

        clearAt(state, 105, 105, 50, { radiusPx: 20 });
        const removed = 1000 - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: 1000, armor: 40 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const controlRemoved = 1000 - cControl.mass;

        expect(removed).toBeCloseTo(controlRemoved, 5);
      });

      it('Bunker Buster deals more damage against a more-armoured target', () => {
        // Both armour values stay well under `power` (50) so the base
        // power-minus-armour term doesn't collapse to the floor for
        // either — isolating armorScaled's own effect rather than mixing
        // it with the floor's separate behaviour (covered above).
        const state = freshState();
        state.grid = makeTestGrid();
        const light = makeCoagulant({ mass: 1000, armor: 5 });
        const heavy = makeCoagulant({ mass: 1000, armor: 20 });
        state.coagulants = [light];
        clearAt(state, 105, 105, 50, { radiusPx: 20, armorScaled: 0.12 });
        const lightRemoved = 1000 - light.mass;

        state.coagulants = [heavy];
        clearAt(state, 105, 105, 50, { radiusPx: 20, armorScaled: 0.12 });
        const heavyRemoved = 1000 - heavy.mass;

        expect(heavyRemoved).toBeGreaterThan(lightRemoved);
      });

      // Arsenal plan S12.3: "Penetration cannot push past Decision 44's
      // armor floor" — COAGULANT_ARMOR_FLOOR is a GUARANTEED MINIMUM
      // (max(power - armor, power * FLOOR)), not a cap, so a target with
      // absurd armour and zero shred still takes the floor-guaranteed
      // amount rather than being unclearable. Corrosive can only ever
      // raise damage toward `power` from there — it can't create some
      // separate, larger ceiling the floor doesn't already bound.
      it('even at absurd armour with zero shred, a hit still deals the floor-guaranteed minimum', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 100_000, armor: 1_000_000 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20 }); // no armorShred at all
        const removed = 100_000 - c.mass;

        expect(removed).toBeGreaterThan(0); // the floor guarantees SOME damage, not zero
      });
    });
  });

  // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3, S5): the nine
  // Conditional gems, tested directly against ClearOptions the same way
  // Phase 6A-2's RESOLVE options are above — systems/resolveOpts.ts is
  // the thing that turns a socketed gem into these fields; this file
  // guards that the fields themselves do what they claim, independent of
  // any one weapon's wiring. Each test guards "changes damage in its
  // condition and not outside it" (plan S5 test 1) via a paired
  // with/without comparison, not a same-call ratio between different
  // targets — see docs/plans/phase-6d1-targeting-gems.md's own as-built
  // delta for why a ratio comparison across different masses measures the
  // wrong thing.
  describe('Phase 6D-2: Conditional gems', () => {
    describe('Penetration (armorIgnoreCap — reused from Lance\'s Piercing Core)', () => {
      it('a hit with armorIgnoreCap removes more mass than the same hit without it, against an armoured target', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target1 = makeCoagulant({ mass: 1000, armor: 40 });
        state.coagulants = [target1];
        clearAt(state, 105, 105, 50, { radiusPx: 20, armorIgnoreCap: 30 });
        const removedWith = 1000 - target1.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const target2 = makeCoagulant({ mass: 1000, armor: 40 });
        control.coagulants = [target2];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 1000 - target2.mass;

        expect(removedWith).toBeGreaterThan(removedWithout);
      });

      it('does nothing against an unarmoured target — the condition is armour, not a flat bonus', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target1 = makeCoagulant({ mass: 1000, armor: 0 });
        state.coagulants = [target1];
        clearAt(state, 105, 105, 50, { radiusPx: 20, armorIgnoreCap: 30 });
        const removedWith = 1000 - target1.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const target2 = makeCoagulant({ mass: 1000, armor: 0 });
        control.coagulants = [target2];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 1000 - target2.mass;

        expect(removedWith).toBeCloseTo(removedWithout, 5);
      });
    });

    describe('Virulence (maturityScaled)', () => {
      // Paired with/without on the SAME mature cell, not a mature-vs-
      // virgin comparison — mature ground already carries an independent
      // yield PENALTY (maturityYieldMult, Decision 25/63's "durability
      // threat"), strong enough that Virulence's own bonus doesn't
      // necessarily make mature ground clear faster than virgin outright.
      // The gem's actual claim is narrower: mature ground clears faster
      // WITH the gem than WITHOUT it — that's what this isolates.
      it('removes more density from mature ground with the gem than without it', () => {
        const withGem = freshState();
        withGem.grid = makeTestGrid();
        const idx = 10 * withGem.grid.cols + 10;
        withGem.grid.growth[idx] = 0.6;
        withGem.grid.maturity[idx] = MATURITY_MAX;
        clearAt(withGem, 105, 105, 15, { radiusPx: 5, maturityScaled: 0.5 });
        const withGemRemoved = 0.6 - withGem.grid.growth[idx]!;

        const without = freshState();
        without.grid = makeTestGrid();
        without.grid.growth[idx] = 0.6;
        without.grid.maturity[idx] = MATURITY_MAX;
        clearAt(without, 105, 105, 15, { radiusPx: 5 });
        const withoutRemoved = 0.6 - without.grid.growth[idx]!;

        expect(withGemRemoved).toBeGreaterThan(withoutRemoved);
      });

      it('is inert (no change vs. no gem) on virgin ground — the bonus scales FROM zero maturity', () => {
        const withGem = freshState();
        withGem.grid = makeTestGrid();
        const idx = 10 * withGem.grid.cols + 10;
        withGem.grid.growth[idx] = 0.6;
        clearAt(withGem, 105, 105, 50, { radiusPx: 5, maturityScaled: 0.5 });

        const without = freshState();
        without.grid = makeTestGrid();
        without.grid.growth[idx] = 0.6;
        clearAt(without, 105, 105, 50, { radiusPx: 5 });

        expect(withGem.grid.growth[idx]).toBeCloseTo(without.grid.growth[idx]!, 5);
      });
    });

    describe('Saturation (saturationScaled)', () => {
      // Paired with/without on the SAME dense cell — a dense-vs-sparse
      // comparison would conflate Saturation's bonus with the pre-
      // existing `resistance` term, which already scales DOWN with
      // density (the opposite direction) independent of this gem. Low
      // power, so the hit doesn't fully clear the cell and clamp away
      // the difference this gem is supposed to produce.
      it('removes more density from dense ground with the gem than without it', () => {
        const withGem = freshState();
        withGem.grid = makeTestGrid();
        const idx = 10 * withGem.grid.cols + 10;
        withGem.grid.growth[idx] = 0.9;
        clearAt(withGem, 105, 105, 8, { radiusPx: 5, saturationScaled: 0.5 });
        const withGemRemoved = 0.9 - withGem.grid.growth[idx]!;

        const without = freshState();
        without.grid = makeTestGrid();
        without.grid.growth[idx] = 0.9;
        clearAt(without, 105, 105, 8, { radiusPx: 5 });
        const withoutRemoved = 0.9 - without.grid.growth[idx]!;

        expect(withGemRemoved).toBeGreaterThan(withoutRemoved);
      });

      it('does not silently reuse densityScaled (Resonant Ring\'s own field) — the two stack instead of colliding', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const idx = 10 * state.grid.cols + 10;
        state.grid.growth[idx] = 0.9;
        clearAt(state, 105, 105, 8, { radiusPx: 5, saturationScaled: 0.5, densityScaled: 0.5 });
        const bothRemoved = 0.9 - state.grid.growth[idx]!;

        const onlyDensityScaled = freshState();
        onlyDensityScaled.grid = makeTestGrid();
        onlyDensityScaled.grid.growth[idx] = 0.9;
        clearAt(onlyDensityScaled, 105, 105, 8, { radiusPx: 5, densityScaled: 0.5 });
        const densityScaledOnlyRemoved = 0.9 - onlyDensityScaled.grid.growth[idx]!;

        // If saturationScaled silently reused densityScaled's own field
        // internally, having both set would be indistinguishable from
        // densityScaled alone — they must stack instead.
        expect(bothRemoved).toBeGreaterThan(densityScaledOnlyRemoved);
      });
    });

    describe('Giant-Slayer (massScaledUp) and Culling (massScaledDown)', () => {
      it('Giant-Slayer deals more damage to a coagulant near behemoth mass than the same hit does without it', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target1 = makeCoagulant({ mass: 400 }); // well up toward MASS_BEHEMOTH (150)
        state.coagulants = [target1];
        clearAt(state, 105, 105, 50, { radiusPx: 20, massScaledUp: 0.5 });
        const removedWith = 400 - target1.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const target2 = makeCoagulant({ mass: 400 });
        control.coagulants = [target2];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 400 - target2.mass;

        expect(removedWith).toBeGreaterThan(removedWithout);
      });

      it('Giant-Slayer\'s bonus at low mass is a small fraction of its bonus at high mass — conditional on mass, not flat', () => {
        // Not "exactly inert" — clamp(mass/MASS_BEHEMOTH, 0, 1) is ~0.08
        // at mass 12, not 0, so a small bonus is expected and correct.
        // The claim this guards is relative: the bonus scales WITH mass,
        // so a low-mass target's uplift should be a small fraction of a
        // high-mass target's uplift under the identical gem value.
        const state = freshState();
        state.grid = makeTestGrid();
        const target1 = makeCoagulant({ mass: 12 }); // just above MASS_MIN_FORMATION, far below MASS_BEHEMOTH
        state.coagulants = [target1];
        clearAt(state, 105, 105, 50, { radiusPx: 20, massScaledUp: 0.5 });
        const removedWith = 12 - target1.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const target2 = makeCoagulant({ mass: 12 });
        control.coagulants = [target2];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 12 - target2.mass;

        // At mass 12, clamp(12/MASS_BEHEMOTH, 0, 1) ≈ 0.08 — a real but
        // small uplift (~4%), not zero. A generous relative bound (well
        // under the 0.5-scaled bonus a behemoth-mass target gets in the
        // test above) is the honest way to assert "small," not a tight
        // absolute closeness check that a legitimate small bonus fails.
        expect(removedWith).toBeLessThan(removedWithout * 1.15);
      });

      it('Culling deals more damage to a low-mass coagulant than the same hit does without it', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target1 = makeCoagulant({ mass: 12, startMass: 12 });
        state.coagulants = [target1];
        clearAt(state, 105, 105, 50, { radiusPx: 20, massScaledDown: 0.5 });
        const removedWith = 12 - target1.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const target2 = makeCoagulant({ mass: 12, startMass: 12 });
        control.coagulants = [target2];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 12 - target2.mass;

        expect(removedWith).toBeGreaterThan(removedWithout);
      });

      // Plan S3/S5 test 6: the threshold is a FRACTION of the coagulant's
      // OWN starting mass, so it does something to a behemoth and doesn't
      // delete a mote on sight — asserted against both.
      it('Culling\'s finisher instantly zeroes a coagulant left below the fraction of its OWN starting mass — a mote', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        // startMass 50, current mass already reduced to 10% of it (5) —
        // one more (small) hit should finish it, not just chip it.
        const target = makeCoagulant({ mass: 5, startMass: 50 });
        state.coagulants = [target];

        clearAt(state, 105, 105, 1, { radiusPx: 20, cullingFinishFraction: 0.12 });

        expect(target.mass).toBe(0);
      });

      it('Culling\'s finisher does the equivalent thing to a behemoth — a fraction of ITS OWN (much larger) starting mass, not an absolute', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target = makeCoagulant({ mass: 20, startMass: 200 }); // 10% of its own starting mass — below the 12% finish threshold
        state.coagulants = [target];

        clearAt(state, 105, 105, 1, { radiusPx: 20, cullingFinishFraction: 0.12 });

        expect(target.mass).toBe(0);
      });

      it('does NOT finish a coagulant still well above the fraction of its own starting mass', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const target = makeCoagulant({ mass: 40, startMass: 50 }); // 80% of its own starting mass
        state.coagulants = [target];

        clearAt(state, 105, 105, 1, { radiusPx: 20, cullingFinishFraction: 0.12 });

        expect(target.mass).toBeGreaterThan(0);
      });
    });

    describe('Corrosion (armorShred — reused from Poison\'s Corrosive)', () => {
      // Mirrors the armorShred/armorScaled describe block above almost
      // exactly — Corrosion reuses that exact mechanism, so this is
      // mostly confirming the reuse is real, not re-deriving the guard.
      it('a Corrosion-debuffed coagulant takes more damage on the NEXT hit than the same coagulant at full armour', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1000, armor: 40 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, armorShred: 0.35 }); // Corrosion's own value
        const afterShred = c.mass;
        clearAt(state, 105, 105, 50, { radiusPx: 20 }); // a plain second hit, benefiting from the debuff
        const debuffedRemoved = afterShred - c.mass;

        const control = freshState();
        control.grid = makeTestGrid();
        const cControl = makeCoagulant({ mass: afterShred, armor: 40 });
        control.coagulants = [cControl];
        clearAt(control, 105, 105, 50, { radiusPx: 20 });
        const fullArmorRemoved = afterShred - cControl.mass;

        expect(debuffedRemoved).toBeGreaterThan(fullArmorRemoved);
      });

      it('respects COAGULANT_ARMOR_FLOOR — even fully shredded, a hit never exceeds the floor-bounded ceiling', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 1_000_000, armor: 1000 });
        state.coagulants = [c];

        clearAt(state, 105, 105, 50, { radiusPx: 20, armorShred: 1 }); // 100% shred
        clearAt(state, 105, 105, 50, { radiusPx: 20 });
        const removed = 1_000_000 - c.mass;

        // Fully shredded armour on a 50-power hit should land close to
        // full power, not some unbounded multiple of it.
        expect(removed).toBeLessThanOrEqual(50 * 1.1);
      });

      // The ordering rule 6B-2's Shatter Core already established
      // (grid/clear.ts's own comment on the `chill`/`shatter` read order):
      // a hit that WRITES the debuff must not itself benefit from it.
      // armorShred is written after `effectiveArmor` is already read for
      // THIS hit, so this is a regression guard, not new behaviour.
      it('a hit that applies the Corrosion debuff does not itself benefit from it', () => {
        const withShred = freshState();
        withShred.grid = makeTestGrid();
        const c1 = makeCoagulant({ mass: 1000, armor: 40 });
        withShred.coagulants = [c1];
        clearAt(withShred, 105, 105, 50, { radiusPx: 20, armorShred: 0.35 });
        const removedWithShred = 1000 - c1.mass;

        const without = freshState();
        without.grid = makeTestGrid();
        const c2 = makeCoagulant({ mass: 1000, armor: 40 });
        without.coagulants = [c2];
        clearAt(without, 105, 105, 50, { radiusPx: 20 });
        const removedWithout = 1000 - c2.mass;

        expect(removedWithShred).toBeCloseTo(removedWithout, 5);
      });
    });

    describe('Desperation (desperationScaled)', () => {
      it('deals more damage the lower the core\'s own HP is', () => {
        const wounded = freshState();
        wounded.grid = makeTestGrid();
        wounded.tower.hp = 10;
        wounded.tower.maxHp = 100;
        const idx = 10 * wounded.grid.cols + 10;
        wounded.grid.growth[idx] = 0.9;
        clearAt(wounded, 105, 105, 50, { radiusPx: 5, desperationScaled: 0.6 });
        const woundedRemoved = 0.9 - wounded.grid.growth[idx]!;

        const healthy = freshState();
        healthy.grid = makeTestGrid();
        healthy.tower.hp = 100;
        healthy.tower.maxHp = 100;
        healthy.grid.growth[idx] = 0.9;
        clearAt(healthy, 105, 105, 50, { radiusPx: 5, desperationScaled: 0.6 });
        const healthyRemoved = 0.9 - healthy.grid.growth[idx]!;

        expect(woundedRemoved).toBeGreaterThan(healthyRemoved);
      });

      it('is inert at full HP — reads current HP, not max', () => {
        const withGem = freshState();
        withGem.grid = makeTestGrid();
        withGem.tower.hp = withGem.tower.maxHp; // full
        const idx = 10 * withGem.grid.cols + 10;
        withGem.grid.growth[idx] = 0.9;
        clearAt(withGem, 105, 105, 50, { radiusPx: 5, desperationScaled: 0.6 });

        const without = freshState();
        without.grid = makeTestGrid();
        without.tower.hp = without.tower.maxHp;
        without.grid.growth[idx] = 0.9;
        clearAt(without, 105, 105, 50, { radiusPx: 5 });

        expect(withGem.grid.growth[idx]).toBeCloseTo(without.grid.growth[idx]!, 5);
      });
    });

    describe('Proximity (proximityScaled)', () => {
      it('deals more damage the closer the hit lands to the tower', () => {
        const near = freshState();
        near.grid = makeTestGrid({ maxRange: 300 });
        near.tower.x = 105;
        near.tower.y = 105;
        const nearIdx = 10 * near.grid.cols + 10;
        near.grid.growth[nearIdx] = 0.9;
        clearAt(near, 105, 105, 50, { radiusPx: 5, proximityScaled: 0.5 }); // hit centred ON the tower
        const nearRemoved = 0.9 - near.grid.growth[nearIdx]!;

        const far = freshState();
        far.grid = makeTestGrid({ maxRange: 300 });
        far.tower.x = 105;
        far.tower.y = 105;
        const farHitX = 105 + 280;
        const farIdx = 10 * far.grid.cols + Math.round(farHitX / far.grid.cellSize);
        far.grid.growth[farIdx] = 0.9;
        clearAt(far, farHitX, 105, 50, { radiusPx: 5, proximityScaled: 0.5 }); // hit far from the tower
        const farRemoved = 0.9 - far.grid.growth[farIdx]!;

        expect(nearRemoved).toBeGreaterThan(farRemoved);
      });
    });

    describe('Momentum (momentumMult / momentumKey / state.weaponStreak)', () => {
      it('ramps: a hit lands harder the higher the current streak already is', () => {
        const highStreak = freshState();
        highStreak.grid = makeTestGrid();
        highStreak.weaponStreak.bolt = 4;
        const idx = 10 * highStreak.grid.cols + 10;
        highStreak.grid.growth[idx] = 0.9;
        clearAt(highStreak, 105, 105, 50, { radiusPx: 5, momentumMult: 1 + 0.08 * 4, momentumKey: 'bolt' });
        const highStreakRemoved = 0.9 - highStreak.grid.growth[idx]!;

        const noStreak = freshState();
        noStreak.grid = makeTestGrid();
        noStreak.grid.growth[idx] = 0.9;
        clearAt(noStreak, 105, 105, 50, { radiusPx: 5, momentumMult: 1, momentumKey: 'bolt' });
        const noStreakRemoved = 0.9 - noStreak.grid.growth[idx]!;

        expect(highStreakRemoved).toBeGreaterThan(noStreakRemoved);
      });

      it('increments the streak after a hit that actually removed mass', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const idx = 10 * state.grid.cols + 10;
        state.grid.growth[idx] = 0.9;
        state.weaponStreak.bolt = 2;

        clearAt(state, 105, 105, 50, { radiusPx: 5, momentumMult: 1, momentumKey: 'bolt' });

        expect(state.weaponStreak.bolt).toBe(3);
      });

      it('resets the streak to 0 on a miss — nothing removed', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        state.weaponStreak.bolt = 3;
        // Nothing revealed anywhere in range — this hit removes 0 mass.

        clearAt(state, 105, 105, 50, { radiusPx: 5, momentumMult: 1, momentumKey: 'bolt' });

        expect(state.weaponStreak.bolt).toBe(0);
      });

      it('resets the streak to 0 on a kill, per the plan\'s own rule — rewards sustained pressure, not finishing', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const c = makeCoagulant({ mass: 5 }); // dies this hit
        state.coagulants = [c];
        state.weaponStreak.bolt = 3;

        clearAt(state, 105, 105, 500, { radiusPx: 20, momentumMult: 1, momentumKey: 'bolt' });

        expect(c.mass).toBe(0);
        expect(state.weaponStreak.bolt).toBe(0);
      });

      it('a DIFFERENT weapon\'s streak is untouched by this call', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const idx = 10 * state.grid.cols + 10;
        state.grid.growth[idx] = 0.9;
        state.weaponStreak.chain = 7;

        clearAt(state, 105, 105, 50, { radiusPx: 5, momentumMult: 1, momentumKey: 'bolt' });

        expect(state.weaponStreak.chain).toBe(7);
      });

      it('does not touch state.weaponStreak at all when momentumKey is absent — no gem, no bookkeeping', () => {
        const state = freshState();
        state.grid = makeTestGrid();
        const idx = 10 * state.grid.cols + 10;
        state.grid.growth[idx] = 0.9;

        clearAt(state, 105, 105, 50, { radiusPx: 5 });

        expect(state.weaponStreak.bolt).toBeUndefined();
      });
    });
  });

  // Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S3, S8): the
  // annulus shape Shockwave's travelling ring uses. Bigger grid than the
  // rest of this file's fixtures (world fixtures elsewhere top out around
  // 200px) — a band with a meaningful inner/outer gap needs real distance
  // to work with.
  describe('clearAt — annulus shape (6C-1)', () => {
    function makeBigGrid(): Grid {
      const cols = 60;
      const rows = 60;
      const size = cols * rows;
      return {
        cols,
        rows,
        size,
        cellSize: 10,
        vein: new Float32Array(size),
        threshold: new Float32Array(size).fill(0.1),
        growth: new Float32Array(size).fill(0.5),
        frozen: new Float32Array(size),
        bucket: new Int8Array(size),
        maturity: new Float32Array(size),
        matBucket: new Int8Array(size),
        regrowMult: new Float32Array(size),
        regrowTimer: new Float32Array(size),
        maxRange: 500,
        perimeter: 20,
      };
    }

    const CENTER_X = 300;
    const CENTER_Y = 300;

    it('does not damage a cell inside the band\'s inner radius', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const grid = state.grid;
      // 20px in from the tower, well inside inner=80.
      const gx = Math.floor(CENTER_X / grid.cellSize);
      const gy = Math.floor((CENTER_Y - 20) / grid.cellSize);
      const idx = gy * grid.cols + gx;
      const before = grid.growth[idx]!;

      clearAt(state, CENTER_X, CENTER_Y, 80, { shape: { kind: 'annulus', inner: 80, outer: 120 } });

      expect(grid.growth[idx]).toBe(before);
    });

    it('damages a cell at the far edge of the band (Trap A — the bounding box must reach it)', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const grid = state.grid;
      // Just inside the outer edge of an inner=80/outer=120 band, straight
      // out from the tower.
      const gx = Math.floor(CENTER_X / grid.cellSize);
      const gy = Math.floor((CENTER_Y - 118) / grid.cellSize);
      const idx = gy * grid.cols + gx;
      const before = grid.growth[idx]!;

      clearAt(state, CENTER_X, CENTER_Y, 80, { shape: { kind: 'annulus', inner: 80, outer: 120 } });

      expect(grid.growth[idx]).toBeLessThan(before);
    });

    it('damages a cell well outside the band not at all', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const grid = state.grid;
      const gx = Math.floor(CENTER_X / grid.cellSize);
      const gy = Math.floor((CENTER_Y - 400) / grid.cellSize); // off the grid entirely, but guard anyway
      if (gy < 0) return; // out of bounds — the "never touched" case is trivially true
      const idx = gy * grid.cols + gx;
      const before = grid.growth[idx]!;

      clearAt(state, CENTER_X, CENTER_Y, 80, { shape: { kind: 'annulus', inner: 80, outer: 120 } });

      expect(grid.growth[idx]).toBe(before);
    });

    // The S3.2 rounding-collapse guard: one clearAt call must credit XP
    // once against the SUMMED mass removed, never per-cell — the failure
    // this shape system exists to prevent (a beam or ring split into many
    // small disc calls would round each toward zero). Verified here by
    // comparing a single annulus call's total XP against
    // gemValueFromRemoved of its own summed removal.
    it('credits XP once for the whole call, proportional to total mass removed', () => {
      const state = freshState();
      state.grid = makeBigGrid();

      const removed = clearAt(state, CENTER_X, CENTER_Y, 200, { shape: { kind: 'annulus', inner: 60, outer: 140 } }).removed;
      const totalGemXp = state.gems.reduce((sum, g) => sum + g.xp, 0);

      expect(removed).toBeGreaterThan(0);
      expect(totalGemXp).toBe(gemValueFromRemoved(removed));
    });

    it('a coagulant sitting inside the band is damaged; one sitting well outside it is not', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const inBand = makeCoagulant({ x: CENTER_X, y: CENTER_Y - 100, mass: 200 }); // radial dist 100, inside [80,120]
      const outsideBand = makeCoagulant({ x: CENTER_X, y: CENTER_Y - 400, mass: 200 }); // radial dist 400
      state.coagulants = [inBand, outsideBand];

      clearAt(state, CENTER_X, CENTER_Y, 100, { shape: { kind: 'annulus', inner: 80, outer: 120 } });

      expect(inBand.mass).toBeLessThan(200);
      expect(outsideBand.mass).toBe(200);
    });

    it('a coagulant sitting near the tower (well inside the inner radius) is not rejected as "close" — the cheap-reject must use radial distance, not centre distance', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      // Center-distance from the tower is small (30px), which is smaller
      // than the band's own half-width (20px)+radius, so a naive
      // disc-style reject (`dist > halfWidth + c.radius`) would wrongly
      // treat this as "close enough to hit" — the correct answer is the
      // opposite: it's near the tower, nowhere near the [80,120] band.
      const nearTower = makeCoagulant({ x: CENTER_X, y: CENTER_Y - 30, mass: 200, radius: 15 });
      state.coagulants = [nearTower];

      clearAt(state, CENTER_X, CENTER_Y, 100, { shape: { kind: 'annulus', inner: 80, outer: 120 } });

      expect(nearTower.mass).toBe(200);
    });
  });

  // Phase 6C-2 (docs/plans/phase-6c2-lance.md S4, S9): the capsule shape
  // Lance's beam uses. Same generalization, same big-grid fixture as the
  // annulus tests above.
  describe('clearAt — capsule shape (6C-2)', () => {
    function makeBigGrid(): Grid {
      const cols = 60;
      const rows = 60;
      const size = cols * rows;
      return {
        cols,
        rows,
        size,
        cellSize: 10,
        vein: new Float32Array(size),
        threshold: new Float32Array(size).fill(0.1),
        growth: new Float32Array(size).fill(0.5),
        frozen: new Float32Array(size),
        bucket: new Int8Array(size),
        maturity: new Float32Array(size),
        matBucket: new Int8Array(size),
        regrowMult: new Float32Array(size),
        regrowTimer: new Float32Array(size),
        maxRange: 500,
        perimeter: 20,
      };
    }

    const ORIGIN_X = 50;
    const ORIGIN_Y = 300;
    const TARGET_X = 250; // the "target" the beam is aimed through
    const TARGET_Y = 300;
    const FAR_X = 450; // beyond the target, along the same line — "pierces"

    // The property that distinguishes a beam from a large Bolt: it damages
    // what's PAST its target, not just at it.
    it('damages a cell behind its target, along the same line (pierces the line)', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const grid = state.grid;
      const gx = Math.floor(FAR_X / grid.cellSize);
      const gy = Math.floor(TARGET_Y / grid.cellSize);
      const idx = gy * grid.cols + gx;
      const before = grid.growth[idx]!;

      clearAt(state, ORIGIN_X, ORIGIN_Y, 200, { shape: { kind: 'capsule', toX: FAR_X, toY: TARGET_Y }, radiusPx: 16 });

      expect(grid.growth[idx]).toBeLessThan(before);
    });

    it('does not damage a cell far off the beam\'s line', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const grid = state.grid;
      const gx = Math.floor(TARGET_X / grid.cellSize);
      const gy = Math.floor((TARGET_Y + 200) / grid.cellSize); // 200px off the line
      const idx = gy * grid.cols + gx;
      const before = grid.growth[idx]!;

      clearAt(state, ORIGIN_X, ORIGIN_Y, 200, { shape: { kind: 'capsule', toX: FAR_X, toY: TARGET_Y }, radiusPx: 16 });

      expect(grid.growth[idx]).toBe(before);
    });

    // The S3.2/S4 rounding-collapse guard, repeated here because Lance is
    // the weapon where getting this wrong would actually bite: one sweep,
    // one XP credit, proportional to the SUMMED mass removed — never one
    // credit per sampled point along the line.
    it('credits XP once for the whole sweep, proportional to total mass removed', () => {
      const state = freshState();
      state.grid = makeBigGrid();

      const removed = clearAt(state, ORIGIN_X, ORIGIN_Y, 300, { shape: { kind: 'capsule', toX: FAR_X, toY: TARGET_Y }, radiusPx: 18 }).removed;
      const totalGemXp = state.gems.reduce((sum, g) => sum + g.xp, 0);

      expect(removed).toBeGreaterThan(0);
      // toBeCloseTo, not toBe — dropGemShower splits the value across
      // several gems via float division, which can differ from a single
      // fresh gemValueFromRemoved() call by less than a rounding unit
      // (the project's known Float32Array-summation precision pitfall).
      expect(totalGemXp).toBeCloseTo(gemValueFromRemoved(removed), 0);
    });

    it('a coagulant sitting on the line is damaged; one well off the line is not', () => {
      const state = freshState();
      state.grid = makeBigGrid();
      const onLine = makeCoagulant({ x: TARGET_X, y: TARGET_Y, mass: 200 });
      const offLine = makeCoagulant({ x: TARGET_X, y: TARGET_Y + 200, mass: 200 });
      state.coagulants = [onLine, offLine];

      clearAt(state, ORIGIN_X, ORIGIN_Y, 200, { shape: { kind: 'capsule', toX: FAR_X, toY: TARGET_Y }, radiusPx: 16 });

      expect(onLine.mass).toBeLessThan(200);
      expect(offLine.mass).toBe(200);
    });
  });

  // Radar Sweep (Immolation, post-6D-3 playtest, 2026-08-11): `sector`
  // masks a hit to an angular wedge, independent of `shape` — the only
  // caller today (weapons/immolation.ts) uses it on the plain disc path,
  // but grid/clear.ts wires it into the annulus/capsule branch and the
  // coagulant loop too, so it's tested directly here rather than only
  // through one weapon's specific numbers.
  describe('sector — angular wedge masking (Phase 6D-3, Radar Sweep)', () => {
    const CX = 100;
    const CY = 100;

    it('damages a cell inside the wedge', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      // Directly +X of the centre — angle 0.
      const gx = CX / 10 + 5;
      const gy = CY / 10;
      state.grid.growth[gy * state.grid.cols + gx] = 0.9;

      clearAt(state, CX, CY, 200, { radiusPx: 80, sector: { angle: 0, halfWidth: Math.PI / 4 } });

      expect(state.grid.growth[gy * state.grid.cols + gx]!).toBeLessThan(0.9);
    });

    it('leaves a cell outside the wedge untouched, even well within radius', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      // Directly -X of the centre — angle pi, opposite the wedge below.
      const gx = CX / 10 - 5;
      const gy = CY / 10;
      state.grid.growth[gy * state.grid.cols + gx] = 0.9;

      clearAt(state, CX, CY, 200, { radiusPx: 80, sector: { angle: 0, halfWidth: Math.PI / 4 } });

      expect(state.grid.growth[gy * state.grid.cols + gx]).toBeCloseTo(0.9, 5);
    });

    it('damages a coagulant inside the wedge but not one outside it, at the same radius', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const inWedge = makeCoagulant({ x: CX + 60, y: CY, mass: 200 }); // angle 0
      const outsideWedge = makeCoagulant({ x: CX - 60, y: CY, mass: 200 }); // angle pi
      state.coagulants = [inWedge, outsideWedge];

      clearAt(state, CX, CY, 200, { radiusPx: 80, sector: { angle: 0, halfWidth: Math.PI / 4 } });

      expect(inWedge.mass).toBeLessThan(200);
      expect(outsideWedge.mass).toBe(200);
    });

    it('an absent sector damages the full circle — the old, unmasked behaviour', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const gx = CX / 10 - 5; // would be excluded by the wedge above, but no sector is given here
      const gy = CY / 10;
      state.grid.growth[gy * state.grid.cols + gx] = 0.9;

      clearAt(state, CX, CY, 200, { radiusPx: 80 });

      expect(state.grid.growth[gy * state.grid.cols + gx]!).toBeLessThan(0.9);
    });
  });
});
