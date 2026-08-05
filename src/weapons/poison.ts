import type { BubbleSeed, GameState } from '../state';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { nearestFrontierPoint } from '../systems/frontier';
import { poisonCooldown, poisonDamage, poisonRadius } from '../tuning/weapons';
import { rand } from '../util/math';

const CLOUD_LIFE = 3.4;
const CLOUD_COLOR = '#8aff4d';
const BUBBLE_COUNT = 4;

// Prefers a live growth node over the frontier — nodes are the priority
// target, and a lingering cloud is well suited to sitting on one while
// it ticks down.
export function updatePoisonWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.poison;
  if (!lvl) return;
  state.weaponTimers.poison -= dt;
  if (state.weaponTimers.poison > 0) return;
  state.weaponTimers.poison = poisonCooldown(lvl) / atkSpeedMult(state);

  const activeNode = state.nodes.find((n) => !n.dead);
  const target = activeNode ?? nearestFrontierPoint(state);
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
}

function spawnBubbleSeeds(): BubbleSeed[] {
  const seeds: BubbleSeed[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(0.15, 0.7), speed: rand(1.5, 3), phase: rand(0, Math.PI * 2) });
  }
  return seeds;
}
