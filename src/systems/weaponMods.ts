import type { GameState } from '../state';
import { AMPLIFIER_GEM_DEFS, IDENTITY_MODS, isAmplifierGem, type WeaponMods } from '../tuning/gems';
import type { WeaponKey } from '../types';
import { extensionMods } from './extensions';

export type { WeaponMods };

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S4): the per-weapon
// replacement for the deleted global damageMult()/atkSpeedMult() — every
// weapon now asks "what do MY sockets say" instead of reading a whole-game
// multiplier. `rate` divides a cooldown (or, for Blades, multiplies spin
// speed — orbital has no cooldown to divide); `area` scales a radius;
// `duration` scales a lingering effect's lifetime; `velocity` scales
// travel speed. All five default to 1 (no-op) with no gems socketed.
//
// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S5.2): folds in
// extensionMods() (systems/extensions.ts) alongside Amplifier gems' own
// deltas — this is the load-bearing choice that makes extension mods
// "just show up" everywhere weaponMods already reads (a weapon's deliver,
// cooldownReady, the live inventory stat line) with zero changes to any
// of those call sites.

// Deliberately uncached — sockets change only from the inventory screen,
// never per frame, so a memo would trade a correctness risk (a stale
// cache after a socket change silently keeps applying the old value) for
// a walk over at most a handful of entries. systems/passives.ts has done
// the same uncached walk since Phase 2 without ever showing up in a
// profile; see docs/plans/phase-6a1-gem-foundation.md S4.
export function weaponMods(state: GameState, key: WeaponKey): WeaponMods {
  const sockets = state.weaponSockets[key];
  const hasGems = !!sockets && sockets.gems.length > 0;
  const hasExtensions = !!sockets && sockets.extensions.length > 0;
  if (!hasGems && !hasExtensions) return IDENTITY_MODS;

  const points = state.weapons[key] ?? 0;
  let damage = 1;
  let rate = 1;
  let area = 1;
  let duration = 1;
  let velocity = 1;

  if (hasGems) {
    for (const gem of sockets!.gems) {
      if (!isAmplifierGem(gem.kind)) continue; // a Behaviour-class gem — not this system's concern
      const delta = AMPLIFIER_GEM_DEFS[gem.kind].delta(points);
      damage += delta.damage ?? 0;
      rate += delta.rate ?? 0;
      area += delta.area ?? 0;
      duration += delta.duration ?? 0;
      velocity += delta.velocity ?? 0;
    }
  }

  if (hasExtensions) {
    const extDelta = extensionMods(state, key);
    damage += extDelta.damage ?? 0;
    rate += extDelta.rate ?? 0;
    area += extDelta.area ?? 0;
    duration += extDelta.duration ?? 0;
    velocity += extDelta.velocity ?? 0;
  }

  return { damage, rate, area, duration, velocity };
}
