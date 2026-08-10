import type { GameState, Grid } from '../state';
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
// stage Threat Priority (6D) will replace wholesale.
export function highestMassPoint(state: GameState, maxRange: number): FrontierPoint | null {
  const t = state.tower;
  let best: (typeof state.coagulants)[number] | null = null;
  for (const c of state.coagulants) {
    if (c.mass <= 0 || c.phase === 'forming') continue;
    if (dist(t.x, t.y, c.x, c.y) > maxRange + c.radius) continue;
    if (!best || c.mass > best.mass) best = c;
  }
  if (best) {
    return { x: best.x, y: best.y, dist: coagulantSurfaceDist(best, t.x, t.y) };
  }
  return nearestFrontierPoint(state);
}
