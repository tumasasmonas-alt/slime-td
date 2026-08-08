import type { GameState } from '../state';
import { damageMult } from '../systems/passives';
import { chainCooldown, chainCount, chainDamage } from '../tuning/weapons';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const CHAIN_SPEED = 760;

const chainPipeline: WeaponPipeline = {
  ready: cooldownReady('chain', chainCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target) => {
    if (!target) return;
    fireChain(state, target.x, target.y, chainCount(lvl), chainDamage(lvl) * damageMult(state));
  },
};

export function updateChainWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.chain;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, chainPipeline);
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
