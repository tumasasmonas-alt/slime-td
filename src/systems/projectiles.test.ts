import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
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
});

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
    });

    updateProjectiles(state, 0.02);

    expect(state.projectiles).toHaveLength(0);
    expect(c.mass).toBeLessThan(50);
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
});
