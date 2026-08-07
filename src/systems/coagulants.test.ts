import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import { COAGULANT_ARRIVAL_DAMAGE_MULT, COAGULANT_SPLATTER } from '../tuning/coagulants';
import { findCoagulantHit, splatterOnDeath, updateCoagulants } from './coagulants';
import { attemptFormation } from './formation';

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 6400;
  return {
    cols: 80,
    rows: 80,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maturity: new Float32Array(size),
    matBucket: new Int8Array(size),
    maxRange: 1000,
    perimeter: 100,
    ...overrides,
  };
}

function makeCoagulant(overrides: Partial<Coagulant> = {}): Coagulant {
  return {
    x: 300,
    y: 300,
    mass: 50,
    armor: 0,
    kind: 'congealer',
    radius: 18,
    speed: 45,
    phase: 'active',
    phaseTimer: 0,
    seeds: [{ a: 0, r: 0.5, speed: 0.5, phase: 0 }],
    ...overrides,
  };
}

function totalGridMass(grid: Grid): number {
  let sum = 0;
  for (let i = 0; i < grid.growth.length; i++) sum += grid.growth[i]!;
  return sum;
}

describe('updateCoagulants — movement', () => {
  it('does nothing without a grid', () => {
    const state = freshState();
    state.coagulants = [makeCoagulant()];
    updateCoagulants(state, 0.1);
    expect(state.coagulants).toHaveLength(1); // untouched, not silently dropped
  });

  it('moves in a straight line toward the tower', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 700;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, radius: 5 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(1);
    const moved = state.coagulants[0]!;
    expect(moved.x).toBeGreaterThan(300); // stepped toward the tower on +x
    expect(moved.y).toBeCloseTo(300, 5); // tower is due east, no y drift
  });

  it('drops a coagulant whose mass already hit 0 from weapon damage this tick', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.coagulants = [makeCoagulant({ mass: 0 })];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(0);
  });
});

describe('updateCoagulants — forming phase (2026-08-06 follow-up session)', () => {
  it('does not move a forming coagulant, even one placed right on top of the tower', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 305, y: 300, radius: 5, phase: 'forming', phaseTimer: 1 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(1);
    expect(state.coagulants[0]!.x).toBe(305);
    expect(state.coagulants[0]!.y).toBe(300);
  });

  it('does not let a forming coagulant arrive at the tower, however close it sits', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, radius: 5, phase: 'forming', phaseTimer: 1 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(1);
    expect(state.tower.hp).toBe(state.tower.maxHp); // no arrival damage taken
  });

  it('counts down phaseTimer while forming, without becoming active early', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const c = makeCoagulant({ phase: 'forming', phaseTimer: 0.3 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants[0]!.phase).toBe('forming');
    expect(state.coagulants[0]!.phaseTimer).toBeCloseTo(0.2, 5);
  });

  it('transitions to active once phaseTimer expires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const c = makeCoagulant({ phase: 'forming', phaseTimer: 0.05 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants[0]!.phase).toBe('active');
  });

  it('moves normally the tick after it turns active', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 700;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, radius: 5, phase: 'forming', phaseTimer: 0.05 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1); // expires the timer, turns active
    updateCoagulants(state, 0.1); // now it should step toward the tower

    expect(state.coagulants).toHaveLength(1);
    expect(state.coagulants[0]!.x).toBeGreaterThan(300);
  });
});

describe('updateCoagulants — arrival (Rule 3)', () => {
  it('damages the tower proportional to mass on arrival', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.tower.radius = 22;
    const c = makeCoagulant({ x: 300, y: 305, mass: 80, radius: 5 }); // well within arrival distance
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    const expectedDamage = 80 * COAGULANT_ARRIVAL_DAMAGE_MULT;
    expect(state.tower.hp).toBeCloseTo(state.tower.maxHp - expectedDamage, 5);
  });

  it('removes the coagulant from play once it arrives', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.coagulants = [makeCoagulant({ x: 300, y: 305, radius: 5 })];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(0);
  });

  it('deposits its full mass back into the grid — arrival never destroys mass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const before = totalGridMass(state.grid);
    state.coagulants = [makeCoagulant({ x: 300, y: 305, mass: 60, radius: 5 })];

    updateCoagulants(state, 0.1);

    const after = totalGridMass(state.grid);
    expect(after - before).toBeCloseTo(60, 1);
  });

  it('spills outward beyond the first ring when a large arrival exceeds what it can hold', () => {
    // Grid cells cap at growth=1, so a big arrival needs real area, not
    // a fixed disc — this is the fix that keeps arrival conservation
    // exact (2026-08-06 follow-up session, point 4).
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const before = totalGridMass(state.grid);
    // A single ring of cells around the arrival point can hold at most a
    // handful of mass (capacity 1 per cell); 500 mass forces the deposit
    // well outward.
    state.coagulants = [makeCoagulant({ x: 300, y: 305, mass: 500, radius: 5 })];

    updateCoagulants(state, 0.1);

    const after = totalGridMass(state.grid);
    expect(after - before).toBeCloseTo(500, 0);
    // And it actually spread — cells several rings out from the arrival
    // point must have picked some of it up, not just the immediate cell.
    const farCell = worldToCell(state.grid, 300 + 100, 305);
    expect(state.grid.growth[gIdx(state.grid, farCell.cx, farCell.cy)]).toBeGreaterThan(0);
  });
});

