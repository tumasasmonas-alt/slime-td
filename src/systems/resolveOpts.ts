import type { ClearOptions } from '../grid/clear';
import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { isBehaviourGem, isConditionalGem } from '../tuning/gems';

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): weaponMods.ts's
// sibling — walks a weapon's socketed Behaviour gems once and builds the
// RESOLVE-stage ClearOptions from them, the same "one call per weapon"
// shape every weapon's deliver already uses for damage/rate/area/
// duration/velocity.
const KICKBACK_PUSH_PX = 40;
const PRIMING_MULT = 3;

// Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3): the nine
// Conditional gems' own values — first-draft, sized against Amplifier's
// +45% flat damage (tuning/gems.ts's own convention), smaller where the
// bonus only ever applies to a fraction of what a hit touches (one
// coagulant, or ground already past a maturity/density threshold) rather
// than everything a hit overlaps.
const PENETRATION_CAP = 50; // flat armour points ignored, comparable to Lance's own Piercing Core (40-80)
const VIRULENCE_BONUS = 0.5;
const SATURATION_BONUS = 0.5;
const GIANT_SLAYER_BONUS = 0.5;
const CULLING_BONUS = 0.5;
// A coagulant at or below this fraction of its OWN starting mass is
// instantly finished (grid/clear.ts's coagulant loop) — small enough
// that it reads as "cleaning up a sliver," not a second damage source.
const CULLING_FINISH_FRACTION = 0.12;
const CORROSION_SHRED_FRACTION = 0.35;
const DESPERATION_BONUS = 0.6;
const PROXIMITY_BONUS = 0.5;
// Momentum: +8% per consecutive hit, capped at 5 stacks (+40% at cap) —
// resolved into the CURRENT multiplier here, not a per-hit coefficient,
// since this is the one Conditional gem with state to read
// (state.weaponStreak, written back by grid/clear.ts's clearAt).
const MOMENTUM_PER_HIT = 0.08;
const MOMENTUM_CAP = 5;

export function resolveOpts(state: GameState, key: WeaponKey): Partial<ClearOptions> {
  const sockets = state.weaponSockets[key];
  if (!sockets || sockets.gems.length === 0) return {};
  const opts: Partial<ClearOptions> = {};
  for (const gem of sockets.gems) {
    if (isBehaviourGem(gem.kind)) {
      switch (gem.kind) {
        case 'pierce':
          opts.ignoreResistance = true;
          break;
        case 'splash':
          opts.flattenFalloff = true;
          break;
        case 'overflow':
          opts.overflow = true;
          break;
        case 'kickback':
          opts.kickback = KICKBACK_PUSH_PX;
          break;
        case 'priming':
          opts.priming = PRIMING_MULT;
          break;
        default:
          break; // the other nine aren't RESOLVE-stage — see projectileFlags/emissionPlan
      }
    } else if (isConditionalGem(gem.kind)) {
      switch (gem.kind) {
        // Penetration/Corrosion reuse fields that already exist —
        // Lance's Piercing Core (armorIgnoreCap) and Poison's Corrosive
        // (armorShred) respectively. When both a gem and the matching
        // extension are socketed on the same weapon, the gem's value
        // wins outright (every weapon's own clearAt call spreads `...opts`
        // LAST, after its own extension-set fields) rather than the two
        // stacking — Decision 90.
        case 'penetration':
          opts.armorIgnoreCap = PENETRATION_CAP;
          break;
        case 'virulence':
          opts.maturityScaled = VIRULENCE_BONUS;
          break;
        case 'saturation':
          opts.saturationScaled = SATURATION_BONUS;
          break;
        case 'giantSlayer':
          opts.massScaledUp = GIANT_SLAYER_BONUS;
          break;
        case 'culling':
          opts.massScaledDown = CULLING_BONUS;
          opts.cullingFinishFraction = CULLING_FINISH_FRACTION;
          break;
        case 'corrosion':
          opts.armorShred = CORROSION_SHRED_FRACTION;
          break;
        case 'desperation':
          opts.desperationScaled = DESPERATION_BONUS;
          break;
        case 'proximity':
          opts.proximityScaled = PROXIMITY_BONUS;
          break;
        case 'momentum':
          opts.momentumKey = key;
          opts.momentumMult = 1 + MOMENTUM_PER_HIT * Math.min(state.weaponStreak[key] ?? 0, MOMENTUM_CAP);
          break;
        default:
          break;
      }
    }
  }
  return opts;
}

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S3): the projectile
// behaviour flags a weapon's fireX() bakes onto a projectile at spawn
// time — see systems/projectiles.ts for how each is consumed. Charge
// counts are fixed constants rather than tuned content; first-draft
// numbers like every other gem value in this batch.
const PIERCE_CHARGES = 3;
const CHAIN_HOPS = 3;
const BOUNCE_HOPS = 2;

