import type { WeaponKey } from '../types';
import { towerCenteredRadius, type TowerCenteredReach } from './weaponGeometry';

export interface WeaponDef {
  readonly name: string;
  readonly icon: string;
  readonly maxLevel: number;
  readonly desc: (lvl: number) => string;
  // Per-weapon multiplier on damage dealt to coagulants, on top of the
  // overlap-area scaling in grid/clear.ts and the global
  // COAGULANT_DAMAGE_SCALE dial. Defaults to 1 for every weapon here —
  // this is deliberately a hook, not tuned content yet: a natural home
  // for a future Penetration-style support gem, or the enhancement-point
  // "base stat you can level up" the project owner asked to keep room
  // for (2026-08-06 follow-up session).
  readonly coagulantMult: number;
}

// Phase 4C-1 (Decision 68): armour lands before Phase 5's penetration
// counter exists to answer it, so damage is raised across the board
// rather than gating the gate on numbers already known to be wrong — the
// project owner's tuning posture: "tune it gently and tune up the damage
// the weapons do by 50%, so we can see our things implemented working but
// also not be overwhelmed [within] 30 seconds of gameplay." One dial,
// multiplied into every *Damage() function below rather than editing six
// sets of coefficients by hand — trivially revertible, and reads as what
// it is: a balance-pass knob, not a rebalanced curve.
export const WEAPON_DAMAGE_SCALE = 1.5;

export function boltDamage(lvl: number): number {
  return (10 + (lvl - 1) * 5) * WEAPON_DAMAGE_SCALE;
}

export function boltCooldown(lvl: number): number {
  return Math.max(0.16, 0.55 - (lvl - 1) * 0.045);
}

export function bladeCount(lvl: number): number {
  return Math.min(1 + Math.floor((lvl - 1) / 2), 5);
}

export function bladeDamage(lvl: number): number {
  return (7 + (lvl - 1) * 3.2) * WEAPON_DAMAGE_SCALE;
}

export function chainCount(lvl: number): number {
  return Math.min(1 + Math.floor((lvl - 1) / 1.6), 6);
}

export function chainDamage(lvl: number): number {
  return (11 + (lvl - 1) * 4) * WEAPON_DAMAGE_SCALE;
}

export function chainCooldown(lvl: number): number {
  return Math.max(0.4, 1.15 - (lvl - 1) * 0.08);
}

export function frostDamage(lvl: number): number {
  return (9 + (lvl - 1) * 3.4) * WEAPON_DAMAGE_SCALE;
}

const FROST_REACH: TowerCenteredReach = { margin: 20, base: 115, perLevel: 12 };

// Radius, anchored to the safe radius as a floor (docs/DECISIONS.md #16) — see bladeRadius() above for why that matters.
export function frostRadius(lvl: number, perimeter: number): number {
  return towerCenteredRadius(FROST_REACH, lvl, perimeter);
}

export function frostCooldown(lvl: number): number {
  return Math.max(1.5, 3.6 - (lvl - 1) * 0.24);
}

export function poisonDamage(lvl: number): number {
  return (6 + (lvl - 1) * 2.4) * WEAPON_DAMAGE_SCALE;
}

export function poisonRadius(lvl: number): number {
  return 58 + (lvl - 1) * 5;
}

export function poisonCooldown(lvl: number): number {
  return Math.max(1.0, 2.3 - (lvl - 1) * 0.15);
}

export function missileDamage(lvl: number): number {
  return (30 + (lvl - 1) * 10) * WEAPON_DAMAGE_SCALE;
}

export function missileRadius(lvl: number): number {
  return 58 + (lvl - 1) * 5;
}

export function missileCooldown(lvl: number): number {
  return Math.max(1.2, 2.7 - (lvl - 1) * 0.18);
}

// Phase 5A (Decision 70): promoted from the `ward` passive's inline
// formula. Deliberately NOT multiplied by WEAPON_DAMAGE_SCALE and NOT
// read through damageMult() at the call site, matching the passive's
// exact prior behaviour — Ward Pulse never received the Phase 4C-1 damage
// pass or the Amplifier passive the other six weapons get, since it
// wasn't classified as a weapon when either was wired up. Preserved
// as-is per 5A's zero-behaviour-change charter; flagged in
// docs/plans/phase-5-6-arsenal.md as a balance call for the owner, not
// silently corrected here.
export function immolationDamage(lvl: number): number {
  return 10 * lvl;
}

