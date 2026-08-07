import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { cellBucket, gIdx, worldToCell } from '../grid/grid';
import {
  ARMOR_AT_FULL_MATURITY,
  BLASTOMA_SPLIT_FRACTION,
  CORRIDOR_DENSITY_THRESHOLD,
  FORMATION_MIN_DISTANCE,
  FORMATION_RADIUS_CAP,
  FORMATION_RISE_DURATION,
  FRAGMENTATION_THRESHOLD,
  MASS_BEHEMOTH,
  MASS_BULWARK,
  MASS_CONGEALER,
  MASS_MIN_FORMATION,
  MATURITY_SCLEROTIC_THRESHOLD,
  coagulantArmor,
  coagulantKindFrom,
  coagulantKindFromMass,
  coagulantRadius,
  coagulantSpeed,
} from '../tuning/coagulants';
import { attemptFormation } from './formation';

// Large enough to hold FORMATION_RADIUS_CAP (180px) comfortably at this
// cellSize, with room to spare for "outside the cap" assertions.
function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 6400;
  return {
    cols: 80,
    rows: 80,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size), // 0 everywhere -> any growth > 0 is revealed
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

// Fills a square block of revealed cells around the grid center at a
// given density, for controlled flood-fill scenarios.
function fillSquare(grid: Grid, centerX: number, centerY: number, halfWidthPx: number, density: number): void {
  const { cx: ccx, cy: ccy } = worldToCell(grid, centerX, centerY);
  const half = Math.ceil(halfWidthPx / grid.cellSize);
  for (let oy = -half; oy <= half; oy++) {
    const cy = ccy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -half; ox <= half; ox++) {
      const cx = ccx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      const i = gIdx(grid, cx, cy);
      grid.growth[i] = density;
      // Real growth-writing code always keeps `bucket` in sync with
      // `growth` as it writes (see clearAt, applyAmbientGrowth) — stamp
      // it here too, so a synthetic fixture doesn't leave a stale
      // "everything defaults to bucket 0" array that makes every drain
      // look like a no-op transition regardless of what actually changed.
      grid.bucket[i] = cellBucket(grid, i);
    }
  }
}

// Sets maturity (not growth) over the same footprint fillSquare would
// cover, for controlled identity scenarios — Wave 2 kinds (Phase 4C-1)
// read maturity alongside mass.
function fillMaturity(grid: Grid, centerX: number, centerY: number, halfWidthPx: number, maturity: number): void {
  const { cx: ccx, cy: ccy } = worldToCell(grid, centerX, centerY);
  const half = Math.ceil(halfWidthPx / grid.cellSize);
  for (let oy = -half; oy <= half; oy++) {
    const cy = ccy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -half; ox <= half; ox++) {
      const cx = ccx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      grid.maturity[gIdx(grid, cx, cy)] = maturity;
    }
  }
}

// A thin revealed corridor reaching far from its start, rather than a
// solid block — for the fragmentation metric (Phase 4C-1): it should
// reach far (high maxDist) while visiting few cells (low fillRatio),
// exactly the shape §10 describes a vein having "webbed through an area."
function fillCorridor(grid: Grid, startX: number, startY: number, lengthPx: number, widthPx: number, density: number): void {
  const { cx: startCx, cy: centerCy } = worldToCell(grid, startX, startY);
  const lengthCells = Math.round(lengthPx / grid.cellSize);
  const halfWidthCells = Math.max(1, Math.round(widthPx / grid.cellSize / 2));
  for (let dx = 0; dx <= lengthCells; dx++) {
    const cx = startCx + dx;
    if (cx < 0 || cx >= grid.cols) continue;
    for (let oy = -halfWidthCells; oy <= halfWidthCells; oy++) {
      const cy = centerCy + oy;
      if (cy < 0 || cy >= grid.rows) continue;
      const i = gIdx(grid, cx, cy);
      grid.growth[i] = density;
      grid.bucket[i] = cellBucket(grid, i);
    }
  }
}

