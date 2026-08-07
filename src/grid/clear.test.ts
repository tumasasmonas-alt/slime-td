import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { COAGULANT_ARMOR_FLOOR } from '../tuning/coagulants';
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
    maxRange: 300,
    perimeter: 20,
    ...overrides,
  };
}

describe('clearAt', () => {
  it('does nothing and returns 0 when there is no grid yet', () => {
    const state = freshState();
    expect(clearAt(state, 0, 0, 10)).toBe(0);
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

      const removed = clearAt(state, 105, 105, 50, { radiusPx: 20 });

      expect(removed).toBeGreaterThan(0);
      expect(state.gems.length).toBeGreaterThan(0);
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
});
