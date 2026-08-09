import type { ClearOptions } from '../grid/clear';
import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { isBehaviourGem } from '../tuning/gems';

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): weaponMods.ts's
// sibling — walks a weapon's socketed Behaviour gems once and builds the
// RESOLVE-stage ClearOptions from them, the same "one call per weapon"
// shape every weapon's deliver already uses for damage/rate/area/
// duration/velocity.
const KICKBACK_PUSH_PX = 40;
const PRIMING_MULT = 3;

export function resolveOpts(state: GameState, key: WeaponKey): Partial<ClearOptions> {
  const sockets = state.weaponSockets[key];
  if (!sockets || sockets.gems.length === 0) return {};
  const opts: Partial<ClearOptions> = {};
  for (const gem of sockets.gems) {
    if (!isBehaviourGem(gem.kind)) continue;
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
