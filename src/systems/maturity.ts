import type { GameState } from '../state';
import { MATURITY_DECAY, ageFloorAt, maturityBucket } from '../tuning/maturity';

// Passive decay toward the age floor (tuning/maturity.ts's ageFloorAt) —
// what lets a relocated front's old scar ring heal, and what lets virgin
// ground slowly rise off literal zero rather than sitting there forever.
// One shared floor per tick rather than per-cell age state: see
// ageFloorAt's own comment for why age and decay would otherwise fight
// over every cell instead of converging cleanly.
//
// Own module rather than folded into growth.ts (CLAUDE.md's
// one-system-per-module convention) — this is a different mechanic that
// happens to touch an adjacent array, not an extension of ambient growth.
export function updateMaturity(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const floor = ageFloorAt(state.time);
  const decayStep = MATURITY_DECAY * dt;
  for (let i = 0; i < grid.size; i++) {
    const m = grid.maturity[i]!;
    const next = Math.max(floor, m - decayStep);
    if (next === m) continue;
    grid.maturity[i] = next;
    const nb = maturityBucket(next, floor);
    if (nb !== grid.matBucket[i]) {
      grid.matBucket[i] = nb;
      state.dirty.add(i);
    }
  }
}
