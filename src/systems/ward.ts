import type { GameState } from '../state';
import { clearAt } from '../grid/clear';

const WARD_TICK = 1.1;

// Ward Pulse periodically purges a ring around the core. Independent of
// contact damage, so it's testable in Phase 2C even though maxHp/regen/
// armor aren't (see docs/PROGRESS.md "Confirmed decisions"). Lives
// outside systems/passives.ts to avoid that module depending on
// grid/clear.ts, which itself depends on systems/gems.ts.
export function updateWardPulse(state: GameState, dt: number): void {
  const lvl = state.passives.ward ?? 0;
  if (!lvl) return;
  state.wardTimer -= dt;
  if (state.wardTimer <= 0) {
    state.wardTimer = WARD_TICK;
    clearAt(state, state.tower.x, state.tower.y, 10 * lvl, { radiusPx: 60 + lvl * 6 });
  }
}
