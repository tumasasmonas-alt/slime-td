import type { BubbleSeed, GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, hasBounceGem, hasChainingGem, hasForkGem, hasHomingGem, hasRicochetGem, resolveOpts } from '../systems/resolveOpts';
import { targetingAcquire } from '../systems/targetingGems';
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

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Poison's
// four extensions. Corrosive and Lingering Spores are per-cloud fields
// (systems/clouds.ts); Twin Canister spawns a second, differently-shaped
// cloud; Cloud Radius (cloudRadius) is pure `mods`, no code here.
const CORROSIVE_SHRED: readonly [number, number, number] = [0.3, 0.45, 0.6];
const LINGERING_DRIFT: readonly [number, number, number] = [12, 18, 24];
// 2026-08-10 bug fix: was a fixed +40/+40 diagonal offset every time —
// the owner's report ("spread the drops randomly"). Now a random angle
// at a fixed distance from the target.
const TWIN_CANISTER_DIST = 40;
const TWIN_CANISTER_RADIUS_MULT = 0.6;
const TWIN_CANISTER_LIFE_MULT = 2;

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Poison's cloud
// reading for Fork/Chaining/Bounce/Ricochet. Fork/Bounce/Ricochet bake a
// flag onto the cloud itself, consumed by systems/clouds.ts at expiry or
// per-tick; Chaining is its own thing entirely — a genuine extra cloud
// ("tendril... toward the nearest mass"), reusing the SAME `homing` field
// Homing itself uses, just forced on for this one extra cloud regardless
// of whether the Homing gem is also socketed.
const CHAINING_RADIUS_MULT = 0.5;
const CHAINING_LIFE_MULT = 0.8;
const CHAINING_DMG_MULT = 0.6;
const BOUNCE_MAX_HOPS = 2;

export const poisonPipeline: WeaponPipeline = {
  ready: cooldownReady('poison', poisonCooldown),
  acquire: targetingAcquire('poison', (s) => s.grid?.maxRange ?? 0, frontierAcquire),
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'poison');
    const opts = resolveOpts(state, 'poison');
    const plan = emissionPlan(state, 'poison');
    const homing = hasHomingGem(state, 'poison');
    const life = CLOUD_LIFE * mods.duration;
    const radius = (poisonRadius(lvl) * mods.area) / (plan.count > 1 ? 1.4 : 1);
    const perDmg = (poisonDamage(lvl) * mods.damage * powerMult) / plan.count;

    const corrosiveLvl = extensionLevel(state, 'poison', 'corrosive');
    const armorShred = corrosiveLvl > 0 ? CORROSIVE_SHRED[corrosiveLvl - 1] : undefined;
    const lingeringLvl = extensionLevel(state, 'poison', 'lingeringSpores');
    const driftOutward = lingeringLvl > 0 ? LINGERING_DRIFT[lingeringLvl - 1] : undefined;

    const forkOnExpiry = hasForkGem(state, 'poison');
    const bounceOnExpiry = hasBounceGem(state, 'poison');
    const ricochetDrift = hasRicochetGem(state, 'poison');

    for (let i = 0; i < plan.count; i++) {
      const angle = (i / plan.count) * Math.PI * 2;
      const spreadDist = plan.count > 1 ? radius * MULTISHOT_OFFSET_FRACTION : 0;
      const x = target.x + Math.cos(angle) * spreadDist;
      const y = target.y + Math.sin(angle) * spreadDist;
      state.clouds.push({
        x,
        y,
        radius,
        life,
        maxLife: life,
        dmgPerSec: perDmg,
        color: CLOUD_COLOR,
        tickTimer: 0,
        bubbleSeeds: spawnBubbleSeeds(),
        homing,
        armorShred,
        driftOutward,
        driftAngle: rand(0, Math.PI * 2),
        forkOnExpiry,
        bounceOnExpiry,
        bouncesLeft: bounceOnExpiry ? BOUNCE_MAX_HOPS : undefined,
        ricochetDrift,
        ...opts,
      });
    }

    // Chaining: a genuine extra cloud — a smaller "tendril" that drifts
    // toward the nearest mass, reusing Homing's own drift mechanism
    // (systems/clouds.ts) forced on for this one cloud regardless of
    // whether the Homing gem itself is socketed.
    if (hasChainingGem(state, 'poison')) {
      const tendrilLife = life * CHAINING_LIFE_MULT;
      state.clouds.push({
        x: target.x,
        y: target.y,
        radius: radius * CHAINING_RADIUS_MULT,
        life: tendrilLife,
        maxLife: tendrilLife,
        dmgPerSec: perDmg * CHAINING_DMG_MULT,
        color: CLOUD_COLOR,
        tickTimer: 0,
        bubbleSeeds: spawnBubbleSeeds(),
        homing: true,
        ...opts,
      });
    }

    // Twin Canister: a second, smaller, longer-lived cloud landing offset
    // from the first — a different payload, not a second identical cloud
    // (the plan's own finding 1: this differentiates it from Multishot,
    // which just makes more of the same cloud).
    const twinLvl = extensionLevel(state, 'poison', 'twinCanister');
    if (twinLvl > 0) {
      const twinAngle = rand(0, Math.PI * 2);
      const tx = target.x + Math.cos(twinAngle) * TWIN_CANISTER_DIST;
      const ty = target.y + Math.sin(twinAngle) * TWIN_CANISTER_DIST;
      const twinLife = life * TWIN_CANISTER_LIFE_MULT;
      state.clouds.push({
        x: tx,
        y: ty,
        radius: radius * TWIN_CANISTER_RADIUS_MULT,
        life: twinLife,
        maxLife: twinLife,
        dmgPerSec: perDmg,
        color: CLOUD_COLOR,
        tickTimer: 0,
        bubbleSeeds: spawnBubbleSeeds(),
        homing,
        armorShred,
        driftOutward,
        driftAngle: rand(0, Math.PI * 2),
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

// Phase 6C-1: exported so Fission's Sticky extension (systems/
// projectiles.ts) can reuse it wholesale rather than duplicating the
// bubble-seed generation for its own small burning-patch clouds.
export function spawnBubbleSeeds(): BubbleSeed[] {
  const seeds: BubbleSeed[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    seeds.push({ a: rand(0, Math.PI * 2), r: rand(0.15, 0.7), speed: rand(1.5, 3), phase: rand(0, Math.PI * 2) });
  }
  return seeds;
}
