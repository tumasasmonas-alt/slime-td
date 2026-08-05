import type { WeaponKey } from '../types';

export interface WeaponDef {
  readonly name: string;
  readonly icon: string;
  readonly maxLevel: number;
  readonly desc: (lvl: number) => string;
}

export function boltDamage(lvl: number): number {
  return 10 + (lvl - 1) * 5;
}

export function boltCooldown(lvl: number): number {
  return Math.max(0.16, 0.55 - (lvl - 1) * 0.045);
}

// Single shared library for every weapon's data — upgrades, tiers, and
// tunable variables all live here rather than one file per weapon, so
// balance edits are one file to open. See "Confirmed decisions" in
// docs/PROGRESS.md. Only Bolt Turret is implemented in Phase 2C; the
// other five weapon keys are added here in Phase 2E.
export const WEAPON_DEFS: Partial<Record<WeaponKey, WeaponDef>> = {
  bolt: {
    name: 'Bolt Turret',
    icon: '⚡',
    maxLevel: 8,
    desc: (lvl) => `Fires at the nearest wall of infection. Lv${lvl}: ${boltDamage(lvl).toFixed(0)} pwr`,
  },
};