describe('attemptFormation', () => {
  it('does nothing without a grid yet', () => {
    const state = freshState();
    const result = attemptFormation(state, 400, 400);
    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
  });

  it('forms nothing when the spark lands on unrevealed ground', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // growth stays 0 everywhere -> not revealed anywhere.
    const result = attemptFormation(state, 400, 400);
    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
  });

  it('forms nothing when the contiguous mass is below the minimum threshold', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A single thin revealed cell — nowhere near enough mass.
    const { cx, cy } = worldToCell(state.grid, 400, 400);
    state.grid.growth[gIdx(state.grid, cx, cy)] = 0.05;

    const result = attemptFormation(state, 400, 400);

    expect(result).toBeNull();
    expect(state.coagulants).toHaveLength(0);
    // And nothing was drained — the untouched cell still holds its density.
    expect(state.grid.growth[gIdx(state.grid, cx, cy)]).toBeCloseTo(0.05, 5);
  });

  it('forms a coagulant and drains exactly the flood-filled cells, once mass clears the minimum', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9); // well above MASS_MIN_FORMATION

    const before = state.grid.growth.reduce((a, b) => a + b, 0);
    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(state.coagulants).toHaveLength(1);
    expect(state.coagulants[0]).toBe(result);
    expect(result!.mass).toBeGreaterThanOrEqual(MASS_MIN_FORMATION);

    const after = state.grid.growth.reduce((a, b) => a + b, 0);
    // Rule 1: formation is a sink. Whatever mass the coagulant now holds
    // came directly out of the grid, not from nowhere.
    expect(before - after).toBeCloseTo(result!.mass, 5);
  });

  it('gates on revealed density, never raw density — bug #3 discipline', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    const { cx, cy } = worldToCell(state.grid, 400, 400);
    const i = gIdx(state.grid, cx, cy);
    state.grid.threshold[i] = 0.9; // high threshold -- not revealed yet
    state.grid.growth[i] = 0.5; // well above MASS_MIN_FORMATION in isolation, but unrevealed

    const result = attemptFormation(state, 400, 400);

    expect(result).toBeNull();
    expect(state.grid.growth[i]).toBe(0.5); // untouched
  });

  it("bounds mass to a formation footprint — doesn't scale with a saturated field far past the radius cap", () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A field far larger than FORMATION_RADIUS_CAP in every direction,
    // fully saturated. Under an unbounded flood-fill this would return
    // "the entire field" as one region (2026-08-05 record §9); bounded,
    // it should return only what fits inside the radius cap.
    fillSquare(state.grid, 400, 400, FORMATION_RADIUS_CAP * 3, 1.0);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    // Area within the radius cap at density 1: pi * r^2 / cellSize^2,
    // generously bounded (flood-fill is a diamond/box approximation of a
    // circle, not exact) rather than asserting an exact figure.
    const looseUpperBound = (FORMATION_RADIUS_CAP * FORMATION_RADIUS_CAP * 4) / (state.grid.cellSize * state.grid.cellSize);
    expect(result!.mass).toBeLessThan(looseUpperBound);

    // Cells well outside the cap must be untouched.
    const farOut = worldToCell(state.grid, 400 + FORMATION_RADIUS_CAP * 2.5, 400);
    expect(state.grid.growth[gIdx(state.grid, farOut.cx, farOut.cy)]).toBe(1.0);
  });

  it('picks the coagulant kind from the mass thresholds, consistently with coagulantKindFromMass', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // A modest patch that should land as a mote.
    fillSquare(state.grid, 400, 400, 15, 0.5);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.kind).toBe(coagulantKindFromMass(result!.mass));
  });

  it('sets radius from coagulantRadius(mass) and armor to 0 (Wave 1)', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.radius).toBeCloseTo(coagulantRadius(result!.mass), 5);
    expect(result!.armor).toBe(0);
  });

  it('generates seeds up front rather than leaving them empty for a draw call to fill in', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.seeds.length).toBeGreaterThan(0);
  });

  it('marks touched cells dirty so the slime layer repaints the crater', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    attemptFormation(state, 400, 400);

    expect(state.dirty.size).toBeGreaterThan(0);
  });

  it('drains mass but leaves maturity untouched — the horde eats mass, not terrain (Decision 25/63)', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);
    const { cx, cy } = worldToCell(state.grid, 400, 400);
    const idx = gIdx(state.grid, cx, cy);
    state.grid.maturity[idx] = 0.4; // pre-scarred, as if the player had fought here before

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(state.grid.growth[idx]).toBe(0); // mass drained
    expect(state.grid.maturity[idx]).toBeCloseTo(0.4, 5); // maturity untouched
  });

  it('starts in the forming phase, not immediately active', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    fillSquare(state.grid, 400, 400, 30, 0.9);

    const result = attemptFormation(state, 400, 400);

    expect(result).not.toBeNull();
    expect(result!.phase).toBe('forming');
    expect(result!.phaseTimer).toBe(FORMATION_RISE_DURATION);
  });

  describe('Wave 2 identity (Phase 4C-1, Decision 68)', () => {
    it('forms a sclerotic when the source ground is highly matured, regardless of mass tier', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      // A modest patch — mass alone would land as a mote or congealer —
      // but scarred well above MATURITY_SCLEROTIC_THRESHOLD. Comfortably
      // above MASS_MIN_FORMATION (10), not right at the boundary.
      fillSquare(state.grid, 400, 400, 20, 0.5);
      fillMaturity(state.grid, 400, 400, 20, MATURITY_SCLEROTIC_THRESHOLD + 0.1);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('sclerotic');
    });

    it('leaves virgin-ground kinds alone — maturity 0 never triggers sclerotic', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 30, 0.9);
      // maturity stays 0 -- untouched

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.kind).not.toBe('sclerotic');
    });

    it('forms a blastoma from a thin, far-reaching corridor — fragmented mass, not a solid patch', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      // Reaches far (high maxDist) while visiting few cells (low
      // fillRatio) -- the "webbed through an area" shape from §10, not
      // MATURITY_SCLEROTIC_THRESHOLD-scarred, so identity has to come
      // from shape, not maturity.
      fillCorridor(state.grid, 400, 400, 150, 20, 0.9);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.mass).toBeGreaterThanOrEqual(MASS_CONGEALER);
      expect(result!.kind).toBe('blastoma');
    });

    it('does NOT form a blastoma from an equivalent-mass solid patch — shape, not just mass, must be fragmented', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      // A solid square with comparable total mass to the corridor case
      // above (~44 vs ~43), but filling its own footprint almost
      // completely rather than reaching far through a thin path.
      fillSquare(state.grid, 400, 400, 30, 0.9);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.mass).toBeGreaterThanOrEqual(MASS_CONGEALER);
      expect(result!.kind).not.toBe('blastoma');
    });

    it('sets armor from source maturity via coagulantArmor, and ~0 on virgin ground', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 20, 0.9);
      fillMaturity(state.grid, 400, 400, 20, 0.6);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.armor).toBeCloseTo(coagulantArmor(result!.sourceMaturity), 5);
      expect(result!.armor).toBeGreaterThan(0);

      const virgin = freshState();
      virgin.grid = makeTestGrid();
      fillSquare(virgin.grid, 400, 400, 20, 0.9);
      const virginResult = attemptFormation(virgin, 400, 400);
      expect(virginResult!.armor).toBe(0);
    });

    it('gives a blastoma a positive splitAtMass at BLASTOMA_SPLIT_FRACTION of its starting mass; every other kind gets 0', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillCorridor(state.grid, 400, 400, 150, 20, 0.9);

      const blastoma = attemptFormation(state, 400, 400);

      expect(blastoma).not.toBeNull();
      expect(blastoma!.kind).toBe('blastoma');
      expect(blastoma!.splitAtMass).toBeCloseTo(blastoma!.mass * BLASTOMA_SPLIT_FRACTION, 5);

      const solid = freshState();
      solid.grid = makeTestGrid();
      fillSquare(solid.grid, 400, 400, 30, 0.9);
      const congealer = attemptFormation(solid, 400, 400);
      expect(congealer!.splitAtMass).toBe(0);
    });

    it('drains mass into the coagulant but leaves maturity on the grid, even for a sclerotic (Decision 25/63 still holds)', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 20, 0.9);
      fillMaturity(state.grid, 400, 400, 20, 0.6);
      const { cx, cy } = worldToCell(state.grid, 400, 400);
      const idx = gIdx(state.grid, cx, cy);

      attemptFormation(state, 400, 400);

      expect(state.grid.growth[idx]).toBe(0);
      expect(state.grid.maturity[idx]).toBeCloseTo(0.6, 5);
    });
  });

  describe('Carrier and Bulwark (Phase 4C-2, Decision 69)', () => {
    it('forms a carrier when the corridor to the core is thick, even though the spark point itself is an ordinary patch', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 400;
      const sparkX = 650;
      const sparkY = 400;
      // Dense corridor spanning tower -> spark (500px). FORMATION_RADIUS_CAP
      // (180px) only lets the flood-fill drain the spark-end portion of it,
      // so most of the corridor -- and most of sampleCorridorDensity's
      // sample points -- stay at full density for the reading.
      fillCorridor(state.grid, state.tower.x, sparkY, 500, 30, 0.9);

      const result = attemptFormation(state, sparkX, sparkY);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('carrier');
    });

    it('does NOT form a carrier when the field near the spark is dense but the corridor back to the core is clear', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 400;
      const sparkX = 650;
      const sparkY = 400;
      // Mass only at the spark point -- a clean corridor the rest of the
      // way, exactly the "a good player never meets one" case (§10).
      fillSquare(state.grid, sparkX, sparkY, 30, 0.9);

      const result = attemptFormation(state, sparkX, sparkY);

      expect(result).not.toBeNull();
      expect(result!.kind).not.toBe('carrier');
    });

    it('a carrier starts with no extra parts and startMass equal to its formation mass', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 150;
      state.tower.y = 400;
      fillCorridor(state.grid, state.tower.x, 400, 500, 30, 0.9);

      const result = attemptFormation(state, 650, 400);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('carrier');
      expect(result!.parts).toHaveLength(0);
      expect(result!.startMass).toBeCloseTo(result!.mass, 5);
    });

    it('forms a bulwark at high maturity AND high mass — the table cell 4C-1 left falling through to sclerotic', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 60, 1.0); // mass well above MASS_BULWARK
      fillMaturity(state.grid, 400, 400, 60, MATURITY_SCLEROTIC_THRESHOLD + 0.1);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.mass).toBeGreaterThanOrEqual(MASS_BULWARK);
      expect(result!.kind).toBe('bulwark');
    });

    it("a bulwark's body is a multi-part line, and its bounding radius actually encloses every part", () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 60, 1.0);
      fillMaturity(state.grid, 400, 400, 60, MATURITY_SCLEROTIC_THRESHOLD + 0.1);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('bulwark');
      expect(result!.parts.length).toBeGreaterThan(1);
      for (const part of result!.parts) {
        const reach = Math.hypot(part.dx, part.dy) + part.r;
        expect(reach).toBeLessThanOrEqual(result!.radius + 1e-6);
      }
    });

    it("a bulwark's parts are arranged perpendicular to its direction of travel toward the core", () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 400;
      state.tower.y = 900; // due south of the spark, at (400, 400)
      fillSquare(state.grid, 400, 400, 60, 1.0);
      fillMaturity(state.grid, 400, 400, 60, MATURITY_SCLEROTIC_THRESHOLD + 0.1);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe('bulwark');
      // Travel is along y (south); parts perpendicular to that should be
      // spread along x, with negligible y offset.
      for (const part of result!.parts) {
        expect(Math.abs(part.dy)).toBeLessThan(1);
      }
      const xs = result!.parts.map((p) => p.dx);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
    });

    it('does not form a bulwark below MASS_BULWARK, even at full maturity — falls through to sclerotic', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      fillSquare(state.grid, 400, 400, 20, 0.5); // modest mass, well under MASS_BULWARK
      fillMaturity(state.grid, 400, 400, 20, MATURITY_SCLEROTIC_THRESHOLD + 0.1);

      const result = attemptFormation(state, 400, 400);

      expect(result).not.toBeNull();
      expect(result!.mass).toBeLessThan(MASS_BULWARK);
      expect(result!.kind).toBe('sclerotic');
      expect(result!.parts).toHaveLength(0);
    });
  });

  describe('the perimeter distance gate (2026-08-06 follow-up session)', () => {
    it('refuses to form within perimeter + FORMATION_MIN_DISTANCE of the core, however much mass is available', () => {
      const state = freshState();
      state.grid = makeTestGrid(); // perimeter: 100
      state.tower.x = 400;
      state.tower.y = 400;
      // Spark point well inside the gate (distance ~50, gate is 100+30=130),
      // with abundant mass sitting right there.
      fillSquare(state.grid, 400, 450, 30, 0.9);

      const result = attemptFormation(state, 400, 450);

      expect(result).toBeNull();
      expect(state.coagulants).toHaveLength(0);
      // And nothing was drained — the gate rejects before the flood-fill runs.
      const before = worldToCell(state.grid, 400, 450);
      expect(state.grid.growth[gIdx(state.grid, before.cx, before.cy)]).toBeCloseTo(0.9, 5);
    });

    it('forms normally just outside perimeter + FORMATION_MIN_DISTANCE', () => {
      const state = freshState();
      state.grid = makeTestGrid();
      state.tower.x = 400;
      state.tower.y = 400;
      const gateDist = state.grid.perimeter + FORMATION_MIN_DISTANCE;
      const sparkY = 400 - gateDist - 20; // comfortably outside the gate
      fillSquare(state.grid, 400, sparkY, 30, 0.9);

      const result = attemptFormation(state, 400, sparkY);

      expect(result).not.toBeNull();
    });
  });
});

