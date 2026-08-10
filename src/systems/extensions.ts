import type { GameState } from '../state';
import { EXTENSION_DEFS, type ExtensionKey } from '../tuning/extensions';
import type { GemModDelta } from '../tuning/gems';
import type { WeaponKey } from '../types';

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S5.2): mirrors
// systems/weaponMods.ts and systems/resolveOpts.ts exactly — systems reads
// GameState, tuning holds data. 0 means "not currently socketed in this
// weapon" (banked has no effect, same as a banked gem); a level-bearing
// extension not in the weapon's own sockets right now reads as 0 even if
// it exists in extensionInventory.
export function extensionLevel(state: GameState, key: WeaponKey, ext: ExtensionKey): 0 | 1 | 2 | 3 {
  const sockets = state.weaponSockets[key];
  const instance = sockets?.extensions.find((e) => e.kind === ext);
  return instance ? instance.level : 0;
}

// Summed into weaponMods() (systems/weaponMods.ts), not returned
// alongside it — every existing consumer (a weapon's deliver,
// cooldownReady, WeaponDef.stats(), the inventory screen's live stat
// line) picks up an extension's mods-channel effect with zero changes.
export function extensionMods(state: GameState, key: WeaponKey): GemModDelta {
  const sockets = state.weaponSockets[key];
  if (!sockets || sockets.extensions.length === 0) return {};
  let damage = 0;
  let rate = 0;
  let area = 0;
  let duration = 0;
  let velocity = 0;
  for (const ext of sockets.extensions) {
    const def = EXTENSION_DEFS[ext.kind as ExtensionKey];
    if (!def?.mods) continue;
    const delta = def.mods(ext.level);
    damage += delta.damage ?? 0;
    rate += delta.rate ?? 0;
    area += delta.area ?? 0;
    duration += delta.duration ?? 0;
    velocity += delta.velocity ?? 0;
  }
  return { damage, rate, area, duration, velocity };
}
