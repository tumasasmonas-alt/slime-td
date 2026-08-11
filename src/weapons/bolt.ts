import type { GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, projectileFlags, resolveOpts } from '../systems/resolveOpts';
import { targetingAcquire } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { boltCooldown, boltDamage } from '../tuning/weapons';
import { cooldownReady, emissionAngles, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const BOLT_SPEED = 620;
const MULTISHOT_SPREAD = 0.3; // radians between adjacent shots

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Overcharge —
// every 5th shot (this weapon's own emission count, not the game clock)
// deals a bonus multiplier. Twin Barrel — a second bolt from an offset
// origin, at a power fraction that grows with level.
const OVERCHARGE_EVERY = 5;
const OVERCHARGE_MULT: readonly [number, number, number] = [2.5, 3, 3.5];
const TWIN_BARREL_OFFSET = 10;
const TWIN_BARREL_POWER: readonly [number, number, number] = [0.4, 0.6, 0.8];
// Tracking Rounds' re-acquire turn rate, degrees/s -> radians/s.
const TRACKING_TURN_RATE: readonly [number, number, number] = [60, 90, 120];

export const boltPipeline: WeaponPipeline = {
  ready: cooldownReady('bolt', boltCooldown),
  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md): a socketed
  // Targeting gem replaces this wholesale; frontierAcquire is only the
  // default when none is socketed.
  acquire: targetingAcquire('bolt', (s) => s.grid?.maxRange ?? 0, frontierAcquire),
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'bolt');
    const plan = emissionPlan(state, 'bolt');
    const flags = { ...projectileFlags(state, 'bolt'), ...resolveOpts(state, 'bolt') };
    let dmg = (boltDamage(lvl) * mods.damage * powerMult) / plan.count;

    const shots = (state.weaponShots.bolt ?? 0) + 1;
    state.weaponShots.bolt = shots;
    const overchargeLvl = extensionLevel(state, 'bolt', 'overcharge');
    if (overchargeLvl > 0 && shots % OVERCHARGE_EVERY === 0) {
      dmg *= OVERCHARGE_MULT[overchargeLvl - 1]!;
    }

    const trackingLvl = extensionLevel(state, 'bolt', 'trackingRounds');
    const reacquireRate = trackingLvl > 0 ? (TRACKING_TURN_RATE[trackingLvl - 1]! * Math.PI) / 180 : undefined;

    const t = state.tower;
    const baseAngle = Math.atan2(target.y - t.y, target.x - t.x);
    for (const a of emissionAngles(plan.count, baseAngle, plan.formation, MULTISHOT_SPREAD)) {
      fireBolt(state, t.x, t.y, a, dmg, mods, flags, target, reacquireRate);
    }

    const twinLvl = extensionLevel(state, 'bolt', 'twinBarrel');
    if (twinLvl > 0) {
      const perp = baseAngle + Math.PI / 2;
      const ox = t.x + Math.cos(perp) * TWIN_BARREL_OFFSET;
      const oy = t.y + Math.sin(perp) * TWIN_BARREL_OFFSET;
      fireBolt(state, ox, oy, baseAngle, dmg * TWIN_BARREL_POWER[twinLvl - 1]!, mods, flags, target, reacquireRate);
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
  originX: number,
  originY: number,
  angle: number,
  dmg: number,
  mods: { area: number; velocity: number },
  flags: ReturnType<typeof projectileFlags> & ReturnType<typeof resolveOpts>,
  target: { x: number; y: number },
  reacquireRate: number | undefined,
): void {
  const speed = BOLT_SPEED * mods.velocity;
  state.projectiles.push({
    type: 'bolt',
    x: originX,
    y: originY,
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
    reacquireRate,
  });
}
