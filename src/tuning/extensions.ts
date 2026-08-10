import type { GemModDelta } from './gems';
import type { WeaponKey } from '../types';

// Phase 6B (docs/plans/phase-6b-incumbent-extensions.md S5,
// docs/plans/phase-6b2-extension-content.md): the real per-weapon
// catalogue, replacing 5B/6A's single 'placeholder' Prototype Mount.
// `ExtensionInstance.kind` (state.ts) narrows from `string` to this union
// — the same narrowing 6A-1 did to `GemInstance.kind` once Phase 6A
// populated a real one.
//
// Four extensions ship per weapon (arsenal plan S7's own tables list four
// candidates each; this supersedes S12's "3 ship" call — settled by the
// owner 2026-08-10, docs/plans/phase-6b-incumbent-extensions.md S8 Q4).
// Keys are globally unique rather than namespaced per weapon, keeping
// systems/cards.ts's `findOwnedExtension`'s (weaponKey, kind) lookup
// unchanged and making one flat EXTENSION_DEFS record possible.
export type ExtensionKey =
  // Bolt Turret
  | 'heavySlug'
  | 'twinBarrel'
  | 'overcharge'
  | 'trackingRounds'
  // Orbiting Blades
  | 'counterRotation'
  | 'serration'
  | 'bladestorm'
  | 'whirl'
  // Chain Bolt
  | 'staticBuildup'
  | 'backlash'
  | 'conductive'
  | 'splitArc'
  // Frost Nova
  | 'chillField'
  | 'shatterCore'
  | 'rime'
  | 'frostDuration'
  // Caustic Cloud
  | 'corrosive'
  | 'lingeringSpores'
  | 'twinCanister'
  | 'cloudRadius'
  // Homing Missile
  | 'bunkerBuster'
  | 'proximityFuse'
  | 'clusterWarhead'
  | 'salvo'
  // Immolation Ring
  | 'backdraft'
  | 'secondRing'
  | 'flare'
  | 'ash'
  // Shockwave (Phase 6C-1, docs/plans/phase-6c1-shockwave-fission.md S5).
  // 'secondWave' is deliberately distinct from Immolation's shipped
  // 'secondRing' key; 'knockback' does not collide with the Kickback GEM
  // (a separate union, GemKey, spelled 'kickback') — both checked against
  // the full shipped-key list per the plan's Finding 4 discipline.
  | 'secondWave'
  | 'knockback'
  | 'resonantRing'
  | 'implosion'
  // Fission Charge (Phase 6C-1 S5)
  | 'widerScatter'
  | 'chainFission'
  | 'sticky'
  | 'focusedPattern'
  // Lance (Phase 6C-2, docs/plans/phase-6c2-lance.md S6). 'lanceOvercharge'
  // is a forced rename off Bolt's already-shipped 'overcharge' — genuinely
  // different mechanics (Bolt: every 5th shot triples; Lance: longer
  // charge, superlinear power), displayed as "Long Charge."
  | 'piercingCore'
  | 'twinLance'
  | 'afterglow'
  | 'lanceOvercharge';

export const EXTENSION_MAX_LEVEL = 3;

export interface ExtensionDef {
  readonly weaponKey: WeaponKey;
  readonly name: string;
  readonly icon: string;
  readonly desc: (level: 1 | 2 | 3) => string;
  // Phase 6B-1 S5.2: extensions that are pure multipliers declare their
  // effect here and need no per-weapon code at all — systems/extensions.ts's
  // extensionMods() sums these into weaponMods() exactly the way
  // AMPLIFIER_GEM_DEFS' delta() already does. Extensions with behaviour
  // rather than numbers (most of them) leave this undefined and are read
  // by name inside their own weapon's module via extensionLevel().
  readonly mods?: (level: 1 | 2 | 3) => GemModDelta;
}

