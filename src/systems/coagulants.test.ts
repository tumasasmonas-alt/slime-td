import { describe, expect, it } from 'vitest';
import type { Coagulant, Grid } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import {
  CARRIER_MASS_CAP_MULT,
  COAGULANT_ARRIVAL_DAMAGE_MULT,
  COAGULANT_SPLATTER,
  coagulantRadius,
  coagulantSpeed,
} from '../tuning/coagulants';
import { coagulantOverlapArea, coagulantSurfaceDist, findCoagulantHit, splatterOnDeath, updateCoagulants } from './coagulants';
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
    splitAtMass: 0,
    sourceMaturity: 0,
    parts: [],
    startMass: 50,
    lastHitAt: -Infinity,
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

describe('updateCoagulants — Blastoma split (Phase 4C-1, Decision 68)', () => {
  it('splits into exactly two fragments once mass drops to splitAtMass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000; // far away, so it doesn't also arrive this tick
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'blastoma', splitAtMass: 40, radius: 20 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(2);
  });

  it('conserves mass exactly across the split', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'blastoma', splitAtMass: 40, radius: 20 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    const totalFragmentMass = state.coagulants.reduce((sum, f) => sum + f.mass, 0);
    expect(totalFragmentMass).toBeCloseTo(40, 5);
    expect(state.coagulants[0]!.mass).toBeCloseTo(state.coagulants[1]!.mass, 5);
  });

  it('fragments never re-split, however far they are damaged afterward', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'blastoma', splitAtMass: 40, radius: 20 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);
    for (const f of state.coagulants) expect(f.splitAtMass).toBe(0);

    // Drive a fragment's mass down further and run another tick — it must
    // not split again.
    state.coagulants[0]!.mass = 1;
    updateCoagulants(state, 0.1);
    expect(state.coagulants).toHaveLength(2); // still exactly two, not three or four
  });

  it("derives each fragment's kind from its own mass (Rule 4), not the parent's", () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'blastoma', splitAtMass: 40, radius: 20 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    for (const f of state.coagulants) {
      expect(f.kind).not.toBe('blastoma');
      expect(f.kind).not.toBe('sclerotic');
    }
  });

  it('inherits armor and sourceMaturity from the parent — fragments of hardened ground are still hardened', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const c = makeCoagulant({
      x: 300,
      y: 300,
      mass: 40,
      kind: 'blastoma',
      splitAtMass: 40,
      radius: 20,
      armor: 12,
      sourceMaturity: 0.6,
    });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    for (const f of state.coagulants) {
      expect(f.armor).toBe(12);
      expect(f.sourceMaturity).toBe(0.6);
    }
  });

  it('does not split a coagulant still in the forming phase', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const c = makeCoagulant({
      mass: 40,
      kind: 'blastoma',
      splitAtMass: 40,
      phase: 'forming',
      phaseTimer: 1,
    });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants).toHaveLength(1);
    expect(state.coagulants[0]!.phase).toBe('forming');
  });
});

