import type { GameState } from '../state';
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
