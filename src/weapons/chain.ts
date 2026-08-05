import type { GameState } from '../state';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { nearestFrontierPoint } from '../systems/frontier';
import { chainCooldown, chainCount, chainDamage } from '../tuning/weapons';

const CHAIN_SPEED = 760;

export function updateChainWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.chain;
  if (!lvl) return;
  state.weaponTimers.chain -= dt;
  if (state.weaponTimers.chain > 0) return;
  const target = nearestFrontierPoint(state);
  if (!target) return;
  state.weaponTimers.chain = chainCooldown(lvl) / atkSpeedMult(state);
  fireChain(state, target.x, target.y, chainCount(lvl), chainDamage(lvl) * damageMult(state));
}

function fireChain(state: GameState, targetX: number, targetY: number, hops: number, dmg: number): void {
  const t = state.tower;
  const a = Math.atan2(targetY - t.y, targetX - t.x);
  state.projectiles.push({
    type: 'chain',
    x: t.x,
    y: t.y,
    vx: Math.cos(a) * CHAIN_SPEED,
    vy: Math.sin(a) * CHAIN_SPEED,
    dmg,
    radius: 5,
    color: '#e6c8ff',
    life: 1.4,
    hopsLeft: hops,
    visited: new Set(),
    legStart: { x: t.x, y: t.y },
  });
}
