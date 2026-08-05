import type { GameState } from '../state';
import { clearAt } from '../grid/clear';

const CLOUD_TICK = 0.4;

export function updateClouds(state: GameState, dt: number): void {
  const remaining: typeof state.clouds = [];
  for (const c of state.clouds) {
    c.life -= dt;
    c.tickTimer -= dt;
    if (c.tickTimer <= 0) {
      c.tickTimer = CLOUD_TICK;
      clearAt(state, c.x, c.y, c.dmgPerSec * CLOUD_TICK, { radiusPx: c.radius });
    }
    if (c.life > 0) remaining.push(c);
  }
  state.clouds = remaining;
}
