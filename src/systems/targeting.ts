import type { Grid } from '../state';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { dist } from '../util/math';

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
