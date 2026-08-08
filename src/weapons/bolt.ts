import type { GameState } from '../state';
import { damageMult } from '../systems/passives';
import { boltCooldown, boltDamage } from '../tuning/weapons';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const BOLT_SPEED = 620;

const boltPipeline: WeaponPipeline = {
  ready: cooldownReady('bolt', boltCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target) => {
    if (!target) return;
    fireBolt(state, target.x, target.y, boltDamage(lvl) * damageMult(state));
  },
};

export function updateBoltWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.bolt;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, boltPipeline);
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