describe('splatterOnDeath (Rule 2)', () => {
  it('deposits only the fixed splatter amount for the kind, not the mass it ate', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const before = totalGridMass(state.grid);
    // Mass is already 0 by the time this is called (a weapon just killed
    // it) — splatter is a bonus on top, not a refund of what was consumed.
    const c = makeCoagulant({ x: 300, y: 300, mass: 0, kind: 'behemoth' });

    splatterOnDeath(state, c);

    const after = totalGridMass(state.grid);
    expect(after - before).toBeCloseTo(COAGULANT_SPLATTER.behemoth, 1);
  });

  it('spawns particles as the death tell', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const before = state.particles.length;

    splatterOnDeath(state, makeCoagulant({ mass: 0 }));

    expect(state.particles.length).toBeGreaterThan(before);
  });

  it('counts toward the kill counter — the Phase 3A dormant stat wired up', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    expect(state.nodesPurged).toBe(0);

    splatterOnDeath(state, makeCoagulant({ mass: 0 }));

    expect(state.nodesPurged).toBe(1);
  });
});

describe('findCoagulantHit', () => {
  it('returns null when nothing is in range', () => {
    const state = freshState();
    state.coagulants = [makeCoagulant({ x: 1000, y: 1000, radius: 10 })];
    expect(findCoagulantHit(state, 0, 0, 10)).toBeNull();
  });

  it('returns a coagulant whose body overlaps the hit radius', () => {
    const state = freshState();
    const c = makeCoagulant({ x: 100, y: 100, radius: 20 });
    state.coagulants = [c];
    expect(findCoagulantHit(state, 110, 100, 5)).toBe(c);
  });

  it('ignores coagulants already at 0 mass', () => {
    const state = freshState();
    state.coagulants = [makeCoagulant({ x: 100, y: 100, radius: 20, mass: 0 })];
    expect(findCoagulantHit(state, 100, 100, 5)).toBeNull();
  });

  it('returns the nearest one when several overlap', () => {
    const state = freshState();
    const near = makeCoagulant({ x: 100, y: 100, radius: 20 });
    const far = makeCoagulant({ x: 400, y: 400, radius: 300 }); // huge, also overlaps
    state.coagulants = [far, near];
    expect(findCoagulantHit(state, 105, 100, 5)).toBe(near);
  });

  it("ignores a coagulant still in the 'forming' phase — it hasn't detached from the field yet (2026-08-06 follow-up session)", () => {
    const state = freshState();
    state.coagulants = [makeCoagulant({ x: 100, y: 100, radius: 20, phase: 'forming', phaseTimer: 1 })];
    expect(findCoagulantHit(state, 100, 100, 5)).toBeNull();
  });
});

describe('mass conservation — the invariant', () => {
  it('is exactly conserved across a full formation -> transit -> arrival cycle', () => {
    // The invariant docs/BACKLOG.md asks for: total mass (grid +
    // entities) changes only through the amounts weapons destroy and
    // growth adds — never through formation, transit, or arrival. This
    // exercises the whole cycle with no combat involved, so the total
    // should come out exactly where it started.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.tower.radius = 22;

    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 700, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        const i = gIdx(state.grid, ccx + ox, ccy + oy);
        state.grid.growth[i] = 0.9;
      }
    }

    const before = totalGridMass(state.grid);
    const coagulant = attemptFormation(state, 700, 300);
    expect(coagulant).not.toBeNull();

    const afterFormation = totalGridMass(state.grid) + coagulant!.mass;
    expect(afterFormation).toBeCloseTo(before, 5);

    // Walk it all the way to the tower.
    let ticks = 0;
    while (state.coagulants.length > 0 && ticks < 10_000) {
      updateCoagulants(state, 0.1);
      ticks++;
    }
    expect(ticks).toBeLessThan(10_000); // sanity: it actually arrived
    expect(state.coagulants).toHaveLength(0);

    const afterArrival = totalGridMass(state.grid);
    expect(afterArrival).toBeCloseTo(before, 3);
  });
});
