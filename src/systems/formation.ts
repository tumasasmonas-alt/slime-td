import type { Coagulant, CoagulantSeed, GameState, Grid } from '../state';
import { cellBucket, gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import {
  COAGULANT_SPEED,
  FORMATION_CELL_CAP,
  FORMATION_RADIUS_CAP,
  MASS_MIN_FORMATION,
  coagulantKindFromMass,
  coagulantRadius,
} from '../tuning/coagulants';
import { rand } from '../util/math';

interface FloodResult {
  mass: number;
  cells: number[];
}

// Bounded flood-fill from a spark point, through *revealed* cells only
// (documented prototype bug #3 discipline — growth > threshold, never
// raw density). Bounded by both a radius cap and a cell-count cap, so a
// spark landing in saturated wilderness returns "the mass inside a
// formation footprint," not "the entire wilderness" — the bound IS the
// design (Decision 43). Walked in (cx, cy) pairs rather than flat grid
// indices so neighbor bounds-checking is the same cols/rows comparison
// every other grid loop in this codebase already uses, with no
// row-wraparound edge case to guard against.
//
// The radius check is real Euclidean distance, not a cheaper Chebyshev
// (max of |dx|,|dy|) box — a saturated field reliably hits that bound on
// every side at once, and a box bound reads as one on screen: a crisp
// square crater, not the organic shape Decision 43 promises ("following
// whatever pattern the field was already in"). Found live in the browser
// during the 3C verification pass, not by test — worth remembering that
// class of bug doesn't show up in a unit test that only checks a mass
// number.
function floodFillMass(grid: Grid, sx: number, sy: number): FloodResult {
  const start = worldToCell(grid, sx, sy);
  const startI = gIdx(grid, start.cx, start.cy);
  if (!isRevealedIdx(grid, startI)) return { mass: 0, cells: [] };

  const radiusCapSq = FORMATION_RADIUS_CAP * FORMATION_RADIUS_CAP;
  const visited = new Set<number>([startI]);
  const queue: { cx: number; cy: number }[] = [start];
  const cells: number[] = [];
  let mass = 0;
  let qi = 0;

  while (qi < queue.length && cells.length < FORMATION_CELL_CAP) {
    const { cx, cy } = queue[qi++]!;
    const dx = (cx - start.cx) * grid.cellSize;
    const dy = (cy - start.cy) * grid.cellSize;
    if (dx * dx + dy * dy > radiusCapSq) continue;

    const i = gIdx(grid, cx, cy);
    cells.push(i);
    mass += grid.growth[i]!;

    const neighbors = [
      { cx: cx - 1, cy },
      { cx: cx + 1, cy },
      { cx, cy: cy - 1 },
      { cx, cy: cy + 1 },
    ];
    for (const n of neighbors) {
      if (n.cx < 0 || n.cx >= grid.cols || n.cy < 0 || n.cy >= grid.rows) continue;
      const ni = gIdx(grid, n.cx, n.cy);
      if (visited.has(ni)) continue;
      if (!isRevealedIdx(grid, ni)) continue;
      visited.add(ni);
      queue.push(n);
    }
  }

  return { mass, cells };
}

function generateSeeds(mass: number): CoagulantSeed[] {
  const count = Math.min(9, 5 + Math.floor(mass / 60));
  const seeds: CoagulantSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(0.35, 0.85), speed: rand(0.3, 0.8), phase: rand(0, Math.PI * 2) });
  }
  return seeds;
}

// Attempts formation at (sx, sy) — drains whatever contiguous revealed
// mass the flood-fill finds and spawns a coagulant if it clears the
// minimum threshold. Rule 1 (formation is a sink): the drained cells
// leave a crater shaped exactly like the flood-fill's reach, following
// whatever pattern the field was already in — no separate crater
// geometry to author. Returns null below the threshold: a well-managed
// field genuinely produces nothing, which is the point.
export function attemptFormation(state: GameState, sx: number, sy: number): Coagulant | null {
  const grid = state.grid;
  if (!grid) return null;
  const { mass, cells } = floodFillMass(grid, sx, sy);
  if (mass < MASS_MIN_FORMATION) return null;

  for (const i of cells) {
    grid.growth[i] = 0;
    const nb = cellBucket(grid, i);
    if (nb !== grid.bucket[i]) {
      grid.bucket[i] = nb;
      state.dirty.add(i);
    }
  }

  const kind = coagulantKindFromMass(mass);
  const coagulant: Coagulant = {
    x: sx,
    y: sy,
    mass,
    armor: 0, // Wave 1 — see docs/DECISIONS.md #44
    kind,
    radius: coagulantRadius(mass),
    speed: COAGULANT_SPEED[kind],
    seeds: generateSeeds(mass),
  };
  state.coagulants.push(coagulant);
  return coagulant;
}