describe('coagulantSpeed', () => {
  it('is slower for a larger mass — "big mass, slow movement" holds continuously, not just per-kind', () => {
    const small = coagulantSpeed(MASS_MIN_FORMATION);
    const mid = coagulantSpeed(MASS_CONGEALER);
    const big = coagulantSpeed(MASS_BEHEMOTH);
    expect(small).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(big);
  });

  it('never drops below the floor, however large the mass', () => {
    expect(coagulantSpeed(MASS_BEHEMOTH * 100)).toBeGreaterThan(0);
  });
});

describe('coagulantKindFromMass', () => {
  it('is a mote below the congealer threshold', () => {
    expect(coagulantKindFromMass(MASS_MIN_FORMATION)).toBe('mote');
    expect(coagulantKindFromMass(MASS_CONGEALER - 0.01)).toBe('mote');
  });

  it('is a congealer at/above the congealer threshold, below the behemoth threshold', () => {
    expect(coagulantKindFromMass(MASS_CONGEALER)).toBe('congealer');
    expect(coagulantKindFromMass(MASS_BEHEMOTH - 0.01)).toBe('congealer');
  });

  it('is a behemoth at/above the behemoth threshold', () => {
    expect(coagulantKindFromMass(MASS_BEHEMOTH)).toBe('behemoth');
    expect(coagulantKindFromMass(MASS_BEHEMOTH * 10)).toBe('behemoth');
  });

  it('never returns a Wave 2 kind — sclerotic/blastoma need coagulantKindFrom, not this', () => {
    for (const mass of [0, MASS_MIN_FORMATION, MASS_CONGEALER, MASS_BEHEMOTH, MASS_BEHEMOTH * 50]) {
      const kind = coagulantKindFromMass(mass);
      expect(kind).not.toBe('sclerotic');
      expect(kind).not.toBe('blastoma');
    }
  });
});

