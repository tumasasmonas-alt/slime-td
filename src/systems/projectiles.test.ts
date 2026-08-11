import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid, MissileProjectile } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import { updateProjectiles } from './projectiles';

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 305,
    y: 300,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 10,
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

function revealAt(grid: Grid, x: number, y: number, density: number): number {
  const { cx, cy } = worldToCell(grid, x, y);
  const i = gIdx(grid, cx, cy);
  grid.threshold[i] = 0.1;
  grid.growth[i] = density;
  return i;
}

describe('updateProjectiles — bolt', () => {
  it('travels and is removed once its life expires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 0.05 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('is removed once it travels off the world bounds', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: -100, y: 300, vx: -1000, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('clears density and is consumed on hitting revealed tissue', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 30, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('keeps traveling while nothing revealed is in its path', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.x).toBeCloseTo(301, 5);
  });

  it('detonates on a coagulant sitting in already-cleared space — not just on revealed grid cells', () => {
    // A blob is an entity, not a grid cell, so isRevealedIdx alone can't
    // see it (docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md
    // §"finding 2"). Grid stays empty here on purpose.
    const state = freshState();
    state.grid = makeTestGrid();
    const c = makeCoagulant({ x: 305, y: 300, radius: 10, mass: 50 });
    state.coagulants = [c];
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 30, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
    expect(c.mass).toBeLessThan(50);
  });
});

