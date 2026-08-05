import type { GameState } from '../state';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { CONTACT_SCALE } from '../tuning/growth';
import { TIERS_LIST } from '../tuning/tiers';
import { damageTower } from './tower';

const SAMPLES = 24;
const CONTACT_FLOOR = 0.05;

// Sampled right at the visible safe-zone ring (safeRadius + 1.5 cells),
// never a smaller radius around the tower itself — ambient growth is
// hard-gated to zero inside the safe radius, so sampling any closer means
// the wall can never physically reach the sample point and the core is
// structurally unkillable. Also gated on REVEALED density, never raw —
// raw density can cross the damage floor before a cell is actually
// visible on screen. Both are documented bugs that cost real debugging
// time once already; see docs/PROTOTYPE_HANDOFF.md "Known bugs found
// during development".
export function tickContactDamage(state: GameState, dt: number): void {
  const grid = state.grid;
  const tier = TIERS_LIST[state.tierIndex];
  if (!grid || !tier) return;
  const t = state.tower;
  const ringR = grid.safeRadius + grid.cellSize * 1.5;
  let sum = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const a = (s / SAMPLES) * Math.PI * 2;
    const x = t.x + Math.cos(a) * ringR;
    const y = t.y + Math.sin(a) * ringR;
    const { cx, cy } = worldToCell(grid, x, y);
    const i = gIdx(grid, cx, cy);
    if (isRevealedIdx(grid, i)) sum += grid.growth[i]!;
  }
  const avg = sum / SAMPLES;
  state.contactPressure = avg;
  if (avg > CONTACT_FLOOR) {
    damageTower(state, avg * tier.contactMult * CONTACT_SCALE * dt);
  }
}
