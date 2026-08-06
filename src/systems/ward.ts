import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { towerCenteredRadius, type TowerCenteredReach } from '../tuning/weaponGeometry';

const WARD_TICK = 1.1;

// Prototype formula was `60 + lvl*6`, expressed here in the equivalent
// base+perLevel form.
const WARD_REACH: TowerCenteredReach = { margin: 10, base: 66, perLevel: 6 };

// Ward Pulse periodically purges a ring around the core. Lives outside
// systems/passives.ts to avoid that module depending on grid/clear.ts,
// which itself depends on systems/gems.ts.
//
// Radius floors at the safe radius (docs/DECISIONS.md #16) — the last of
// the three tower-centered weapons that needed this.
export function updateWardPulse(state: GameState, dt: number): void {
  const lvl = state.passives.ward ?? 0;
  const grid = state.grid;
  if (!lvl || !grid) return;
  state.wardTimer -= dt;
  if (state.wardTimer <= 0) {
    state.wardTimer = WARD_TICK;
    const radius = towerCenteredRadius(WARD_REACH, lvl, grid.perimeter);
    clearAt(state, state.tower.x, state.tower.y, 10 * lvl, { radiusPx: radius });
  }
}
