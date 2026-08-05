import type { GameState } from '../state';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { nearestFrontierPoint } from '../systems/frontier';
import { boltCooldown, boltDamage } from '../tuning/weapons';

const BOLT_SPEED = 620;

export function updateBoltWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.bolt;
  if (!lvl) return;
  state.weaponTimers.bolt -= dt;
  if (state.weaponTimers.bolt > 0) return;
  const target = nearestFrontierPoint(state);
  if (!target) return;
  state.weaponTimers.bolt = boltCooldown(lvl) / atkSpeedMult(state);
  fireBolt(state, target.x, target.y, boltDamage(lvl) * damageMult(state));
}

function fireBolt(state: GameState, targetX: number, targetY: number, dmg: number): void {
  const t = state.tower;
  const a = Math.atan2(targetY - t.y, targetX - t.x);
  state.projectiles.push({
    type: 'bolt',
    x: t.x,
    y: t.y,
    vx: Math.cos(a) * BOLT_SPEED,
    vy: Math.sin(a) * BOLT_SPEED,
    dmg,
    radius: 4,
    color: '#6df0ff',
    life: 1.6,
  });
}
