import type { Coagulant, CoagulantKind, CoagulantPart, CoagulantSeed, GameState, Grid } from '../state';
import { cellBucket, gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import {
  BLASTOMA_SPLIT_FRACTION,
  BULWARK_PART_COUNT,
  BULWARK_PART_RADIUS_FRACTION,
  BULWARK_SPAN_FRACTION,
  FORMATION_CELL_CAP,
  FORMATION_MIN_DISTANCE,
  FORMATION_RADIUS_CAP,
  FORMATION_RISE_DURATION,
  MASS_MIN_FORMATION,
  coagulantArmor,
  coagulantKindFrom,
  coagulantRadius,
  coagulantSpeed,
} from '../tuning/coagulants';
import { dist, rand } from '../util/math';

// Phase 4C-2 (Decision 69): §10's fourth identity reading — "corridor
// density (spark -> core): whether it can feed en route." Mean revealed
// density sampled along the straight line from the spark point to the
// core; a clean near field means low density the whole way, so a Carrier
// cannot form regardless of what's happening at the spark point itself —
// pure failure-gate, per §10's "a good player never meets one."
function sampleCorridorDensity(grid: Grid, fromX: number, fromY: number, toX: number, toY: number): number {
  const STEPS = 12;
  let sum = 0;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    const { cx, cy } = worldToCell(grid, x, y);
    sum += grid.growth[gIdx(grid, cx, cy)]!;
  }
  return sum / (STEPS + 1);
}

// Phase 4C-2 (Decision 69): Bulwark's body — a line of overlapping circles
// perpendicular to its direction of travel, spanning BULWARK_SPAN_FRACTION
// of the mass-derived "equivalent single-blob" radius. See
// docs/plans/phase-4c2-carrier-bulwark.md §2 for why a cluster of circles
// rather than true ellipse geometry.
function buildBulwarkParts(baseRadius: number, perpAngle: number): CoagulantPart[] {
  const partR = baseRadius * BULWARK_PART_RADIUS_FRACTION;
  const span = baseRadius * BULWARK_SPAN_FRACTION;
  const parts: CoagulantPart[] = [];
  for (let i = 0; i < BULWARK_PART_COUNT; i++) {
    const t = BULWARK_PART_COUNT === 1 ? 0 : i / (BULWARK_PART_COUNT - 1) - 0.5; // -0.5..0.5
    const offset = t * span;
    parts.push({ dx: Math.cos(perpAngle) * offset, dy: Math.sin(perpAngle) * offset, r: partR });
  }
  return parts;
}

// The bounding circle a set of parts actually needs to be enclosed by —
// distance from centre to the farthest part's centre, plus that part's own
// radius. Used so broad-phase rejection (which always uses `radius`, never
// `parts`) never falsely rejects a hit that would land on a part sticking
// out beyond a naively mass-derived radius.
function boundingRadiusFor(parts: CoagulantPart[], fallback: number): number {
  if (parts.length === 0) return fallback;
  let maxReach = 0;
  for (const p of parts) {
    const reach = Math.hypot(p.dx, p.dy) + p.r;
    if (reach > maxReach) maxReach = reach;
  }
  return maxReach;
}

interface FloodResult {
  mass: number;
  cells: number[];
  // Mean maturity over the visited cells — one of §10's four identity
  // readings ("maturity picks armour/type"). 0 when nothing was visited.
  meanMaturity: number;
  // cells.length divided by the area of the disc the flood-fill's own
  // reach spanned — near 1 for a solid saturated patch, low for a thin
  // vein-webbed lattice that reaches far while visiting few cells. §10's
  // "mass shape (solid vs. fragmented)" reading, used to identify Blastoma.
  fillRatio: number;
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
  if (!isRevealedIdx(grid, startI)) return { mass: 0, cells: [], meanMaturity: 0, fillRatio: 0 };

  const radiusCapSq = FORMATION_RADIUS_CAP * FORMATION_RADIUS_CAP;
  const visited = new Set<number>([startI]);
  const queue: { cx: number; cy: number }[] = [start];
  const cells: number[] = [];
  let mass = 0;
  let maturitySum = 0;
  let maxDistSq = 0;
  let qi = 0;

