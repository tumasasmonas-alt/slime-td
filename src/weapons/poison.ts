import type { BubbleSeed, GameState } from '../state';
import { emissionPlan, hasHomingGem, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { poisonCooldown, poisonDamage, poisonRadius } from '../tuning/weapons';
import { rand } from '../util/math';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const CLOUD_LIFE = 3.4;
const CLOUD_COLOR = '#8aff4d';
const BUBBLE_COUNT = 4;
// Phase 6A-2: Multishot/Formation's extra clouds scatter around the
// target point by this fraction of the cloud's own radius.
const MULTISHOT_OFFSET_FRACTION = 0.6;

export const poisonPipeline: WeaponPipeline = {
  ready: cooldownReady('poison', poisonCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'poison');
    const opts = resolveOpts(state, 'poison');
    const plan = emissionPlan(state, 'poison');
    const homing = hasHomingGem(state, 'poison');
    const life = CLOUD_LIFE * mods.duration;
    const radius = (poisonRadius(lvl) * mods.area) / (plan.count > 1 ? 1.4 : 1);
    const perDmg = (poisonDamage(lvl) * mods.damage * powerMult) / plan.count;

    for (let i = 0; i < plan.count; i++) {
      const angle = (i / plan.count) * Math.PI * 2;
      const spreadDist = plan.count > 1 ? radius * MULTISHOT_OFFSET_FRACTION : 0;
      state.clouds.push({
        x: target.x + Math.cos(angle) * spreadDist,
        y: target.y + Math.sin(angle) * spreadDist,
        radius,
        life,
        maxLife: life,
        dmgPerSec: perDmg,
        color: CLOUD_COLOR,
        tickTimer: 0,
        bubbleSeeds: spawnBubbleSeeds(),
        homing,
        ...opts,
      });
    }
  },
};

export function updatePoisonWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.poison;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, poisonPipeline, 'poison');
}

function spawnBubbleSeeds(): BubbleSeed[] {
  const seeds: BubbleSeed[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(0.15, 0.7), speed: rand(1.5, 3), phase: rand(0, Math.PI * 2) });
  }
  return seeds;
}