describe('updateProjectiles — chain', () => {
  it('hops to a nearby revealed cluster, decaying damage, when one exists', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // first hit
    revealAt(state.grid, 340, 300, 0.6); // next hop target, within CHAIN_HOP_SEARCH_RADIUS (150)
    state.projectiles.push({
      type: 'chain',
      src: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 2,
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('chain');
    if (p.type !== 'chain') return;
    expect(p.hopsLeft).toBe(1);
    expect(p.dmg).toBeCloseTo(20 * 0.82, 5);
    expect(p.visited.size).toBe(1);
    expect(state.chainFx.length).toBeGreaterThan(0);
  });

  it('is consumed once it runs out of hops', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    revealAt(state.grid, 340, 300, 0.6);
    state.projectiles.push({
      type: 'chain',
      src: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 1, // this hit is its last
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S2, S7 test 5): Fork/
  // Chaining/Bounce/Ricochet used to be silently unreachable on Chain —
  // this branch's own `continue` skipped the generic flag block entirely,
  // regardless of what fields the projectile carried. Now grafted onto
  // the moment Chain's own hop budget is exhausted.
  describe('Fork/Chaining/Bounce/Ricochet on Chain (Phase 6D-3)', () => {
    it('Chaining makes an exhausted chain hop FURTHER, not consumed — "hop further, not twice per hop"', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      revealAt(state.grid, 340, 300, 0.6); // a target for the BONUS hop, past the native budget
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 1, // native budget exhausts on this hit
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        chains: 2,
      });

      updateProjectiles(state, 0.1);

      // Consumed with no gem (the test above) — survives here, because
      // the exhausted native chain got ONE bonus hop from the gem.
      expect(state.projectiles).toHaveLength(1);
    });

    it('does not let Chaining grant a SECOND bonus hop beyond what the gem itself grants', () => {
      // chains: 2 grants exactly one bonus hop — matches the established
      // convention above ("hops to a nearby coagulant" test uses chains: 2
      // for one hop; "despawns once its hop budget is exhausted" uses
      // chains: 1 for zero).
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      revealAt(state.grid, 340, 300, 0.6);
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 1, // native budget exhausts on this hit
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        chains: 2, // exactly one bonus hop
      });

      updateProjectiles(state, 0.1);

      expect(state.projectiles).toHaveLength(1);
      const p = state.projectiles[0]!;
      expect(p.type).toBe('chain');
      // The bonus hop was granted (survived) — its own budget must now
      // read as "no further hop," the same value the OTHER "despawns once
      // its hop budget is exhausted" test already pins for a fresh chain.
      if (p.type === 'chain') expect(p.chains).toBe(1);
    });

    it('Fork splits the exhausted chain into two continuing children, not a doubled native hop', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 1,
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        forks: 2,
      });

      updateProjectiles(state, 0.1);

      expect(state.projectiles).toHaveLength(2);
      expect(state.projectiles[0]!.type).toBe('chain'); // forked children preserve the parent's shape
    });

    it('a chain that hopped natively this tick does NOT also resolve the generic flags', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      revealAt(state.grid, 340, 300, 0.6); // a native hop target — budget is NOT exhausted this hit
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 2, // survives this hit natively — one hop left after
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        forks: 2, // would double the count if it fired here too
      });

      updateProjectiles(state, 0.1);

      // Exactly one survivor (the natively-hopping parent) — Fork did not
      // ALSO fire on the same tick the native hop already consumed.
      expect(state.projectiles).toHaveLength(1);
      expect(state.projectiles[0]!.type).toBe('chain');
    });
  });

  it('is consumed when hops remain but no further target is in range', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // only this one revealed, nothing else nearby
    state.projectiles.push({
      type: 'chain',
      src: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 3,
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('hops to a nearby coagulant when it is closer than any revealed grid cluster', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // first hit, triggers the hop
    revealAt(state.grid, 400, 300, 0.6); // a distant grid cluster (due east, ~99px from the hit)
    // Due north of the hit point and much closer (~40px) — a different
    // bearing from the grid cluster, so the resulting steering direction
    // unambiguously reveals which target the hop actually picked.
    state.coagulants = [makeCoagulant({ x: 301, y: 260, radius: 10 })];
    state.projectiles.push({
      type: 'chain',
      src: 'chain',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 20,
      radius: 5,
      color: '#e6c8ff',
      life: 5,
      hopsLeft: 2,
      visited: new Set(),
      legStart: { x: 300, y: 300 },
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('chain');
    if (p.type !== 'chain') return;
    expect(p.vy).toBeLessThan(0); // steering north, toward the coagulant
    expect(Math.abs(p.vx)).toBeLessThan(Math.abs(p.vy)); // not toward the due-east grid cluster
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Chain's
  // four extensions, exercised at the behaviour layer — weapons/chain.ts's
  // own test file checks that each is baked onto the projectile correctly
  // at spawn.
  describe('extensions', () => {
    it('Static Buildup grows per-hop damage instead of decaying it', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      revealAt(state.grid, 340, 300, 0.6);
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 2,
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        hopGrowth: 1.25,
      });

      updateProjectiles(state, 0.1);

      const p = state.projectiles[0]!;
      if (p.type !== 'chain') throw new Error('expected a chain projectile');
      expect(p.dmg).toBeCloseTo(20 * 1.25, 5); // grew, not decayed
    });

    it('Backlash boosts only the hop that turns out to be the last one', () => {
      const withBacklash = freshState();
      withBacklash.grid = makeTestGrid();
      revealAt(withBacklash.grid, 305, 300, 0.6);
      withBacklash.coagulants = [];
      withBacklash.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 1, // this impact IS the final hop — no next target exists anyway
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        finalHopMult: 2,
      });
      const removedWithBacklash = removedMassFromHit(withBacklash, 305, 300);

      const plain = freshState();
      plain.grid = makeTestGrid();
      revealAt(plain.grid, 305, 300, 0.6);
      plain.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 1,
        visited: new Set(),
        legStart: { x: 300, y: 300 },
      });
      const removedPlain = removedMassFromHit(plain, 305, 300);

      expect(removedWithBacklash).toBeGreaterThan(removedPlain);
    });

    it('Split Arc spawns one branch on the first hop transition, never a second time', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.6);
      revealAt(state.grid, 340, 300, 0.6);
      revealAt(state.grid, 340, 260, 0.6); // a second candidate so the branch has somewhere to go too
      state.projectiles.push({
        type: 'chain',
        src: 'chain',
        x: 300,
        y: 300,
        vx: 10,
        vy: 0,
        dmg: 20,
        radius: 5,
        color: '#e6c8ff',
        life: 5,
        hopsLeft: 3,
        visited: new Set(),
        legStart: { x: 300, y: 300 },
        splitArcPower: 0.5,
      });

      updateProjectiles(state, 0.1);

      // The parent continues (hopsLeft was 3, now 2, > 0) plus one branch.
      expect(state.projectiles.length).toBeGreaterThanOrEqual(2);
      const branch = state.projectiles.find((p) => p.type === 'chain' && p.splitArcUsed && p.dmg < 20 * 0.82);
      expect(branch).toBeDefined();
    });
  });
});

