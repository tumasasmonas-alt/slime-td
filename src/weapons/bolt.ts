import type { GameState } from '../state';
import { emissionPlan, projectileFlags, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { boltCooldown, boltDamage } from '../tuning/weapons';
import { cooldownReady, emissionAngles, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const BOLT_SPEED = 620;
const MULTISHOT_SPREAD = 0.3; // radians between adjacent shots

export const boltPipeline: WeaponPipeline = {
  ready: cooldownReady('bolt', boltCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'bolt');
    const plan = emissionPlan(state, 'bolt');
    const flags = { ...projectileFlags(state, 'bolt'), ...resolveOpts(state, 'bolt') };
    const dmg = (boltDamage(lvl) * mods.damage * powerMult) / plan.count;
    const t = state.tower;
    const baseAngle = Math.atan2(target.y - t.y, target.x - t.x);
    for (const a of emissionAngles(plan.count, baseAngle, plan.formation, MULTISHOT_SPREAD)) {
      fireBolt(state, a, dmg, mods, flags, target);
    }
  },
};

export function updateBoltWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.bolt;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, boltPipeline, 'bolt');
}

function fireBolt(
  state: GameState,
  angle: number,
  dmg: number,
  mods: { area: number; velocity: number },
  flags: ReturnType<typeof projectileFlags> & ReturnType<typeof resolveOpts>,
  target: { x: number; y: number },
): void {
  const t = state.tower;
  const speed = BOLT_SPEED * mods.velocity;
  state.projectiles.push({
    type: 'bolt',
    x: t.x,
    y: t.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg,
    radius: 4,
    color: '#6df0ff',
    life: 1.6,
    src: 'bolt',
    impactAreaMult: mods.area,
    ...flags,
    homingTarget: flags.homing ? { x: target.x, y: target.y } : undefined,
  });
}
