import type { GameState } from '../state';
import { clamp, dist, lerp } from '../util/math';
import { spawnParticles } from './particles';
import { pickupMult } from './passives';
import { grantXp } from './xp';

const REF_DIST = 260;
const MIN_SPEED = 90;
const MAX_SPEED = 320;
const PICKUP_MARGIN = 6;

export function dropGem(state: GameState, x: number, y: number, xpValue: number): void {
  state.gems.push({ x, y, xp: xpValue, radius: 4 + Math.min(4, xpValue * 0.15) });
}

// Gems always drift toward the (stationary) core rather than only
// activating within a fixed pickup radius — weapons routinely clear
// tissue well outside any modest radius, so a radius gate meant XP could
// never accumulate. Magnetism boosts drift speed, not a radius. See
// archive/PROTOTYPE_HANDOFF.md "Known bugs found during development".
export function updateGems(state: GameState, dt: number): void {
  const tower = state.tower;
  const mult = pickupMult(state);
  const remaining: typeof state.gems = [];
  for (const gem of state.gems) {
    const d = dist(gem.x, gem.y, tower.x, tower.y);
    const speed = lerp(MIN_SPEED * mult, MAX_SPEED * mult, 1 - clamp(d / REF_DIST, 0, 1));
    const a = Math.atan2(tower.y - gem.y, tower.x - gem.x);
    gem.x += Math.cos(a) * speed * dt;
    gem.y += Math.sin(a) * speed * dt;
    if (d < tower.radius + PICKUP_MARGIN) {
      grantXp(state, gem.xp);
      spawnParticles(state, gem.x, gem.y, '#6df0ff', 5, 60);
      continue;
    }
    remaining.push(gem);
  }
  state.gems = remaining;
}