describe('updateCoagulants — Carrier feeding (Phase 4C-2, Decision 69)', () => {
  it('consumes nearby revealed growth and adds it to its own mass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000; // far away, so it doesn't also move meaningfully or arrive
    state.tower.y = 300;
    // Saturate a patch around the carrier's position so it has something
    // to feed on.
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 0.9;
      }
    }
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'carrier', startMass: 40 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants[0]!.mass).toBeGreaterThan(40);
  });

  it('conserves mass exactly — the grid loses exactly what the entity gains', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 0.9;
      }
    }
    const before = totalGridMass(state.grid) + 40;
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'carrier', startMass: 40 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    const after = totalGridMass(state.grid) + state.coagulants.reduce((sum, x) => sum + x.mass, 0);
    expect(after).toBeCloseTo(before, 5);
  });

  it('stops growing once it hits its cap, relative to its own starting mass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 1;
      }
    }
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'carrier', startMass: 40 });
    state.coagulants = [c];

    // Run many ticks, re-saturating the patch each time so it never runs
    // out of food -- isolates the cap from "the field ran dry."
    for (let i = 0; i < 500; i++) {
      for (let oy = -3; oy <= 3; oy++) {
        for (let ox = -3; ox <= 3; ox++) {
          state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 1;
        }
      }
      updateCoagulants(state, 0.1);
    }

    expect(state.coagulants[0]!.mass).toBeLessThanOrEqual(40 * CARRIER_MASS_CAP_MULT + 1e-6);
  });

  it('updates radius and speed as it grows, consistent with its new mass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 0.9;
      }
    }
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'carrier', startMass: 40, radius: coagulantRadius(40) });

    state.coagulants = [c];
    updateCoagulants(state, 0.1);

    const grown = state.coagulants[0]!;
    expect(grown.radius).toBeCloseTo(coagulantRadius(grown.mass), 5);
    expect(grown.speed).toBeCloseTo(coagulantSpeed(grown.mass), 5);
  });

  it('does not feed while still in the forming phase', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 0.9;
      }
    }
    const c = makeCoagulant({
      x: 300,
      y: 300,
      mass: 40,
      kind: 'carrier',
      startMass: 40,
      phase: 'forming',
      phaseTimer: 1,
    });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants[0]!.mass).toBe(40);
  });

  it('leaves a non-carrier kind untouched even sitting on saturated ground', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 3000;
    state.tower.y = 300;
    const { cx: ccx, cy: ccy } = worldToCell(state.grid, 300, 300);
    for (let oy = -3; oy <= 3; oy++) {
      for (let ox = -3; ox <= 3; ox++) {
        state.grid.growth[gIdx(state.grid, ccx + ox, ccy + oy)] = 0.9;
      }
    }
    const c = makeCoagulant({ x: 300, y: 300, mass: 40, kind: 'congealer', startMass: 40 });
    state.coagulants = [c];

    updateCoagulants(state, 0.1);

    expect(state.coagulants[0]!.mass).toBe(40);
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

  describe('multi-part bodies (Phase 4C-2, Decision 69)', () => {
    // Two parts 30px either side of centre, radius 15 each, bounding
    // circle 60 -- deliberately leaves a real gap between the two parts'
    // surfaces (each ends 15px short of centre) that the bounding circle
    // alone doesn't know about.
    function makeTwoPartBody(): Coagulant {
      return makeCoagulant({
        x: 300,
        y: 300,
        radius: 60,
        parts: [
          { dx: -30, dy: 0, r: 15 },
          { dx: 30, dy: 0, r: 15 },
        ],
      });
    }

    it('finds nothing in the gap between two parts, despite being inside the bounding circle', () => {
      const state = freshState();
      const body = makeTwoPartBody();
      state.coagulants = [body];
      expect(findCoagulantHit(state, 300, 300, 5)).toBeNull();
    });

    it('finds the body when the point actually touches a part', () => {
      const state = freshState();
      const body = makeTwoPartBody();
      state.coagulants = [body];
      expect(findCoagulantHit(state, 270, 300, 5)).toBe(body); // centre of the left part
    });
  });
});

describe('coagulantSurfaceDist (Phase 4C-2, Decision 69)', () => {
  it('matches the bounding-circle formula when parts is empty — single-part regression guard', () => {
    const c = makeCoagulant({ x: 0, y: 0, radius: 20 });
    expect(coagulantSurfaceDist(c, 30, 0)).toBeCloseTo(10, 5); // 30 away, minus 20 radius
  });

  it('measures distance to the nearest part, not the centre, when parts exist', () => {
    const c = makeCoagulant({
      x: 300,
      y: 300,
      radius: 60,
      parts: [
        { dx: -30, dy: 0, r: 15 },
        { dx: 30, dy: 0, r: 15 },
      ],
    });
    // Sitting exactly between the two parts: 30px from each centre, minus
    // each part's own 15px radius.
    expect(coagulantSurfaceDist(c, 300, 300)).toBeCloseTo(15, 5);
  });

  it('never goes negative — a point already inside a part reads as touching (0), not overlapping past it', () => {
    const c = makeCoagulant({ x: 300, y: 300, radius: 60, parts: [{ dx: 0, dy: 0, r: 15 }] });
    expect(coagulantSurfaceDist(c, 300, 300)).toBe(0);
  });
});