// Phase 6B-2: shared by the Backlash test above — fires one hit at
// (hitX, hitY) via the existing chain projectile already pushed onto
// state.projectiles, and returns how much grid density it removed.
function removedMassFromHit(state: ReturnType<typeof freshState>, hitX: number, hitY: number): number {
  const grid = state.grid!;
  const { cx, cy } = { cx: Math.floor(hitX / grid.cellSize), cy: Math.floor(hitY / grid.cellSize) };
  const idx = cy * grid.cols + cx;
  const before = grid.growth[idx]!;
  updateProjectiles(state, 0.1);
  return before - grid.growth[idx]!;
}

describe('updateProjectiles — missile', () => {
  it('steers toward its target point and keeps flying while short of it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 500, y: 300 },
      armAt: 0,
    });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0]!;
    expect(p.type).toBe('missile');
    if (p.type !== 'missile') return;
    expect(p.vx).toBeGreaterThan(0); // steering toward +x
    expect(p.x).toBeGreaterThan(300);
  });

  it('detonates and clears density once it reaches its target point', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const idx = revealAt(state.grid, 305, 300, 0.6); // near the target, within splash
    state.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 302, y: 300 }, // already within MISSILE_REACH_DIST
      armAt: 0,
    });

    updateProjectiles(state, 0.001); // negligible travel — reach check dominates

    expect(state.projectiles).toHaveLength(0);
    expect(state.grid.growth[idx]).toBeLessThan(0.6);
  });

  it('detonates early on touching revealed tissue, before reaching its target', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6); // where this frame's step will land
    state.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 1000, y: 300 }, // far beyond the revealed wall
      armAt: 0,
    });

    // A small dt so this frame's step (vx*dt = 6px) lands inside the
    // revealed cell rather than overshooting past it — the check is
    // "revealed at the new position," not "did it cross revealed space
    // somewhere along the way."
    updateProjectiles(state, 0.02);

    expect(state.projectiles).toHaveLength(0);
  });

  it('detonates on touching a coagulant, even over unrevealed ground', () => {
    const state = freshState();
    state.grid = makeTestGrid(); // empty — no revealed tissue anywhere
    const c = makeCoagulant({ x: 306, y: 300, radius: 10, mass: 50 });
    state.coagulants = [c];
    state.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 300,
      dmg: 30,
      splashRadius: 60,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 1000, y: 300 }, // far beyond the coagulant
      armAt: 0,
    });

    updateProjectiles(state, 0.02);

    expect(state.projectiles).toHaveLength(0);
    expect(c.mass).toBeLessThan(50);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Missile's
  // extensions that live in updateMissile itself. Bunker Buster and Salvo
  // are covered at the spawn layer in weapons/missile.test.ts.
  describe('extensions', () => {
    it('Proximity Fuse detonates before reaching the target point or touching revealed tissue', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      const c = makeCoagulant({ x: 340, y: 300, radius: 5 });
      state.coagulants = [c];
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 300,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 1000, y: 300 }, // far beyond the coagulant — without the fuse this frame wouldn't detonate
        armAt: 0,
        proximityFuseDist: 50, // well past the coagulant's own tiny hit radius
      });

      updateProjectiles(state, 0.02); // one small step — still short of `radius`-based physical contact

      expect(state.projectiles).toHaveLength(0); // detonated on proximity alone
      expect(c.mass).toBeLessThan(50);
    });

    it('Cluster Warhead spawns submunitions on detonation', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      revealAt(state.grid, 305, 300, 0.9);
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 300,
        vy: 0,
        speed: 300,
        dmg: 40,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 305, y: 300 },
        armAt: 0,
        clusterCount: 4,
      });

      updateProjectiles(state, 0.02);

      const submunitions = state.projectiles.filter((p) => p.type === 'missile' && !p.clusterCount);
      expect(submunitions.length).toBe(4);
      for (const s of submunitions) {
        expect(s.dmg).toBeLessThan(40);
        expect(s.dmg).toBeGreaterThan(0);
      }
    });

    it('a Salvo missile with armAt in the future stays inert at its spawn point', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.time = 1;
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 500, y: 300 },
        armAt: 1.5, // in the future
      });

      updateProjectiles(state, 0.02);

      expect(state.projectiles).toHaveLength(1);
      expect(state.projectiles[0]!.x).toBe(300); // hasn't moved
      expect(state.projectiles[0]!.y).toBe(300);
    });

    it('once armAt passes, the missile flies normally', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.time = 2; // past armAt
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 0,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 500, y: 300 },
        armAt: 1.5,
      });

      updateProjectiles(state, 0.02);

      expect(state.projectiles[0]!.x).toBeGreaterThan(300); // now moving toward the target
    });
  });

  // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S2, S7 test 5): the
  // 'missile'/'fission' branch's own `continue` used to skip the generic
  // flag block entirely (same defect as Chain's), so a missile carrying
  // Fork/Chaining/Bounce/Ricochet reached detonation with the field
  // completely unread — merged into weapons/missile.ts at spawn, resolved
  // here at detonation (recomputed fresh, not threaded out of
  // updateMissile — detonation doesn't move `p` any further).
  describe('Fork/Chaining/Bounce/Ricochet on detonation (Phase 6D-3)', () => {
    it('Fork splits a detonating missile into two children instead of just despawning', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 300,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 305, y: 300 }, // reached this tick
        armAt: 0,
        forks: 2,
      });

      updateProjectiles(state, 0.02);

      expect(state.projectiles).toHaveLength(2);
      expect(state.projectiles[0]!.type).toBe('missile');
    });

    it('Ricochet reverses a detonating missile instead of despawning it', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 300,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 305, y: 300 },
        armAt: 0,
        ricochet: true,
      });

      updateProjectiles(state, 0.02);

      expect(state.projectiles).toHaveLength(1);
      expect(state.projectiles[0]!.vx).toBeLessThan(0); // reversed
    });

    it('with no behaviour flag at all, detonation still just despawns (no regression)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.projectiles.push({
        type: 'missile',
        src: 'missile',
        x: 300,
        y: 300,
        vx: 300,
        vy: 0,
        speed: 300,
        dmg: 30,
        splashRadius: 60,
        radius: 5,
        color: '#ff9d6b',
        life: 5,
        targetPoint: { x: 305, y: 300 },
        armAt: 0,
      });

      updateProjectiles(state, 0.02);

      expect(state.projectiles).toHaveLength(0);
    });
  });
});

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S4): Fission
// Charge's own projectile — type: 'missile' | 'fission', riding the exact
// same detonate-and-cluster branch, so most coverage lives above. This
// block is only what's genuinely new: the weapon always clusters (no
// extension required), and the two extensions.
describe('updateProjectiles — fission', () => {
  it('bursts into submunitions on detonation without any extension socketed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.9);
    state.projectiles.push({
      type: 'fission',
      src: 'fission',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 220,
      dmg: 20,
      splashRadius: 34,
      radius: 6,
      color: '#ffd166',
      life: 5,
      targetPoint: { x: 305, y: 300 },
      armAt: 0,
      clusterCount: 4,
      scatterDist: 70,
      childPowerShare: 1,
      fissionGen: 0,
    });

    updateProjectiles(state, 0.02);

    const submunitions = state.projectiles.filter((p) => p.type === 'fission');
    expect(submunitions.length).toBe(4);
    // childPowerShare: 1 — full power, unlike Missile's own 0.25 share.
    for (const s of submunitions) expect(s.dmg).toBe(20);
  });

  // The S9 risk 2 guard: Chain Fission must terminate by construction, not
  // by luck. A generation-1 child (itself created by the burst above) is
  // allowed to split once more; its own children (generation 2) must not.
  it('Chain Fission grants exactly one extra generation of splitting, never a second', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.9);
    state.projectiles.push({
      type: 'fission',
      src: 'fission',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 220,
      dmg: 20,
      splashRadius: 34,
      radius: 6,
      color: '#ffd166',
      life: 5,
      targetPoint: { x: 305, y: 300 },
      armAt: 0,
      clusterCount: 2,
      scatterDist: 70,
      childPowerShare: 1,
      fissionGen: 0,
      chainFissionLvl: 2, // grants 2 children per split
    });

    // Tick 1: the primary shot detonates, producing 2 generation-1
    // children — each carrying its own clusterCount (Chain Fission
    // granted), so they haven't detonated yet themselves.
    updateProjectiles(state, 0.02);
    const gen1 = state.projectiles.filter((p): p is MissileProjectile => p.type === 'fission');
    expect(gen1.length).toBe(2);
    for (const c of gen1) expect(c.clusterCount).toBe(2);

    // Force them to detonate immediately, then tick again — this should
    // produce generation-2 children, and NONE of them may carry a
    // clusterCount of their own (the recursion must stop here).
    for (const c of gen1) c.targetPoint = { x: c.x, y: c.y };
    updateProjectiles(state, 0.02);
    const gen2 = state.projectiles.filter((p): p is MissileProjectile => p.type === 'fission');
    expect(gen2.length).toBe(4); // 2 parents x 2 children each
    for (const c of gen2) expect(c.clusterCount).toBeUndefined();

    // And critically: ticking again must NOT produce a third generation —
    // gen2 children have no clusterCount, so they just fly/detonate
    // normally with nothing left to spawn.
    for (const c of gen2) c.targetPoint = { x: c.x, y: c.y };
    updateProjectiles(state, 0.02);
    expect(state.projectiles.filter((p) => p.type === 'fission').length).toBe(0);
  });

  it('Sticky leaves a burning cloud behind at the detonation point', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.9);
    state.projectiles.push({
      type: 'fission',
      src: 'fission',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 220,
      dmg: 20,
      splashRadius: 34,
      radius: 6,
      color: '#ffd166',
      life: 5,
      targetPoint: { x: 305, y: 300 },
      armAt: 0,
      fissionGen: 0,
      stickyBurn: { dmgPerSec: 9, life: 2, radius: 26 },
    });

    updateProjectiles(state, 0.02);

    expect(state.clouds).toHaveLength(1);
    expect(state.clouds[0]!.dmgPerSec).toBe(9);
  });
});

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S3): the generic
// behaviour flags — a non-chain-type projectile (Bolt/Missile) gaining
// one of Chain's mechanics, or a wholly new one, via a socketed gem.
describe('updateProjectiles — behaviour flags', () => {
  it('pierce: passes through a hit instead of despawning, consuming one charge', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, pierce: 2 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.pierce).toBe(1);
  });

  it('pierce: despawns once its last charge is spent', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, pierce: 0 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('without pierce, an ordinary bolt still despawns on impact (no behaviour-flag regression)', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('forks: splits into children on first impact, each carrying a damage share', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, forks: 2 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(2);
    for (const child of state.projectiles) {
      expect(child.forks).toBe(0);
      expect(child.dmg).toBeLessThan(10);
      expect(child.dmg).toBeGreaterThan(0);
    }
  });

  it('forks: a child never forks again', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // Reveal a wide patch so the forked children also find something to hit.
    for (let dx = -20; dx <= 20; dx += 10) revealAt(state.grid, 305 + dx, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, forks: 2 });

    updateProjectiles(state, 0.1); // first impact — forks into 2
    const afterFirst = state.projectiles.length;
    updateProjectiles(state, 0.1); // children may hit again, but must not fork further

    expect(afterFirst).toBe(2);
    expect(state.projectiles.length).toBeLessThanOrEqual(2);
  });

  it('chains: a non-chain-type projectile hops to a nearby coagulant, decaying damage', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const c = makeCoagulant({ x: 320, y: 300, radius: 10 });
    state.coagulants = [c];
    state.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 300, // moves to x=309 in one 0.03s tick — inside the coagulant's 304..336 hit window
      vy: 0,
      dmg: 20,
      radius: 6,
      color: '#fff',
      life: 5,
      chains: 2,
    });

    updateProjectiles(state, 0.03);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.dmg).toBeLessThan(20);
    expect(state.projectiles[0]!.chains).toBe(1);
  });

  it('chains: despawns once its hop budget is exhausted', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, chains: 1 });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(0);
  });

  it('bounces: hops between coagulants only, ignoring a revealed grid cluster', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 302, 300, 0.6); // a closer grid cluster bounces must ignore
    const c = makeCoagulant({ x: 320, y: 300, radius: 10 }); // reachable in one 0.03s tick, matching the chains test above
    state.coagulants = [c];
    state.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      dmg: 20,
      radius: 6,
      color: '#fff',
      life: 5,
      bounces: 1,
    });

    updateProjectiles(state, 0.03);

    // With bounces exhausted at 0 and no second coagulant to hop to, it despawns —
    // the point under test is that the coagulant was hit at all (bounces fired).
    expect(c.mass).toBeLessThan(50);
  });

  it('bounces: never triggers on a plain grid-cluster hit, only a coagulant hit', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, bounces: 3 });

    updateProjectiles(state, 0.1);

    // No coagulant anywhere — the bounce condition (hitCoagulant) never
    // holds, so this behaves like a plain bolt: despawns on the grid hit.
    expect(state.projectiles).toHaveLength(0);
  });

  it('ricochet: reverses once along its path instead of despawning', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, ricochet: true });

    updateProjectiles(state, 0.1);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.vx).toBeLessThan(0); // reversed
    expect(state.projectiles[0]!.ricocheted).toBe(true);
  });

  it('ricochet: only reverses once — a second impact despawns it normally', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    revealAt(state.grid, 295, 300, 0.6); // on the reversed path
    state.projectiles.push({ type: 'bolt', src: 'bolt', x: 300, y: 300, vx: 10, vy: 0, dmg: 10, radius: 4, color: '#fff', life: 5, ricochet: true });

    updateProjectiles(state, 0.1); // first impact — reverses
    updateProjectiles(state, 0.1); // second impact — already ricocheted, despawns

    expect(state.projectiles).toHaveLength(0);
  });

  it('priority: forks takes precedence over chains when a projectile carries both', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.6);
    state.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 10,
      vy: 0,
      dmg: 10,
      radius: 4,
      color: '#fff',
      life: 5,
      forks: 2,
      chains: 3,
    });

    updateProjectiles(state, 0.1);

    // Forked into two children, not hopped as a single chaining projectile.
    expect(state.projectiles).toHaveLength(2);
  });

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Bolt's
  // Tracking Rounds — re-runs nearestFrontierPoint every tick and turns
  // toward it, unlike Homing's one-target-captured-at-spawn steering.
  it('reacquireRate: turns a bolt toward the nearest frontier point mid-flight', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A revealed cell north of the projectile's current position and path
    // — computeFrontier needs a real frontier scan, so seed it directly
    // via state.frontier instead (the same shape nearestFrontierPoint reads).
    state.tower.x = 300;
    state.tower.y = 300;
    state.frontier = new Float32Array(48);
    state.frontier.fill(9999);
    state.frontier[12] = 50; // sector pointing due "north" of the tower in this 48-sector scheme (index 12 of 48 = 90°)
    state.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 300, // flying due east
      vy: 0,
      dmg: 10,
      radius: 4,
      color: '#fff',
      life: 5,
      reacquireRate: Math.PI, // a large turn rate so one tick shows a clear result
    });

    updateProjectiles(state, 0.05);

    // Started flying due east (vy = 0); with a frontier point to the
    // "north" pulling it, vy should have turned away from exactly 0.
    expect(state.projectiles[0]!.vy).not.toBe(0);
  });
});

// Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3, Decision 91):
// a real bug caught while building this batch, not by the browser — the
// nine Conditional gems' fields reach a projectile at SPAWN (resolveOpts()
// is spread onto the projectile object in every weapon file), but
// updateProjectiles' own two clearAt call sites only ever forwarded a
// hardcoded subset of fields at IMPACT time. Every Conditional gem would
// have been silently inert on Bolt/Chain/Missile/Fission — three of ten
// weapons' worth of projectile paths — despite typechecking cleanly and
// every other test passing, since nothing exercised spawn-through-impact
// for a field outside that hardcoded list. Fixed by forwarding the full
// set at both call sites; these tests are the regression guard.
describe('Conditional gem fields survive spawn to impact (Phase 6D-2)', () => {
  it('Penetration (armorIgnoreCap) reaches the coagulant loop on a bolt-type projectile', () => {
    const withGem = freshState();
    withGem.grid = makeTestGrid();
    const target1 = makeCoagulant({ x: 305, y: 300, mass: 1000, armor: 40 });
    withGem.coagulants = [target1];
    withGem.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      dmg: 50,
      radius: 4,
      color: '#fff',
      life: 5,
      armorIgnoreCap: 30,
    });
    updateProjectiles(withGem, 0.02);
    const removedWith = 1000 - target1.mass;

    const without = freshState();
    without.grid = makeTestGrid();
    const target2 = makeCoagulant({ x: 305, y: 300, mass: 1000, armor: 40 });
    without.coagulants = [target2];
    without.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      dmg: 50,
      radius: 4,
      color: '#fff',
      life: 5,
    });
    updateProjectiles(without, 0.02);
    const removedWithout = 1000 - target2.mass;

    expect(removedWith).toBeGreaterThan(removedWithout);
  });

  it('Penetration (armorIgnoreCap) reaches the coagulant loop on a missile-type projectile', () => {
    const withGem = freshState();
    withGem.grid = makeTestGrid();
    const target1 = makeCoagulant({ x: 305, y: 300, mass: 1000, armor: 40 });
    withGem.coagulants = [target1];
    withGem.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 300,
      dmg: 50,
      splashRadius: 20,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 305, y: 300 },
      armAt: 0,
      armorIgnoreCap: 30,
    });
    updateProjectiles(withGem, 0.02);
    const removedWith = 1000 - target1.mass;

    const without = freshState();
    without.grid = makeTestGrid();
    const target2 = makeCoagulant({ x: 305, y: 300, mass: 1000, armor: 40 });
    without.coagulants = [target2];
    without.projectiles.push({
      type: 'missile',
      src: 'missile',
      x: 300,
      y: 300,
      vx: 300,
      vy: 0,
      speed: 300,
      dmg: 50,
      splashRadius: 20,
      radius: 5,
      color: '#ff9d6b',
      life: 5,
      targetPoint: { x: 305, y: 300 },
      armAt: 0,
    });
    updateProjectiles(without, 0.02);
    const removedWithout = 1000 - target2.mass;

    expect(removedWith).toBeGreaterThan(removedWithout);
  });

  it('Momentum (momentumMult / momentumKey) reaches the grid loop and updates state.weaponStreak on a bolt-type projectile', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    revealAt(state.grid, 305, 300, 0.9);
    state.weaponStreak.bolt = 2;
    state.projectiles.push({
      type: 'bolt',
      src: 'bolt',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      dmg: 10,
      radius: 4,
      color: '#fff',
      life: 5,
      momentumMult: 1,
      momentumKey: 'bolt',
    });

    updateProjectiles(state, 0.02);

    expect(state.weaponStreak.bolt).toBe(3);
  });
});
