import type { GameState, Projectile } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { spawnParticles } from './particles';

const OFFSCREEN_MARGIN = 60;
const BOLT_IMPACT_RADIUS = 30;

// Only 'bolt' projectiles exist in Phase 2C. Chain/missile homing and
// hop/splash behavior land with the rest of the arsenal in Phase 2E.
export function updateProjectiles(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const remaining: Projectile[] = [];
  for (const p of state.projectiles) {
    p.life -= dt;
    if (p.life <= 0) continue;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (
      p.x < -OFFSCREEN_MARGIN ||
      p.x > WORLD_WIDTH + OFFSCREEN_MARGIN ||
      p.y < -OFFSCREEN_MARGIN ||
      p.y > WORLD_HEIGHT + OFFSCREEN_MARGIN
    ) {
      continue;
    }

    const { cx, cy } = worldToCell(grid, p.x, p.y);
    const revealed = isRevealedIdx(grid, gIdx(grid, cx, cy));
    if (revealed) {
      spawnParticles(state, p.x, p.y, p.color, 5, 60);
      clearAt(state, p.x, p.y, p.dmg, { radiusPx: BOLT_IMPACT_RADIUS });
      continue;
    }
    remaining.push(p);
  }
  state.projectiles = remaining;
}