describe('coagulantOverlapArea (Phase 4C-2, Decision 69)', () => {
  it('matches a plain circleOverlapArea when parts is empty — single-part regression guard', () => {
    const c = makeCoagulant({ x: 0, y: 0, radius: 20 });
    const withEmptyParts = coagulantOverlapArea(c, 10, 0, 15);
    expect(withEmptyParts).toBeGreaterThan(0);
  });

  it('is 0 for a hit in the gap between two parts, even inside the bounding circle', () => {
    const c = makeCoagulant({
      x: 300,
      y: 300,
      radius: 60,
      parts: [
        { dx: -30, dy: 0, r: 15 },
        { dx: 30, dy: 0, r: 15 },
      ],
    });
    // 15px outside both parts' surfaces (see coagulantSurfaceDist test
    // above), so a small hit here connects with nothing.
    expect(coagulantOverlapArea(c, 300, 300, 5)).toBe(0);
  });

  it('sums overlap across multiple parts — a hit reaching both parts is more than the same hit reaching only one', () => {
    const c = makeCoagulant({
      x: 300,
      y: 300,
      radius: 60,
      parts: [
        { dx: -30, dy: 0, r: 15 },
        { dx: 30, dy: 0, r: 15 },
      ],
    });
    const oneSide = coagulantOverlapArea(c, 270, 300, 10); // centred on the left part only
    const bothSides = coagulantOverlapArea(c, 300, 300, 40); // centred on the gap, reaching both
    expect(bothSides).toBeGreaterThan(oneSide);
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

  it('holds through a mid-transit Blastoma split too (Phase 4C-1, Decision 68) — mass moving between two entities, not just grid and entity', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    state.tower.radius = 22;

    // A thin corridor, not a solid block — fragmented shape, so this
    // forms a Blastoma rather than a congealer/behemoth.
    const startX = 700;
    const startY = 300;
    const { cx: startCx, cy: centerCy } = worldToCell(state.grid, startX, startY);
    for (let dx = 0; dx <= 15; dx++) {
      for (let oy = -1; oy <= 1; oy++) {
        const i = gIdx(state.grid, startCx - dx, centerCy + oy);
        state.grid.growth[i] = 0.9;
      }
    }

    const before = totalGridMass(state.grid);
    const coagulant = attemptFormation(state, startX, startY);
    expect(coagulant).not.toBeNull();
    expect(coagulant!.kind).toBe('blastoma');
    expect(coagulant!.splitAtMass).toBeGreaterThan(0);

    // Nothing damages a coagulant on its own — mass only drops via
    // clearAt (weapon fire), which this test deliberately doesn't invoke,
    // so the split would never actually trigger during a silent walk.
    // Simulate exactly one external hit that brings it down to its split
    // threshold, and fold the amount it destroys into the invariant's
    // baseline — isolating the *split's* conservation property (does
    // mass survive moving from one entity into two?) from clearAt's
    // (tested separately: does a hit destroy exactly what it removes?).
    let destroyed = 0;
    let hitApplied = false;

    let ticks = 0;
    let sawTwoFragments = false;
    while (state.coagulants.length > 0 && ticks < 20_000) {
      if (!hitApplied) {
        const c = state.coagulants[0]!;
        destroyed = c.mass - c.splitAtMass;
        c.mass = c.splitAtMass;
        hitApplied = true;
      }
      updateCoagulants(state, 0.1);
      if (state.coagulants.length === 2) sawTwoFragments = true;
      const currentTotal = totalGridMass(state.grid) + state.coagulants.reduce((sum, c) => sum + c.mass, 0);
      expect(currentTotal).toBeCloseTo(before - destroyed, 2);
      ticks++;
    }
    expect(sawTwoFragments).toBe(true); // confirms the split actually happened during the walk
    expect(ticks).toBeLessThan(20_000);
    expect(state.coagulants).toHaveLength(0);

    const afterArrival = totalGridMass(state.grid);
    expect(afterArrival).toBeCloseTo(before - destroyed, 1);
  });
});
