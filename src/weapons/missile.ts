import type { GameState } from '../state';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { nearestFrontierPoint } from '../systems/frontier';
import { missileCooldown, missileDamage, missileRadius } from '../tuning/weapons';

const MISSILE_SPEED = 300;

// Homes toward a fixed target point rather than a live entity — the
// homing behaviour has nothing to chase until Phase 3C's coagulants land
// (Decision 43/BACKLOG Phase 3A). Reverting to the frontier point once a
// coagulant target exists is a small follow-up, not a rewrite: the
// projectile's steering already tracks whatever targetPoint holds.
export function updateMissileWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.missile;
  if (!lvl) return;
  state.weaponTimers.missile -= dt;
  if (state.weaponTimers.missile > 0) return;

  const target = nearestFrontierPoint(state);
  if (!target) return;

  state.weaponTimers.missile = missileCooldown(lvl) / atkSpeedMult(state);
  fireMissile(state, target.x, target.y, missileDamage(lvl) * damageMult(state), missileRadius(lvl));
}

function fireMissile(state: GameState, targetX: number, targetY: number, dmg: number, splashRadius: number): void {
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
    targetPoint: { x: targetX, y: targetY },
  });
}