// Fixed, level-independent — matches Ward Pulse's WARD_TICK exactly.
// Also NOT divided by atkSpeedMult at the call site (see weapons/immolation.ts):
// Overclock never sped up Ward Pulse, and 5A preserves that rather than
// silently granting it a passive it never had.
export const IMMOLATION_TICK = 1.1;

const IMMOLATION_REACH: TowerCenteredReach = { margin: 10, base: 66, perLevel: 6 };

// Radius, anchored to the safe radius as a floor (docs/DECISIONS.md #16) —
// same pattern as bladeRadius/frostRadius, carried over unchanged from
// Ward Pulse's WARD_REACH.
export function immolationRadius(lvl: number, perimeter: number): number {
  return towerCenteredRadius(IMMOLATION_REACH, lvl, perimeter);
}

// Prototype formula was `62 + Math.min(24, lvl*2)` — linear across the
// whole 1-8 level range the cap never actually engages (8*2=16 < 24), so
// it's expressed directly as the equivalent base+perLevel form here.
const BLADE_REACH: TowerCenteredReach = { margin: 15, base: 64, perLevel: 2 };

// Orbit radius, anchored to the safe radius as a floor (Confirmed
// docs/DECISIONS.md #16) rather than the prototype's flat
// constant — see "documented prototype bugs" #5 for why that mattered:
// the flat constant made blades unable to hit ambient infection at any
// tier or level, in any run.
export function bladeRadius(lvl: number, perimeter: number): number {
  return towerCenteredRadius(BLADE_REACH, lvl, perimeter);
}

// Single shared library for every weapon's data — upgrades, tiers, and
// tunable variables all live here rather than one file per weapon, so
// balance edits are one file to open. See docs/DECISIONS.md.
export const WEAPON_DEFS: Partial<Record<WeaponKey, WeaponDef>> = {
  bolt: {
    name: 'Bolt Turret',
    icon: '⚡',
    maxLevel: 8,
    desc: (lvl) => `Fires at the nearest wall of infection. Lv${lvl}: ${boltDamage(lvl).toFixed(0)} pwr`,
    coagulantMult: 1,
  },
  blades: {
    name: 'Orbiting Blades',
    icon: '🗡️',
    maxLevel: 8,
    desc: (lvl) => `Spinning blades shred any tissue they touch. Lv${lvl}: ${bladeCount(lvl)} blade(s)`,
    coagulantMult: 1,
  },
  chain: {
    name: 'Chain Bolt',
    icon: '🔗',
    maxLevel: 8,
    desc: (lvl) => `Strikes the wall, then arcs to ${chainCount(lvl)} nearby clusters.`,
    coagulantMult: 1,
  },
  frost: {
    name: 'Frost Nova',
    icon: '❄️',
    maxLevel: 8,
    desc: () => `Pulses outward, damaging tissue and freezing growth nearby.`,
    coagulantMult: 1,
  },
  poison: {
    name: 'Caustic Cloud',
    icon: '☠️',
    maxLevel: 8,
    desc: () => `Drops a lingering cloud that erodes tissue over time.`,
    coagulantMult: 1,
  },
  missile: {
    name: 'Homing Missile',
    icon: '🚀',
    maxLevel: 8,
    desc: () => `Homes onto the nearest wall and explodes.`,
    coagulantMult: 1,
  },
  // Phase 5A (Decision 70): promoted from PASSIVE_DEFS.ward. maxLevel
  // carried over unchanged (6); desc is now level-dependent like every
  // other weapon here, unlike the passive's static string it replaces.
  immolation: {
    name: 'Immolation Ring',
    icon: '🔥',
    maxLevel: 6,
    desc: (lvl) => `Periodically purges a ring around the core. Lv${lvl}: ${immolationDamage(lvl).toFixed(0)} pwr`,
    coagulantMult: 1,
  },
};