export const EXTENSION_DEFS: Readonly<Record<ExtensionKey, ExtensionDef>> = {
  // ---- Bolt Turret ⚡ ----
  heavySlug: {
    weaponKey: 'bolt',
    name: 'Heavy Slug',
    icon: '🔩',
    desc: (lvl) => [`+45% damage, −25% fire rate.`, `+70% damage, −30% fire rate.`, `+100% damage, −35% fire rate.`][lvl - 1]!,
    mods: (lvl) => ({ damage: [0.45, 0.7, 1.0][lvl - 1], rate: [-0.25, -0.3, -0.35][lvl - 1] }),
  },
  twinBarrel: {
    weaponKey: 'bolt',
    name: 'Twin Barrel',
    icon: '🎯',
    desc: (lvl) => `A second bolt fires from an offset barrel, at ${[40, 60, 80][lvl - 1]}% power.`,
  },
  overcharge: {
    weaponKey: 'bolt',
    name: 'Overcharge',
    icon: '⚡',
    desc: (lvl) => `Every 5th shot deals ×${[2.5, 3, 3.5][lvl - 1]}.`,
  },
  trackingRounds: {
    weaponKey: 'bolt',
    name: 'Tracking Rounds',
    icon: '🧭',
    desc: (lvl) => `Bolts re-acquire the nearest threat mid-flight, turning at ${[60, 90, 120][lvl - 1]}°/s.`,
  },

  // ---- Orbiting Blades 🗡️ ----
  counterRotation: {
    weaponKey: 'blades',
    name: 'Counter-Rotation',
    icon: '🌀',
    desc: (lvl) => `${['+1', '+1', '+2'][lvl - 1]} blade(s) on a second ring, spinning the other way at 1.25× radius.`,
  },
  serration: {
    weaponKey: 'blades',
    name: 'Serration',
    icon: '🔪',
    desc: (lvl) => `Consecutive hits by the same blade ramp +${[12, 18, 25][lvl - 1]}% each, capped at ×2. Resets on a miss.`,
  },
  bladestorm: {
    weaponKey: 'blades',
    name: 'Bladestorm',
    icon: '💫',
    desc: (lvl) => `Orbit speed ×${[1.6, 1.9, 2.2][lvl - 1]} for 2s after any coagulant dies.`,
  },
  whirl: {
    weaponKey: 'blades',
    name: 'Whirl',
    icon: '🌪️',
    desc: (lvl) => `A landed hit flares that blade's reach +${[25, 35, 45][lvl - 1]}% for 0.3s.`,
  },

  // ---- Chain Bolt 🔗 ----
  staticBuildup: {
    weaponKey: 'chain',
    name: 'Static Buildup',
    icon: '⚡',
    desc: (lvl) => `Per-hop damage grows ×${[1.15, 1.25, 1.35][lvl - 1]} instead of decaying.`,
  },
  backlash: {
    weaponKey: 'chain',
    name: 'Backlash',
    icon: '💥',
    desc: (lvl) => `The final hop deals ×${[2, 2.5, 3][lvl - 1]}.`,
  },
  conductive: {
    weaponKey: 'chain',
    name: 'Conductive',
    icon: '🧲',
    desc: (lvl) => `Hop selection weights denser cells ×${[1.5, 2, 2.5][lvl - 1]}.`,
  },
  splitArc: {
    weaponKey: 'chain',
    name: 'Split Arc',
    icon: '🌿',
    desc: (lvl) => `The 2nd hop also spawns a branch carrying the remaining hops at ${[50, 65, 80][lvl - 1]}% power.`,
  },

  // ---- Frost Nova ❄️ ----
  chillField: {
    weaponKey: 'frost',
    name: 'Chill Field',
    icon: '🧊',
    desc: (lvl) => `A persistent aura at the nova's own radius refreezes cells for ${[0.4, 0.6, 0.8][lvl - 1]}s.`,
  },
  shatterCore: {
    weaponKey: 'frost',
    name: 'Shatter Core',
    icon: '💎',
    desc: (lvl) => `Frost now chills coagulants; a chilled one takes +${[30, 45, 60][lvl - 1]}% damage from any source.`,
  },
  rime: {
    weaponKey: 'frost',
    name: 'Rime',
    icon: '🥶',
    desc: (lvl) => `Cells regrow at ${[50, 35, 20][lvl - 1]}% rate for 3s after a freeze ends.`,
  },
  frostDuration: {
    weaponKey: 'frost',
    name: 'Freeze Duration',
    icon: '⏳',
    desc: (lvl) => `+${[35, 55, 75][lvl - 1]}% freeze duration.`,
    mods: (lvl) => ({ duration: [0.35, 0.55, 0.75][lvl - 1] }),
  },

  // ---- Caustic Cloud ☠️ ----
  corrosive: {
    weaponKey: 'poison',
    name: 'Corrosive',
    icon: '🧪',
    desc: (lvl) => `Coagulants inside lose ${[30, 45, 60][lvl - 1]}% of their armour, for 2s after leaving.`,
  },
  lingeringSpores: {
    weaponKey: 'poison',
    name: 'Lingering Spores',
    icon: '🍃',
    desc: (lvl) => `The cloud drifts outward at ${[12, 18, 24][lvl - 1]}px/s and lives +${[20, 30, 40][lvl - 1]}% longer.`,
    mods: (lvl) => ({ duration: [0.2, 0.3, 0.4][lvl - 1] }),
  },
  twinCanister: {
    weaponKey: 'poison',
    name: 'Twin Canister',
    icon: '🧫',
    desc: () => `A second canister lands offset, carrying a smaller, longer-lived cloud.`,
  },
  cloudRadius: {
    weaponKey: 'poison',
    name: 'Cloud Radius',
    icon: '📐',
    desc: (lvl) => `+${[25, 40, 55][lvl - 1]}% radius.`,
    mods: (lvl) => ({ area: [0.25, 0.4, 0.55][lvl - 1] }),
  },

  // ---- Homing Missile 🚀 ----
  bunkerBuster: {
    weaponKey: 'missile',
    name: 'Bunker Buster',
    icon: '🏗️',
    desc: (lvl) => `+${[8, 12, 16][lvl - 1]}% damage per point of the target's armour.`,
  },
  proximityFuse: {
    weaponKey: 'missile',
    name: 'Proximity Fuse',
    icon: '📡',
    desc: (lvl) => `Detonates on approaching within ${[35, 50, 65][lvl - 1]}px of a coagulant.`,
  },
  clusterWarhead: {
    weaponKey: 'missile',
    name: 'Cluster Warhead',
    icon: '☄️',
    desc: (lvl) => `Detonation spawns ${[3, 4, 5][lvl - 1]} submunitions at 25% power.`,
  },
  salvo: {
    weaponKey: 'missile',
    name: 'Salvo',
    icon: '🚀',
    desc: (lvl) => `${['+1', '+1', '+2'][lvl - 1]} missile(s), sequenced over 0.4s.`,
  },

  // ---- Immolation Ring 🔥 ----
  backdraft: {
    weaponKey: 'immolation',
    name: 'Backdraft',
    icon: '🔥',
    desc: (lvl) => `Damage scales with the mass currently crossing the ring, up to ×${(1 + [0.3, 0.45, 0.6][lvl - 1]!).toFixed(2)}.`,
  },
  secondRing: {
    weaponKey: 'immolation',
    name: 'Second Ring',
    icon: '⭕',
    desc: (lvl) => `A second concentric ring at 1.4× radius, at ${[60, 75, 90][lvl - 1]}% power.`,
  },
  flare: {
    weaponKey: 'immolation',
    name: 'Flare',
    icon: '✨',
    desc: (lvl) => `Every 4th tick, an outward pulse at 1.8× radius and ${[70, 85, 100][lvl - 1]}% power.`,
  },
  ash: {
    weaponKey: 'immolation',
    name: 'Ash',
    icon: '🌫️',
    desc: (lvl) => `Cells the ring burns regrow at ${[60, 45, 30][lvl - 1]}% rate for 2s.`,
  },

  // ---- Shockwave 🌊 (Phase 6C-1) ----
  secondWave: {
    weaponKey: 'shockwave',
    name: 'Second Wave',
    icon: '〰️',
    desc: (lvl) => `A second ring follows ${[0.35, 0.3, 0.25][lvl - 1]}s behind, at ${[55, 70, 85][lvl - 1]}% power.`,
  },
  knockback: {
    weaponKey: 'shockwave',
    name: 'Knockback',
    icon: '💨',
    desc: (lvl) => `The ring shoves coagulants ${[20, 32, 46][lvl - 1]}px outward as it passes.`,
  },
  resonantRing: {
    weaponKey: 'shockwave',
    name: 'Resonant Ring',
    icon: '📶',
    desc: (lvl) => `Damage scales with the density the ring crosses, up to ×${(1 + [0.4, 0.65, 0.9][lvl - 1]!).toFixed(2)}.`,
  },
  implosion: {
    weaponKey: 'shockwave',
    name: 'Implosion',
    icon: '🌀',
    desc: (lvl) => `The ring instead travels inward from max reach, at ${[110, 125, 140][lvl - 1]}% power.`,
  },

  // ---- Fission Charge 🎇 (Phase 6C-1) ----
  widerScatter: {
    weaponKey: 'fission',
    name: 'Wider Scatter',
    icon: '📐',
    desc: (lvl) => `+${[30, 45, 60][lvl - 1]}% scatter radius.`,
    mods: (lvl) => ({ area: [0.3, 0.45, 0.6][lvl - 1] }),
  },
  chainFission: {
    weaponKey: 'fission',
    name: 'Chain Fission',
    icon: '💠',
    desc: (lvl) => `Submunitions split once more on impact, ${[1, 2, 2][lvl - 1]} child(ren) each at 50% power.`,
  },
  sticky: {
    weaponKey: 'fission',
    name: 'Sticky',
    icon: '🔥',
    desc: (lvl) => `Submunitions leave a burning patch, ${[6, 9, 12][lvl - 1]} pwr/s for 2s.`,
  },
  focusedPattern: {
    weaponKey: 'fission',
    name: 'Focused Pattern',
    icon: '🎯',
    desc: (lvl) => `−${[45, 60, 75][lvl - 1]}% scatter radius — a tight cluster instead of a spread.`,
    mods: (lvl) => ({ area: [-0.45, -0.6, -0.75][lvl - 1] }),
  },

  // ---- Lance 🔆 (Phase 6C-2) ----
  piercingCore: {
    weaponKey: 'lance',
    name: 'Piercing Core',
    icon: '🩻',
    desc: (lvl) => `Ignores armour entirely, up to ${[40, 60, 80][lvl - 1]} points.`,
  },
  twinLance: {
    weaponKey: 'lance',
    name: 'Twin Lance',
    icon: '➰',
    desc: (lvl) => `A second beam fires at a slight angle, at ${[55, 70, 85][lvl - 1]}% power.`,
  },
  afterglow: {
    weaponKey: 'lance',
    name: 'Afterglow',
    icon: '🌅',
    desc: (lvl) => `The line stays hot ${[0.6, 1.1, 1.7][lvl - 1]}s longer and suppresses regrowth along it.`,
  },
  lanceOvercharge: {
    weaponKey: 'lance',
    name: 'Long Charge',
    icon: '🔋',
    desc: (lvl) => `+${[45, 70, 100][lvl - 1]}% charge time, for ×${[1.7, 2.1, 2.6][lvl - 1]} power.`,
  },
};

export const EXTENSIONS_BY_WEAPON: Readonly<Record<WeaponKey, readonly ExtensionKey[]>> = (() => {
  const byWeapon: Partial<Record<WeaponKey, ExtensionKey[]>> = {};
  for (const key of Object.keys(EXTENSION_DEFS) as ExtensionKey[]) {
    const weaponKey = EXTENSION_DEFS[key].weaponKey;
    (byWeapon[weaponKey] ??= []).push(key);
  }
  return byWeapon as Record<WeaponKey, readonly ExtensionKey[]>;
})();

export function extensionName(kind: ExtensionKey): string {
  return EXTENSION_DEFS[kind].name;
}

export function extensionIcon(kind: ExtensionKey): string {
  return EXTENSION_DEFS[kind].icon;
}

export function extensionDesc(kind: ExtensionKey, level: 1 | 2 | 3): string {
  return EXTENSION_DEFS[kind].desc(level);
}
