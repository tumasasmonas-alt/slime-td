import type { GameState } from '../state';
import type { CoreGemKey } from '../tuning/coreGems';
import type { PassiveKey } from '../types';

function passiveLevel(state: GameState, key: PassiveKey): number {
  return state.passives[key] ?? 0;
}

function passiveMult(state: GameState, key: PassiveKey, perLevel: number, cap?: number): number {
  const value = passiveLevel(state, key) * perLevel;
  return cap !== undefined ? Math.min(value, cap) : value;
}

// Phase 6A-1: damageMult()/atkSpeedMult() are gone — Amplifier and
// Overclock are per-weapon socketed gems now (systems/weaponMods.ts),
// not whole-game passives. See docs/plans/phase-6a1-gem-foundation.md S7.

export function pickupMult(state: GameState): number {
  return 1 + passiveMult(state, 'pickup', 0.35);
}

export function xpMult(state: GameState): number {
  return 1 + passiveMult(state, 'xpGain', 0.14);
}

// A multiplier applied to incoming damage — Armor Plating reduces it, up
// to a cap so it can never reach or exceed full immunity.
export function armorMult(state: GameState): number {
  return 1 - passiveMult(state, 'armor', 0.07, 0.55);
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S6): a core gem's effect
// used to apply at card-PICK time (systems/cards.ts's old applyCardChoice)
// because picking one used to fill a core socket directly. Now that core
// gems bank in state.coreGemInventory and only take effect once actually
// socketed (systems/gemSockets.ts's socketCoreGem/unsocketCoreGem), the
// effect itself moves here, symmetric with removeCoreGemEffect below.
// `duplicates disallowed` (state.ts's GameState.coreGems comment) means
// this can only ever be called from 0 -> 1, never higher — no perLevel
// stacking to worry about, unlike PASSIVE_DEFS' own maxLevel field, which
// describes a stacking model this mechanism has never actually reached.
export function applyCoreGemEffect(state: GameState, key: CoreGemKey): void {
  state.passives[key] = 1;
  if (key === 'maxHp') {
    state.tower.maxHp += 20;
    state.tower.hp = Math.min(state.tower.maxHp, state.tower.hp + 20);
  }
}

// The owner's rule (docs/plans/phase-6a3-loop-fixes.md S1, call 5):
// "unsocketing the core gem should remove what it gave" — exact mirror of
// applyCoreGemEffect, always called from 1 -> 0. The `hp` clamp is the
// load-bearing line: without it, socketing maxHp then taking damage then
// unsocketing would leave `hp` above the new, lower `maxHp`, and
// re-socketing would silently re-heal past where the player actually is —
// a free-heal loop. See systems/gemSockets.test.ts's heal-exploit case.
export function removeCoreGemEffect(state: GameState, key: CoreGemKey): void {
  delete state.passives[key];
  if (key === 'maxHp') {
    state.tower.maxHp = Math.max(0, state.tower.maxHp - 20);
    state.tower.hp = Math.min(state.tower.hp, state.tower.maxHp);
  }
}
