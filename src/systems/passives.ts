import type { GameState } from '../state';
import type { PassiveKey } from '../types';

function passiveLevel(state: GameState, key: PassiveKey): number {
  return state.passives[key] ?? 0;
}

function passiveMult(state: GameState, key: PassiveKey, perLevel: number, cap?: number): number {
  const value = passiveLevel(state, key) * perLevel;
  return cap !== undefined ? Math.min(value, cap) : value;
}

export function damageMult(state: GameState): number {
  return 1 + passiveMult(state, 'damage', 0.1);
}

export function atkSpeedMult(state: GameState): number {
  return 1 + passiveMult(state, 'atkSpeed', 0.09);
}

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
