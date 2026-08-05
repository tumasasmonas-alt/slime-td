import type { GameState, GrowthNode } from '../state';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { nearestFrontierPoint } from '../systems/frontier';
import { missileCooldown, missileDamage, missileRadius } from '../tuning/weapons';

const MISSILE_SPEED = 300;

// Prefers a live growth node over the frontier, same as Caustic Cloud —
// homing suits a priority target that won't sit still relative to the
// wall. Threads whether the target is actually a node directly, rather
// than the prototype's `target.hp !== undefined` duck-typing against an
// untyped union.
export function updateMissileWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.missile;
  if (!lvl) return;
  state.weaponTimers.missile -= dt;
  if (state.weaponTimers.missile > 0) return;

  const activeNode = state.nodes.find((n) => !n.dead) ?? null;
  const target = activeNode ?? nearestFrontierPoint(state);
  if (!target) return;

  state.weaponTimers.missile = missileCooldown(lvl) / atkSpeedMult(state);
  fireMissile(state, activeNode, target.x, target.y, missileDamage(lvl) * damageMult(state), missileRadius(lvl));
}

function fireMissile(
  state: GameState,
  targetNode: GrowthNode | null,
  targetX: number,
  targetY: number,
  dmg: number,
  splashRadius: number,
): void {
  const t = state.tower;
  state.projectiles.push({
    type: 'missile',
    x: t.x,
    y: t.y,
    vx: 0,
    vy: 0,
    speed: MISSILE_SPEED,
    dmg,
    splashRadius,
    radius: 5,
    color: '#ff9d6b',
    life: 5,
    targetNode,
    targetPoint: { x: targetX, y: targetY },
  });
}
