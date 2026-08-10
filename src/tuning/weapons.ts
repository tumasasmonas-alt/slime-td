import type { DeliveryKind, WeaponKey } from '../types';
import { IDENTITY_MODS, type WeaponMods } from './gems';
import { towerCenteredRadius, type TowerCenteredReach } from './weaponGeometry';

export interface WeaponDef {
  readonly name: string;
  readonly icon: string;
  readonly desc: (lvl: number) => string;
  // Phase 5C (docs/plans/phase-5c-inventory-ui.md S4): a terser readout
  // for the inventory screen's weapon rows — "45 pwr · 0.42s" rather than
  // desc's full sentence. Different jobs: desc is card copy read once,
  // stats is a live number a player watches change as they spend points.
  //
  // Phase 6A-1: `mods` defaults to identity (no gems) so 6-0's pre-run
  // select screen — which calls stats(1) with no socket context, before a
  // run even exists — keeps working unchanged. The inventory screen
  // (ui/weaponRow.ts) is the real caller that passes a live
  // weaponMods(state, key), so a socketed gem's effect on this number is
  // the confirmation the 2026-08-05 "cards appear to do nothing" finding
  // asked for, applied to gems the same way 5C already gave it to points.
  readonly stats: (lvl: number, mods?: WeaponMods) => string;
  // Per-weapon multiplier on damage dealt to coagulants, on top of the
  // overlap-area scaling in grid/clear.ts and the global
  // COAGULANT_DAMAGE_SCALE dial. Defaults to 1 for every weapon here —
  // this is deliberately a hook, not tuned content yet: a natural home
  // for a future Penetration-style support gem, or the enhancement-point
  // "base stat you can level up" the project owner asked to keep room
  // for (2026-08-06 follow-up session).
  readonly coagulantMult: number;
  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S3): what this
  // weapon's effect physically IS, independent of which weapon it is —
  // the axis a support gem reinterprets against. See types.ts's
  // DeliveryKind for the full reasoning.
  readonly delivery: DeliveryKind;
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
// formula. Originally preserved WITHOUT WEAPON_DAMAGE_SCALE, matching Ward
// Pulse's exact prior behaviour, since it never received the Phase 4C-1
// damage pass while classed as a passive.
//
// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S7): fixed —
// the owner's call (roadmap S5 Q3, "fix all three"), the last of
// Immolation's three balance gaps to close. The prior lack of the +50%
// pass was a classification accident (Ward Pulse misfiled as a passive
// when the 4C-1 pass shipped), not a design position, so inheriting it
// forever would have meant defending something nobody chose.
//
// The other two gaps closed for free in 6A-1: this weapon used to be
// flagged as never responding to Overclock/Amplifier, because those were
// GLOBAL passives it was deliberately excluded from. Both are deleted in
// 6A-1, replaced by per-weapon socketed gems — a different, universal
// mechanism every weapon participates in identically
// (weapons/immolation.ts builds on cooldownReady() and reads
// weaponMods() like every other weapon).
export function immolationDamage(lvl: number): number {
  return 10 * lvl * WEAPON_DAMAGE_SCALE;
}

// Fixed, level-independent — matches Ward Pulse's WARD_TICK exactly.
// Now divided by weaponMods(state, 'immolation').rate at the call site
// like every other cooldown-timer weapon (6A-1) — see the note above.
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

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S2.4): first-draft
// numbers, like every other weapon's curves here — balance is not
// gradeable until Phase 8 (CLAUDE.md).
export function shockwaveDamage(lvl: number): number {
  return (12 + (lvl - 1) * 4.5) * WEAPON_DAMAGE_SCALE;
}

export function shockwaveCooldown(lvl: number): number {
  return Math.max(1.4, 3.2 - (lvl - 1) * 0.22);
}

const SHOCKWAVE_REACH: TowerCenteredReach = { margin: 30, base: 150, perLevel: 18 };

// Ring Reach, anchored to the safe radius as a floor like every other
// tower-centered weapon (docs/DECISIONS.md #16) — the ring starts AT this
// floor and expands outward to it, per phase-6c1 S2.3: inward of the
// floor is space nothing has ever occupied.
export function shockwaveReach(lvl: number, perimeter: number): number {
  return towerCenteredRadius(SHOCKWAVE_REACH, lvl, perimeter);
}

// The ring's OWN start — always the raw floor (margin + perimeter), never
// the level-scaled reach above. towerCenteredRadius() returns whichever
// of the two is larger, which is the right answer for "how far can this
// weapon reach" but the wrong one for "where does a ring begin" — S2.3's
// perimeter-floor rule applies to where the ring starts, not to how far
// it can grow.
export function shockwaveStartRadius(perimeter: number): number {
  return SHOCKWAVE_REACH.margin + perimeter;
}

export const SHOCKWAVE_SPEED = 260; // px/s, the ring's own travel speed

// Phase 6C-1 (S4.2): per-submunition damage, deliberately low — the
// weapon's output is the COUNT (fissionCount below), the same principle
// S6 used for Blades' Blade Count.
export function fissionDamage(lvl: number): number {
  return (9 + (lvl - 1) * 3.0) * WEAPON_DAMAGE_SCALE;
}

// Fourth attribute — one of the four weapons in arsenal S6 that earns
// one, because a count is core to this weapon's identity.
export function fissionCount(lvl: number): number {
  return Math.min(3 + Math.floor((lvl - 1) / 1.5), 9);
}

export function fissionBlastRadius(lvl: number): number {
  return 34 + (lvl - 1) * 3;
}

export function fissionScatter(lvl: number): number {
  return 70 + (lvl - 1) * 4;
}

