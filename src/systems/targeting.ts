import type { Coagulant, GameState, Grid } from '../state';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { dist } from '../util/math';
import { coagulantSurfaceDist } from './coagulants';
import { nearestFrontierPoint, type FrontierPoint } from './frontier';

export interface NearbyPoint {
  x: number;
  y: number;
  i: number;
}

// Local box search for the most-grown revealed cell within searchRadius
// of (x,y), excluding already-visited indices. Used by Chain Bolt to
// find its next hop — distinct from the 48-sector frontier system in
// systems/frontier.ts, which only searches outward from the tower and
// can't answer "what's near this arbitrary point in the field."
export function findNearbyRevealedPoint(
  grid: Grid,
  x: number,
  y: number,
  searchRadius: number,
  visited: Set<number>,
): NearbyPoint | null {
  const { cx, cy } = worldToCell(grid, x, y);
  const rc = Math.ceil(searchRadius / grid.cellSize);
  let best: NearbyPoint | null = null;
  let bestGrowth = -1;
  for (let oy = -rc; oy <= rc; oy++) {
    const gy = cy + oy;
    if (gy < 0 || gy >= grid.rows) continue;
    for (let ox = -rc; ox <= rc; ox++) {
      const gx = cx + ox;
      if (gx < 0 || gx >= grid.cols) continue;
      const i = gIdx(grid, gx, gy);
      if (visited.has(i)) continue;
      if (!isRevealedIdx(grid, i)) continue;
      const wx = gx * grid.cellSize + grid.cellSize / 2;
      const wy = gy * grid.cellSize + grid.cellSize / 2;
      const d = dist(x, y, wx, wy);
      if (d > searchRadius) continue;
      const growth = grid.growth[i]!;
      if (growth > bestGrowth) {
        bestGrowth = growth;
        best = { x: wx, y: wy, i };
      }
    }
  }
  return best;
}

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): the shared
// "best coagulant within range of a point, by some comparator" loop —
// factored out of what was highestMassPoint's own inline loop, so Threat
// Priority, Triage, Breach Priority and Fixation (and Lance's own
// built-in targeting) all walk state.coagulants exactly once, the same
// way, rather than four near-identical copies. `isBetter(a, b)` returns
// whether candidate `a` should replace the current best `b`.
export function bestCoagulant(
  state: GameState,
  x: number,
  y: number,
  maxRange: number,
  isBetter: (a: Coagulant, b: Coagulant) => boolean,
): Coagulant | null {
  let best: Coagulant | null = null;
  for (const c of state.coagulants) {
    if (c.mass <= 0 || c.phase === 'forming') continue;
    if (dist(x, y, c.x, c.y) > maxRange + c.radius) continue;
    if (!best || isBetter(c, best)) best = c;
  }
  return best;
}

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S3): Lance's ACQUIRE —
// "highest mass in range," not nearest-wins (Decision 45's default,
// unchanged for every other weapon). `phase === 'forming'` coagulants are
// skipped, matching nearestFrontierPoint's own exclusion — a coagulant
// that hasn't detached from the field yet is not a target for anything.
//
// Falls back to nearestFrontierPoint when no coagulant qualifies — an
// early run has none at all, and a weapon that does nothing for the
// first ninety seconds is the 2026-08-05 "cards appear to do nothing"
// failure in a new costume. This is also, deliberately, the exact acquire
// stage Threat Priority (6D-1) replaces wholesale — Lance's own targeting
// is "Threat Priority, built in" (weapons/lance.ts routes through this
// same function via systems/targetingGems.ts's targetingAcquire, so the
// two can never drift).
export function highestMassPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const t = state.tower;
  const best = bestCoagulant(state, t.x, t.y, maxRange, (a, b) => a.mass > b.mass);
  if (best) return { x: best.x, y: best.y, dist: coagulantSurfaceDist(best, t.x, t.y) };
  return nearestFrontierPoint(state);
}

// Phase 6D-1: Triage's ACQUIRE — the mirror of highestMassPoint, lowest
// mass instead of highest. Same fallback, same reasoning.
export function weakestCoagulantPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const t = state.tower;
  const best = bestCoagulant(state, t.x, t.y, maxRange, (a, b) => a.mass < b.mass);
  if (best) return { x: best.x, y: best.y, dist: coagulantSurfaceDist(best, t.x, t.y) };
  return nearestFrontierPoint(state);
}

