import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { towerCenteredRadius, type TowerCenteredReach } from '../tuning/weaponGeometry';

const WARD_TICK = 1.1;

// Prototype formula was `60 + lvl*6`, expressed here in the equivalent
// base+perLevel form.
const WARD_REACH: TowerCenteredReach = { margin: 10, base: 66, perLevel: 6 };

// Ward Pulse periodically purges a ring around the core. Independent of
// contact damage, so it's testable in Phase 2C even though maxHp/regen/
// armor aren't (see docs/PROGRESS.md "Confirmed decisions"). Lives
// outside systems/passives.ts to avoid that module depending on
// grid/clear.ts, which itself depends on systems/gems.ts.
//
// Radius floors at the safe radius (Confirmed decision 16) — closing out
// the last of the three tower-centered weapons that needed this, per the
// 2E scope notes in docs/PROGRESS.md.
export function updateWardPulse(state: GameState, dt: number): void {
  const lvl = state.passives.ward ?? 0;
  const grid = state.grid;
  if (!lvl || !grid) return;
  state.wardTimer -= dt;
  if (state.wardTimer <= 0) {
    state.wardTimer = WARD_TICK;
    const radius = towerCenteredRadius(WARD_REACH, lvl, grid.safeRadius);
    clearAt(state, state.tower.x, state.tower.y, 10 * lvl, { radiusPx: radius });
  }
}
