import type { GameState, Grid, MissileProjectile, Projectile } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { WEAPON_DEFS } from '../tuning/weapons';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { dist, lerp } from '../util/math';
import { spawnChainFx } from './chainFx';
import { findCoagulantHit } from './coagulants';
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
    // Coagulants are entities, not grid cells — a blob sitting in an
    // already-cleared area would never register on the isRevealedIdx
    // check above, so it needs its own collision test alongside it.
    const hitCoagulant = findCoagulantHit(state, p.x, p.y, p.radius);
    if (revealed || hitCoagulant) {
      spawnParticles(state, p.x, p.y, p.color, 5, 60);
      const coagulantMult = WEAPON_DEFS[p.type]?.coagulantMult ?? 1;
      if (p.type === 'chain') {
        spawnChainFx(state, p.legStart.x, p.legStart.y, p.x, p.y);
        clearAt(state, p.x, p.y, p.dmg, { radiusPx: CHAIN_IMPACT_RADIUS, coagulantMult });
        p.visited.add(i);
        p.hopsLeft -= 1;
        if (p.hopsLeft > 0) {
          const next = findNextChainHop(state, grid, p.x, p.y, p.visited);
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
        clearAt(state, p.x, p.y, p.dmg, { radiusPx: BOLT_IMPACT_RADIUS, coagulantMult });
      }
      continue;
    }
    remaining.push(p);
  }
  state.projectiles = remaining;
}

// Chain's next hop can land on either a nearby revealed grid cluster or a
// nearby coagulant — whichever is closer, same "just another close thing"
// rule targeting already applies (Decision 45).
function findNextChainHop(
  state: GameState,
  grid: Grid,
  x: number,
  y: number,
  visited: Set<number>,
): { x: number; y: number } | null {
  const gridPoint = findNearbyRevealedPoint(grid, x, y, CHAIN_HOP_SEARCH_RADIUS, visited);
  const blob = findCoagulantHit(state, x, y, CHAIN_HOP_SEARCH_RADIUS);
  if (!blob) return gridPoint;
  if (!gridPoint) return { x: blob.x, y: blob.y };
  const blobDist = dist(x, y, blob.x, blob.y);
  const gridDist = dist(x, y, gridPoint.x, gridPoint.y);
  return blobDist < gridDist ? { x: blob.x, y: blob.y } : gridPoint;
}

// Returns whether the missile should keep flying this frame.
function updateMissile(state: GameState, grid: Grid, p: MissileProjectile, dt: number): boolean {
  const tx = p.targetPoint.x;
  const ty = p.targetPoint.y;

  const a = Math.atan2(ty - p.y, tx - p.x);
  p.vx = lerp(p.vx, Math.cos(a) * p.speed, MISSILE_STEER);
  p.vy = lerp(p.vy, Math.sin(a) * p.speed, MISSILE_STEER);
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const reached = dist(p.x, p.y, tx, ty) < MISSILE_REACH_DIST;
  const { cx, cy } = worldToCell(grid, p.x, p.y);
  const hitWall = isRevealedIdx(grid, gIdx(grid, cx, cy));
  const hitCoagulant = findCoagulantHit(state, p.x, p.y, p.radius);
  if (reached || hitWall || hitCoagulant) {
    spawnParticles(state, p.x, p.y, MISSILE_IMPACT_COLOR, 18, 160);
    const coagulantMult = WEAPON_DEFS.missile?.coagulantMult ?? 1;
    clearAt(state, p.x, p.y, p.dmg, { radiusPx: p.splashRadius, coagulantMult });
    return false;
  }
  return true;
}
