import type { BubbleSeed, GameState } from '../state';
import { damageMult } from '../systems/passives';
import { poisonCooldown, poisonDamage, poisonRadius } from '../tuning/weapons';
import { rand } from '../util/math';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const CLOUD_LIFE = 3.4;
const CLOUD_COLOR = '#8aff4d';
const BUBBLE_COUNT = 4;

const poisonPipeline: WeaponPipeline = {
  ready: cooldownReady('poison', poisonCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target) => {
    if (!target) return;
    state.clouds.push({
      x: target.x,
      y: target.y,
      radius: poisonRadius(lvl),
      life: CLOUD_LIFE,
      maxLife: CLOUD_LIFE,
      dmgPerSec: poisonDamage(lvl) * damageMult(state),
      color: CLOUD_COLOR,
      tickTimer: 0,
      bubbleSeeds: spawnBubbleSeeds(),
    });
  },
};

export function updatePoisonWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.poison;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, poisonPipeline);
}

function spawnBubbleSeeds(): BubbleSeed[] {
  const seeds: BubbleSeed[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(0.15, 0.7), speed: rand(1.5, 3), phase: rand(0, Math.PI * 2) });
  }
  return seeds;
}