describe('coagulantKindFrom (Phase 4C-1/4C-2, Decision 68/69)', () => {
  it('is sclerotic at/above MATURITY_SCLEROTIC_THRESHOLD when mass is below MASS_BULWARK, regardless of fill ratio or corridor', () => {
    expect(coagulantKindFrom(MASS_MIN_FORMATION, MATURITY_SCLEROTIC_THRESHOLD, 1, 0)).toBe('sclerotic');
    expect(coagulantKindFrom(MASS_BULWARK - 0.01, MATURITY_SCLEROTIC_THRESHOLD, 0.01, 1)).toBe('sclerotic');
  });

  it('is bulwark at/above MATURITY_SCLEROTIC_THRESHOLD and at/above MASS_BULWARK — the high-mass, scarred table cell', () => {
    expect(coagulantKindFrom(MASS_BULWARK, MATURITY_SCLEROTIC_THRESHOLD, 1, 0)).toBe('bulwark');
    expect(coagulantKindFrom(MASS_BULWARK * 3, MATURITY_SCLEROTIC_THRESHOLD, 0.01, 1)).toBe('bulwark');
  });

  it('is carrier when the corridor is thick, below the maturity threshold — pure failure-gate, independent of mass or shape', () => {
    expect(coagulantKindFrom(MASS_MIN_FORMATION, 0, 1, CORRIDOR_DENSITY_THRESHOLD)).toBe('carrier');
    expect(coagulantKindFrom(MASS_BEHEMOTH, 0, 0.01, CORRIDOR_DENSITY_THRESHOLD + 0.1)).toBe('carrier');
  });

  it('maturity beats corridor — a thick corridor through scarred ground still yields sclerotic/bulwark, not carrier', () => {
    expect(coagulantKindFrom(MASS_MIN_FORMATION, MATURITY_SCLEROTIC_THRESHOLD, 1, 1)).toBe('sclerotic');
  });

  it('is blastoma below the maturity threshold and below the corridor threshold, when mass clears MASS_CONGEALER and fillRatio is fragmented', () => {
    expect(coagulantKindFrom(MASS_CONGEALER, 0, FRAGMENTATION_THRESHOLD - 0.01, 0)).toBe('blastoma');
  });

  it('is never blastoma when fillRatio is solid, even at high mass', () => {
    expect(coagulantKindFrom(MASS_BEHEMOTH, 0, 1, 0)).toBe('behemoth');
  });

  it('is never blastoma below MASS_CONGEALER, however fragmented', () => {
    expect(coagulantKindFrom(MASS_CONGEALER - 0.01, 0, 0, 0)).toBe('mote');
  });

  it('falls back to the ordinary mass tiers when maturity, shape, and corridor are all unremarkable', () => {
    expect(coagulantKindFrom(MASS_MIN_FORMATION, 0, 1, 0)).toBe(coagulantKindFromMass(MASS_MIN_FORMATION));
    expect(coagulantKindFrom(MASS_BEHEMOTH, 0, 1, 0)).toBe(coagulantKindFromMass(MASS_BEHEMOTH));
  });
});

