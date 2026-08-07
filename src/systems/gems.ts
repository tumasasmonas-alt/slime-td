import type { GameState } from '../state';
import { GEM_SHOWER_MAX_COUNT, GEM_SHOWER_UNIT } from '../tuning/xp';
import { clamp, dist, lerp, rand } from '../util/math';
import { spawnParticles } from './particles';
import { pickupMult } from './passives';
import { grantXp } from './xp';

const REF_DIST = 260;
const MIN_SPEED = 90;
const MAX_SPEED = 320;
const PICKUP_MARGIN = 6;
// How far a shower's individual gems scatter from the kill point — wide
// enough to read as several distinct pickups, not one gem-shaped blur.
const SHOWER_SCATTER = 16;
// A shower's per-gem drift jitter range — see Gem.driftJitter in state.ts.
const SHOWER_JITTER_MIN = 0.7;
const SHOWER_JITTER_MAX = 1.3;

export function dropGem(state: GameState, x: number, y: number, xpValue: number, driftJitter = 1): void {
  state.gems.push({ x, y, xp: xpValue, radius: 4 + Math.min(4, xpValue * 0.15), driftJitter });
}

// Splits a large XP value into several gems instead of one, so a big kill
// (a coagulant, or a wide-splash hit) doesn't dump its whole value into a
// single pickup that arrives at the core in one instant and can cross
// several level-up thresholds at once — see docs/DECISIONS.md #61. Below
// GEM_SHOWER_UNIT this is exactly one gem, same as a call to dropGem
// directly, so ordinary hits are unaffected.
export function dropGemShower(state: GameState, x: number, y: number, totalXp: number): void {
  if (totalXp < 1) return;
  const count = clamp(Math.ceil(totalXp / GEM_SHOWER_UNIT), 1, GEM_SHOWER_MAX_COUNT);
  const perGem = totalXp / count;
  for (let i = 0; i < count; i++) {
    dropGem(
      state,
      x + rand(-SHOWER_SCATTER, SHOWER_SCATTER),
      y + rand(-SHOWER_SCATTER, SHOWER_SCATTER),
      perGem,
      rand(SHOWER_JITTER_MIN, SHOWER_JITTER_MAX),
    );
  }
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
    const speed = lerp(MIN_SPEED * mult, MAX_SPEED * mult, 1 - clamp(d / REF_DIST, 0, 1)) * gem.driftJitter;
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