export interface ProjectileFlags {
  pierce?: number;
  forks?: number;
  chains?: number;
  bounces?: number;
  homing?: boolean;
  ricochet?: boolean;
}

export function projectileFlags(state: GameState, key: WeaponKey): ProjectileFlags {
  const sockets = state.weaponSockets[key];
  if (!sockets || sockets.gems.length === 0) return {};
  const flags: ProjectileFlags = {};
  for (const gem of sockets.gems) {
    if (!isBehaviourGem(gem.kind)) continue;
    switch (gem.kind) {
      case 'pierce':
        flags.pierce = PIERCE_CHARGES;
        break;
      case 'fork':
        flags.forks = 1; // a presence flag — systems/projectiles.ts's FORK_COUNT sets the actual child count
        break;
      case 'chaining':
        flags.chains = CHAIN_HOPS;
        break;
      case 'bounce':
        flags.bounces = BOUNCE_HOPS;
        break;
      case 'homing':
        flags.homing = true;
        break;
      case 'ricochet':
        flags.ricochet = true;
        break;
      default:
        break;
    }
  }
  return flags;
}

// Phase 6A-2: Multishot/Formation read once per weapon, feeding the
// emission-multiplication wrapper each weapon's deliver applies to
// itself. `count` is 1 (no gem) or 3 (Multishot's "+2", per its card
// copy); `formation` says whether the extras land in a fixed pattern
// (Formation) rather than a scattered spread (plain Multishot). Reading
// both directly here rather than through the switch above — they're not
// RESOLVE or projectile-flight concerns, so folding them into either of
// those functions would blur what each one is for.
export interface EmissionPlan {
  count: number;
  formation: boolean;
}

const MULTISHOT_BONUS = 2;

export function emissionPlan(state: GameState, key: WeaponKey): EmissionPlan {
  const sockets = state.weaponSockets[key];
  let count = 1;
  let formation = false;
  if (sockets) {
    for (const gem of sockets.gems) {
      if (gem.kind === 'multishot') count += MULTISHOT_BONUS;
      if (gem.kind === 'formation') {
        count += MULTISHOT_BONUS;
        formation = true;
      }
    }
  }
  return { count, formation };
}

// Phase 6A-2: whether Homing is socketed — read separately from
// projectileFlags because self-centered weapons (Frost, Immolation,
// Caustic Cloud) consume it as an origin/drift bias, not a projectile
// field.
export function hasHomingGem(state: GameState, key: WeaponKey): boolean {
  const sockets = state.weaponSockets[key];
  return sockets?.gems.some((g) => g.kind === 'homing') ?? false;
}

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): the same
// presence-check shape as hasHomingGem, for the four gems whose
// non-projectile readings (Blades/Frost/Immolation/Poison/Lance/
// Shockwave) are per-weapon-local mechanisms rather than
// systems/projectiles.ts flags — those weapons never touch
// projectileFlags() at all, so they need their own direct socket check.
function hasBehaviourGem(state: GameState, key: WeaponKey, kind: 'fork' | 'chaining' | 'bounce' | 'ricochet'): boolean {
  const sockets = state.weaponSockets[key];
  return sockets?.gems.some((g) => g.kind === kind) ?? false;
}

export const hasForkGem = (state: GameState, key: WeaponKey): boolean => hasBehaviourGem(state, key, 'fork');
export const hasChainingGem = (state: GameState, key: WeaponKey): boolean => hasBehaviourGem(state, key, 'chaining');
export const hasBounceGem = (state: GameState, key: WeaponKey): boolean => hasBehaviourGem(state, key, 'bounce');
export const hasRicochetGem = (state: GameState, key: WeaponKey): boolean => hasBehaviourGem(state, key, 'ricochet');