// Phase 6D-1: Field Priority's ACQUIRE — the densest revealed GROUND in
// range, not the nearest thing or the biggest coagulant. Deliberately
// reads only grid density, never coagulants (those get their own gems,
// Threat/Triage) — sampled at each of the 48 frontier sectors' own
// revealed edge (systems/frontier.ts's computeFrontier already runs every
// tick), rather than a second full-field scan. Falls back to
// nearestFrontierPoint on the same "don't do nothing for 90 seconds"
// principle as highestMassPoint.
export function densestFieldPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const grid = state.grid;
  const frontier = state.frontier;
  if (!grid || !frontier) return null;
  const t = state.tower;
  let best: FrontierPoint | null = null;
  let bestDensity = -1;
  for (let s = 0; s < frontier.length; s++) {
    const d = frontier[s]!;
    if (d >= grid.maxRange - 1 || d > maxRange) continue;
    const angle = (s / frontier.length) * Math.PI * 2;
    const x = t.x + Math.cos(angle) * d;
    const y = t.y + Math.sin(angle) * d;
    const { cx, cy } = worldToCell(grid, x, y);
    const density = grid.growth[gIdx(grid, cx, cy)] ?? 0;
    if (density > bestDensity) {
      bestDensity = density;
      best = { x, y, dist: d };
    }
  }
  return best ?? nearestFrontierPoint(state);
}

// Phase 6D-1: Breach Priority's ACQUIRE, on a weapon that has one — the
// deepest GROUND incursion specifically, ignoring any coagulant that
// happens to be closer. Distinct from nearestFrontierPoint (Decision 45's
// default), which blends frontier sectors and coagulants into one
// nearest-wins comparison: this only ever looks at the frontier, so a
// player who wants to guarantee the ground line never creeps closer, even
// while a coagulant is nearer, has an honest way to ask for that. Falls
// back to nearestFrontierPoint only when there is no ground breach at all
// (an early run, or a fully-cleared field) — at that point a coagulant,
// if any, is the only thing left to aim at.
export function deepestIncursionPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const grid = state.grid;
  const frontier = state.frontier;
  if (!grid || !frontier) return null;
  const t = state.tower;
  let bestS = -1;
  let bestD = Infinity;
  for (let s = 0; s < frontier.length; s++) {
    const d = frontier[s]!;
    if (d < bestD) {
      bestD = d;
      bestS = s;
    }
  }
  if (bestS < 0 || bestD >= grid.maxRange - 1 || bestD > maxRange) return nearestFrontierPoint(state);
  const angle = (bestS / frontier.length) * Math.PI * 2;
  return { x: t.x + Math.cos(angle) * bestD, y: t.y + Math.sin(angle) * bestD, dist: bestD };
}

// Phase 6D-1: Vigilance's ACQUIRE, on a weapon that has one — nearest
// wins exactly like the default (Decision 45), but anything closer than
// `grid.perimeter` is excluded entirely, from both the frontier and
// coagulants. Deliberately returns null rather than falling back to
// nearestFrontierPoint when nothing outside the perimeter qualifies —
// that's Vigilance actually working (refusing to engage the near field),
// not the "does nothing for 90 seconds" failure the other acquire
// functions guard against; a weapon socketed with this gem is allowed to
// sit idle while everything in range is inside the line it refuses to
// cross.
export function outsidePerimeterPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const grid = state.grid;
  const frontier = state.frontier;
  if (!grid || !frontier) return null;
  const t = state.tower;
  let best: FrontierPoint | null = null;
  for (let s = 0; s < frontier.length; s++) {
    const d = frontier[s]!;
    if (d < grid.perimeter || d >= grid.maxRange - 1 || d > maxRange) continue;
    if (!best || d < best.dist) {
      const angle = (s / frontier.length) * Math.PI * 2;
      best = { x: t.x + Math.cos(angle) * d, y: t.y + Math.sin(angle) * d, dist: d };
    }
  }
  for (const c of state.coagulants) {
    if (c.mass <= 0 || c.phase === 'forming') continue;
    if (dist(t.x, t.y, c.x, c.y) > maxRange + c.radius) continue;
    const surfaceDist = coagulantSurfaceDist(c, t.x, t.y);
    if (surfaceDist < grid.perimeter) continue;
    if (!best || surfaceDist < best.dist) best = { x: c.x, y: c.y, dist: surfaceDist };
  }
  return best;
}