describe('coagulantArmor (Phase 4C-1, Decision 68)', () => {
  it('is 0 at zero maturity and ARMOR_AT_FULL_MATURITY at maturity 1', () => {
    expect(coagulantArmor(0)).toBe(0);
    expect(coagulantArmor(1)).toBeCloseTo(ARMOR_AT_FULL_MATURITY, 5);
  });

  it('is monotonically increasing with maturity', () => {
    expect(coagulantArmor(0.7)).toBeGreaterThan(coagulantArmor(0.3));
  });

  it('clamps out-of-range maturity rather than exceeding ARMOR_AT_FULL_MATURITY', () => {
    expect(coagulantArmor(5)).toBeCloseTo(ARMOR_AT_FULL_MATURITY, 5);
  });
});

describe('coagulantRadius', () => {
  it('grows with mass — area is proportional to mass, not a flat size stat', () => {
    const small = coagulantRadius(MASS_MIN_FORMATION);
    const big = coagulantRadius(MASS_BEHEMOTH);
    expect(big).toBeGreaterThan(small);
    // r = k*sqrt(mass), so area (pi*r^2) scales linearly with mass.
    const areaRatio = (big * big) / (small * small);
    expect(areaRatio).toBeCloseTo(MASS_BEHEMOTH / MASS_MIN_FORMATION, 1);
  });
});
