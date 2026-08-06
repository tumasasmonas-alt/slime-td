import type { GameState } from '../state';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { dist } from '../util/math';

export const FRONTIER_SECTORS = 48;

// 48 angular sectors, ray-cast each sim tick to find the nearest revealed
// cell in each direction — no per-enemy list to search. Weapons aim at
// whichever sector is closest.
//
// The raycast starts at the tower's own radius, not `perimeter`. Since
// docs/DECISIONS.md #15 lets ambient growth creep inside the
// safe radius, a breach can now exist there — and if the raycast still
// started at the old safe-radius boundary, weapons would be structurally
// unable to see or target it, making any breach unkillable. Starting
// from the tower's radius keeps the only excluded space the tower's own
// footprint, not the whole zone it's meant to defend.
export function computeFrontier(state: GameState): void {
  const grid = state.grid;
  if (!grid) return;
  const t = state.tower;
  const arr = state.frontier ?? new Float32Array(FRONTIER_SECTORS);
  for (let s = 0; s < FRONTIER_SECTORS; s++) {
    const angle = (s / FRONTIER_SECTORS) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let found = grid.maxRange;
    for (let r = t.radius; r < grid.maxRange; r += grid.cellSize) {
      const x = t.x + dx * r;
      const y = t.y + dy * r;
      if (x < 0 || x >= grid.cols * grid.cellSize || y < 0 || y >= grid.rows * grid.cellSize) break;
      const { cx, cy } = worldToCell(grid, x, y);
      if (isRevealedIdx(grid, gIdx(grid, cx, cy))) {
        found = r;
        break;
      }
    }
    arr[s] = found;
  }
  state.frontier = arr;
}

export interface FrontierPoint {
  x: number;
  y: number;
  dist: number;
}

// Nearest-thing-wins, unchanged as a default (Decision 45) — coagulants
// just become another candidate compared by distance, same as any
// frontier sector. Compares against the *surface* of a coagulant
// (distance to center minus its radius), not its center, so a huge
// behemoth is treated as being exactly as close as it visibly is.
export function nearestFrontierPoint(state: GameState): FrontierPoint | null {
  const grid = state.grid;
  const frontier = state.frontier;
  if (!grid || !frontier) return null;
  const t = state.tower;

  let best: FrontierPoint | null = null;
  let bestS = -1;
  let bestD = Infinity;
  for (let s = 0; s < frontier.length; s++) {
    const d = frontier[s]!;
    if (d < bestD) {
      bestD = d;
      bestS = s;
    }
  }
  if (bestS >= 0 && bestD < grid.maxRange - 1) {
    const angle = (bestS / frontier.length) * Math.PI * 2;
    best = { x: t.x + Math.cos(angle) * bestD, y: t.y + Math.sin(angle) * bestD, dist: bestD };
  }

  for (const c of state.coagulants) {
    if (c.mass <= 0) continue;
    const surfaceDist = Math.max(0, dist(t.x, t.y, c.x, c.y) - c.radius);
    if (best === null || surfaceDist < best.dist) {
      best = { x: c.x, y: c.y, dist: surfaceDist };
    }
  }

  return best;
}
