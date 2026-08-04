// Shared vocabulary used by both state.ts and the tuning/ modules.
// Lives outside both so neither has to import "downward" from the other.

export type WeaponKey = 'bolt' | 'blades' | 'chain' | 'frost' | 'poison' | 'missile';

export type PassiveKey =
  | 'maxHp'
  | 'regen'
  | 'armor'
  | 'atkSpeed'
  | 'damage'
  | 'pickup'
  | 'xpGain'
  | 'ward';
