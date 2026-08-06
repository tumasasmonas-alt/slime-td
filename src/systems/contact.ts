import type { GameState } from '../state';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { CONTACT_SCALE } from '../tuning/growth';
import { dist } from '../util/math';
import { damageTower } from './tower';

const CONTACT_FLOOR = 0.02;

// Depth-weighted average of revealed density over the whole disc inside
// the safe radius — not a fixed ring sample outside it. See
// docs/DECISIONS.md #18: zero when the zone is clear (a real grace
// period), volume-aware (a wide breach hurts more than a narrow finger),
// and depth-aware (slime touching the core counts far more than slime
// just over the line).
//
// NOTE — supersedes documented prototype bug #2 ("sample at the ring,
// never closer") on purpose, with the project owner's explicit
// go-ahead. That rule was correct advice for the *old* design, where
// ambient growth was hard-gated to zero inside the safe radius, making
// near-core space guaranteed empty. Decision 15 removes that gate, so
// sampling inside the line is now correct, not broken. See decision 20
// and the "documented prototype bugs" list in docs/DECISIONS.md before
// changing this back.
//
// Still gated on REVEALED density, never raw — that half of bug #2 is
// completely unaffected by any of this and still applies. Raw density
// can cross the damage floor before a cell individually crosses its own
// reveal threshold.
//
// No longer scaled by a per-tier contactMult (Decision 24, 2026-08-06):
// the field is "the clock, not the executioner" in the new model, so
// contact damage doesn't escalate on a timer any more — its escalation
// arrives via Rule 3 (arrival splatter seeding breaches), which raises
// pressure through this same formula rather than through a multiplier.
export function tickContactDamage(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const t = state.tower;
  const perimeter = grid.perimeter;
  const radiusCells = Math.ceil(perimeter / grid.cellSize);
  const { cx: tcx, cy: tcy } = worldToCell(grid, t.x, t.y);

  let weightedSum = 0;
  let weightTotal = 0;
  for (let oy = -radiusCells; oy <= radiusCells; oy++) {
    const cy = tcy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -radiusCells; ox <= radiusCells; ox++) {
      const cx = tcx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      const wx = cx * grid.cellSize + grid.cellSize / 2;
      const wy = cy * grid.cellSize + grid.cellSize / 2;
      const d = dist(wx, wy, t.x, t.y);
      if (d > perimeter) continue;
      const weight = 1 - d / perimeter;
      if (weight <= 0) continue;
      const i = gIdx(grid, cx, cy);
      const density = isRevealedIdx(grid, i) ? grid.growth[i]! : 0;
      weightedSum += density * weight;
      weightTotal += weight;
    }
  }

  const pressure = weightTotal > 0 ? weightedSum / weightTotal : 0;
  state.contactPressure = pressure;
  if (pressure > CONTACT_FLOOR) {
    damageTower(state, pressure * CONTACT_SCALE * dt);
  }
}
