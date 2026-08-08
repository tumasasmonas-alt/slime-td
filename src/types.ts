// Shared vocabulary used by both state.ts and the tuning/ modules.
// Lives outside both so neither has to import "downward" from the other.

// 'immolation' added Phase 5A (Decision 70, docs/plans/phase-5-6-arsenal.md
// S7.11): Ward Pulse was a weapon misfiled as a passive since the port —
// it has a cooldown and a tower-centered radius like Frost and Blades,
// not a flat per-level multiplier like everything in PassiveKey below.
export type WeaponKey = 'bolt' | 'blades' | 'chain' | 'frost' | 'poison' | 'missile' | 'immolation';

export type PassiveKey =
  | 'maxHp'
  | 'regen'
  | 'armor'
  | 'atkSpeed'
  | 'damage'
  | 'pickup'
  | 'xpGain';