  while (qi < queue.length && cells.length < FORMATION_CELL_CAP) {
    const { cx, cy } = queue[qi++]!;
    const dx = (cx - start.cx) * grid.cellSize;
    const dy = (cy - start.cy) * grid.cellSize;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusCapSq) continue;
    if (distSq > maxDistSq) maxDistSq = distSq;

    const i = gIdx(grid, cx, cy);
    cells.push(i);
    mass += grid.growth[i]!;
    maturitySum += grid.maturity[i]!;

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

  const maxDist = Math.sqrt(maxDistSq);
  const expectedCells = (Math.PI * maxDist * maxDist) / (grid.cellSize * grid.cellSize);
  const fillRatio = cells.length > 0 ? cells.length / Math.max(1, expectedCells) : 0;
  const meanMaturity = cells.length > 0 ? maturitySum / cells.length : 0;
  return { mass, cells, meanMaturity, fillRatio };
}

// Blastoma gets more seeds, spread further from centre (a wider r range),
// so it visibly reads as "a bag of blobs" rather than one merged blob —
// §10: "not a blob — a bag of blobs," "you can see the lumps." Exported
// so the split in systems/coagulants.ts can generate fresh seeds for each
// fragment rather than reusing the parent's (the bubbleSeeds/novaFx bug
// class again if seeds were ever shared or mutated post-creation).
export function generateSeeds(mass: number, kind: CoagulantKind): CoagulantSeed[] {
  const baseCount = Math.min(9, 5 + Math.floor(mass / 60));
  const count = kind === 'blastoma' ? Math.min(14, baseCount + 5) : baseCount;
  const [rMin, rMax] = kind === 'blastoma' ? [0.55, 1.05] : [0.35, 0.85];
  const seeds: CoagulantSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(rMin, rMax), speed: rand(0.3, 0.8), phase: rand(0, Math.PI * 2) });
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
//
// Also refuses to form within perimeter + FORMATION_MIN_DISTANCE of the
// core — a backstop against near-zero-runway spawns, found necessary
// live during the Phase 3C playtest gate (2026-08-06) alongside the vein
// stopping short of the perimeter (tuning/events.ts's VEIN_STOP_MARGIN)
// and bloom's existing perimeter+70 minimum placement.
export function attemptFormation(state: GameState, sx: number, sy: number): Coagulant | null {
  const grid = state.grid;
  if (!grid) return null;
  if (dist(sx, sy, state.tower.x, state.tower.y) < grid.perimeter + FORMATION_MIN_DISTANCE) return null;
  const { mass, cells, meanMaturity, fillRatio } = floodFillMass(grid, sx, sy);
  if (mass < MASS_MIN_FORMATION) return null;

  for (const i of cells) {
    grid.growth[i] = 0;
    const nb = cellBucket(grid, i);
    if (nb !== grid.bucket[i]) {
      grid.bucket[i] = nb;
      state.dirty.add(i);
    }
  }

  // Phase 4C-1 (Decision 68) / 4C-2 (Decision 69): identity now reads all
  // four of §10's field readings — mass, maturity, mass shape, and
  // corridor density. Maturity and the corridor are drained nowhere above;
  // the horde eats mass, never terrain (Decision 25).
  const corridorDensity = sampleCorridorDensity(grid, sx, sy, state.tower.x, state.tower.y);
  const kind = coagulantKindFrom(mass, meanMaturity, fillRatio, corridorDensity);
  const baseRadius = coagulantRadius(mass);
  const parts = kind === 'bulwark' ? buildBulwarkParts(baseRadius, Math.atan2(sy - state.tower.y, sx - state.tower.x) + Math.PI / 2) : [];
  const coagulant: Coagulant = {
    x: sx,
    y: sy,
    mass,
    armor: coagulantArmor(meanMaturity, state.time),
    kind,
    radius: boundingRadiusFor(parts, baseRadius),
    speed: coagulantSpeed(mass),
    phase: 'forming',
    phaseTimer: FORMATION_RISE_DURATION,
    seeds: generateSeeds(mass, kind),
    splitAtMass: kind === 'blastoma' ? mass * BLASTOMA_SPLIT_FRACTION : 0,
    sourceMaturity: meanMaturity,
    parts,
    startMass: mass,
    lastHitAt: -Infinity,
    chilledUntil: 0,
    armorDebuff: 0,
    armorDebuffUntil: 0,
  };
  state.coagulants.push(coagulant);
  return coagulant;
}
