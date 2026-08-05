import type { WeaponKey } from '../types';
import { towerCenteredRadius, type TowerCenteredReach } from './weaponGeometry';

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

export function bladeCount(lvl: number): number {
  return Math.min(1 + Math.floor((lvl - 1) / 2), 5);
}

export function bladeDamage(lvl: number): number {
  return 7 + (lvl - 1) * 3.2;
}

// Prototype formula was `62 + Math.min(24, lvl*2)` — linear across the
// whole 1-8 level range the cap never actually engages (8*2=16 < 24), so
// it's expressed directly as the equivalent base+perLevel form here.
const BLADE_REACH: TowerCenteredReach = { margin: 15, base: 64, perLevel: 2 };

// Orbit radius, anchored to the safe radius as a floor (Confirmed
// decision 16 in docs/PROGRESS.md) rather than the prototype's flat
// constant — see "documented prototype bugs" #5 for why that mattered:
// the flat constant made blades unable to hit ambient infection at any
// tier or level, in any run.
export function bladeRadius(lvl: number, safeRadius: number): number {
  return towerCenteredRadius(BLADE_REACH, lvl, safeRadius);
}

// Single shared library for every weapon's data — upgrades, tiers, and
// tunable variables all live here rather than one file per weapon, so
// balance edits are one file to open. See "Confirmed decisions" in
// docs/PROGRESS.md.
export const WEAPON_DEFS: Partial<Record<WeaponKey, WeaponDef>> = {
  bolt: {
    name: 'Bolt Turret',
    icon: '⚡',
    maxLevel: 8,
    desc: (lvl) => `Fires at the nearest wall of infection. Lv${lvl}: ${boltDamage(lvl).toFixed(0)} pwr`,
  },
  blades: {
    name: 'Orbiting Blades',
    icon: '🗡️',
    maxLevel: 8,
    desc: (lvl) => `Spinning blades shred any tissue they touch. Lv${lvl}: ${bladeCount(lvl)} blade(s)`,
  },
};
