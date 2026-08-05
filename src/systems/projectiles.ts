import type { GameState, Grid, MissileProjectile, Projectile } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { dist, lerp } from '../util/math';
import { spawnChainFx } from './chainFx';
import { spawnParticles } from './particles';
import { findNearbyRevealedPoint } from './targeting';

const OFFSCREEN_MARGIN = 60;
const BOLT_IMPACT_RADIUS = 30;
const CHAIN_IMPACT_RADIUS = 26;
const CHAIN_HOP_SEARCH_RADIUS = 150;
const CHAIN_HOP_SPEED = 760;
const CHAIN_DAMAGE_DECAY = 0.82;
const MISSILE_STEER = 0.15;
const MISSILE_REACH_DIST = 14;
const MISSILE_IMPACT_COLOR = '#ff9d6b';

// Bolt and chain share the same straight-line travel and reveal-hit
// detection; missile homes toward its target instead and detonates on
// arrival or on touching the wall early, so it gets its own branch.
export function updateProjectiles(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const remaining: Projectile[] = [];
  for (const p of state.projectiles) {
    p.life -= dt;
    if (p.life <= 0) continue;

    if (p.type === 'missile') {
      if (updateMissile(state, grid, p, dt)) remaining.push(p);
      continue;
    }

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

// Returns whether the missile should keep flying this frame.
function updateMissile(state: GameState, grid: Grid, p: MissileProjectile, dt: number): boolean {
  let tx: number;
  let ty: number;
  if (p.targetNode && !p.targetNode.dead) {
    tx = p.targetNode.x;
    ty = p.targetNode.y;
  } else {
    tx = p.targetPoint.x;
    ty = p.targetPoint.y;
  }

  const a = Math.atan2(ty - p.y, tx - p.x);
  p.vx = lerp(p.vx, Math.cos(a) * p.speed, MISSILE_STEER);
  p.vy = lerp(p.vy, Math.sin(a) * p.speed, MISSILE_STEER);
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const reached = dist(p.x, p.y, tx, ty) < MISSILE_REACH_DIST;
  const { cx, cy } = worldToCell(grid, p.x, p.y);
  const hitWall = isRevealedIdx(grid, gIdx(grid, cx, cy));
  if (reached || hitWall) {
    spawnParticles(state, p.x, p.y, MISSILE_IMPACT_COLOR, 18, 160);
    clearAt(state, p.x, p.y, p.dmg, { radiusPx: p.splashRadius });
    return false;
  }
  return true;
}