export function fissionCooldown(lvl: number): number {
  return Math.max(1.1, 2.6 - (lvl - 1) * 0.17);
}

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S4.1): first-draft numbers.
// High power, slow cycle — the burst profile the game otherwise lacks.
export function lanceDamage(lvl: number): number {
  return (55 + (lvl - 1) * 22) * WEAPON_DAMAGE_SCALE;
}

// Divided by weaponMods().rate at the call site like every other weapon's
// cooldown — Overclock reads as "charges faster."
export function lanceChargeTime(lvl: number): number {
  return Math.max(1.2, 3.0 - (lvl - 1) * 0.22);
}

export function lanceBeamWidth(lvl: number): number {
  return 16 + (lvl - 1) * 1.6;
}

export const LANCE_RANGE = 520;
// The beam's own duration term (S2.1) — resolves a second time at reduced
// power after this many seconds, independent of Afterglow. Extension's
// `duration` mod scales this window.
export const LANCE_LINGER = 0.35;
export const LANCE_LINGER_MULT = 0.3;

// Single shared library for every weapon's data — upgrades, tiers, and
// tunable variables all live here rather than one file per weapon, so
// balance edits are one file to open. See docs/DECISIONS.md.
export const WEAPON_DEFS: Partial<Record<WeaponKey, WeaponDef>> = {
  bolt: {
    name: 'Bolt Turret',
    icon: '⚡',
    desc: (lvl) => `Fires at the nearest wall of infection. Lv${lvl}: ${boltDamage(lvl).toFixed(0)} pwr`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(boltDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(boltCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'projectile',
  },
  blades: {
    name: 'Orbiting Blades',
    icon: '🗡️',
    desc: (lvl) => `Spinning blades shred any tissue they touch. Lv${lvl}: ${bladeCount(lvl)} blade(s)`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(bladeDamage(lvl) * mods.damage).toFixed(0)} pwr · ${bladeCount(lvl)} blade(s)`,
    coagulantMult: 1,
    delivery: 'orbital',
  },
  chain: {
    name: 'Chain Bolt',
    icon: '🔗',
    desc: (lvl) => `Strikes the wall, then arcs to ${chainCount(lvl)} nearby clusters.`,
    stats: (lvl, mods = IDENTITY_MODS) =>
      `${(chainDamage(lvl) * mods.damage).toFixed(0)} pwr · ${chainCount(lvl)} forks · ${(chainCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'projectile',
  },
  frost: {
    name: 'Frost Nova',
    icon: '❄️',
    desc: () => `Pulses outward, damaging tissue and freezing growth nearby.`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(frostDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(frostCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'pulse',
  },
  poison: {
    name: 'Caustic Cloud',
    icon: '☠️',
    desc: () => `Drops a lingering cloud that erodes tissue over time.`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(poisonDamage(lvl) * mods.damage).toFixed(0)} pwr/s · ${(poisonCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'cloud',
  },
  missile: {
    name: 'Homing Missile',
    icon: '🚀',
    desc: () => `Homes onto the nearest wall and explodes.`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(missileDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(missileCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'projectile',
  },
  // Phase 5A (Decision 70): promoted from PASSIVE_DEFS.ward. desc is now
  // level-dependent like every other weapon here, unlike the passive's
  // static string it replaces. Phase 6B-1: the dead `maxLevel` field (this
  // weapon's own was inconsistently 6 against every other weapon's 8) is
  // deleted from WeaponDef entirely — arsenal plan S6 retired weapon-level
  // caps outright and nothing had read it since 5B.
  immolation: {
    name: 'Immolation Ring',
    icon: '🔥',
    desc: (lvl) => `Periodically purges a ring around the core. Lv${lvl}: ${immolationDamage(lvl).toFixed(0)} pwr`,
    stats: (lvl, mods = IDENTITY_MODS) => `${(immolationDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(IMMOLATION_TICK / mods.rate).toFixed(1)}s`,
    coagulantMult: 1,
    delivery: 'ring',
  },
  // Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md).
  shockwave: {
    name: 'Shockwave',
    icon: '🌊',
    desc: (lvl) => `A ring travels outward from the core, damaging everything it passes through. Lv${lvl}: ${shockwaveDamage(lvl).toFixed(0)} pwr`,
    stats: (lvl, mods = IDENTITY_MODS) =>
      `${(shockwaveDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(shockwaveCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'pulse',
  },
  fission: {
    name: 'Fission Charge',
    icon: '🎇',
    desc: (lvl) => `Lobs a charge that bursts into ${fissionCount(lvl)} submunitions scattered across an area.`,
    stats: (lvl, mods = IDENTITY_MODS) =>
      `${(fissionDamage(lvl) * mods.damage).toFixed(0)} pwr · ${fissionCount(lvl)} submunitions · ${(fissionCooldown(lvl) / mods.rate).toFixed(2)}s`,
    coagulantMult: 1,
    delivery: 'projectile',
  },
  // Phase 6C-2 (docs/plans/phase-6c2-lance.md).
  lance: {
    name: 'Lance',
    icon: '🔆',
    desc: (lvl) => `Charges, then fires one piercing beam at the largest threat in range. Lv${lvl}: ${lanceDamage(lvl).toFixed(0)} pwr`,
    stats: (lvl, mods = IDENTITY_MODS) =>
      `${(lanceDamage(lvl) * mods.damage).toFixed(0)} pwr · ${(lanceChargeTime(lvl) / mods.rate).toFixed(2)}s charge`,
    coagulantMult: 1,
    delivery: 'beam',
  },
};
