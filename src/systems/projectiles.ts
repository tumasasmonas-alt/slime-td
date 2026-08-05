import type { GameState, Projectile } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { spawnChainFx } from './chainFx';
import { spawnParticles } from './particles';
import { findNearbyRevealedPoint } from './targeting';

const OFFSCREEN_MARGIN = 60;
const BOLT_IMPACT_RADIUS = 30;
const CHAIN_IMPACT_RADIUS = 26;
const CHAIN_HOP_SEARCH_RADIUS = 150;
const CHAIN_HOP_SPEED = 760;
const CHAIN_DAMAGE_DECAY = 0.82;

// Bolt and chain share the same straight-line travel and reveal-hit
// detection; missile homing/splash lands with the rest of the arsenal.
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
    const i = gIdx(grid, cx, cy);
    const revealed = isRevealedIdx(grid, i);
    if (revealed) {
      spawnParticles(state, p.x, p.y, p.color, 5, 60);
      if (p.type === 'chain') {
        spawnChainFx(state, p.legStart.x, p.legStart.y, p.x, p.y);
        clearAt(state, p.x, p.y, p.dmg, { radiusPx: CHAIN_IMPACT_RADIUS });
        p.visited.add(i);
        p.hopsLeft -= 1;
        if (p.hopsLeft > 0) {
          const next = findNearbyRevealedPoint(grid, p.x, p.y, CHAIN_HOP_SEARCH_RADIUS, p.visited);
          if (next) {
            const a = Math.atan2(next.y - p.y, next.x - p.x);
            p.legStart = { x: p.x, y: p.y };
            p.vx = Math.cos(a) * CHAIN_HOP_SPEED;
            p.vy = Math.sin(a) * CHAIN_HOP_SPEED;
            p.dmg *= CHAIN_DAMAGE_DECAY;
            remaining.push(p);
          }
        }
      } else {
        clearAt(state, p.x, p.y, p.dmg, { radiusPx: BOLT_IMPACT_RADIUS });
      }
      continue;
    }
    remaining.push(p);
  }
  state.projectiles = remaining;
}
