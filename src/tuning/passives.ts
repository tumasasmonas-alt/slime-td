import type { PassiveKey } from '../types';

// Display metadata for the upgrade-card system. The numeric effect of each
// passive (rate per level, caps) belongs with the system that applies it —
// see systems/passives.ts once that exists in Phase 2 — rather than here,
// since the shape of that formula differs per passive (flat additive vs.
// multiplicative vs. periodic-trigger) and guessing it now would likely be
// wrong.
export interface PassiveDef {
  readonly name: string;
  readonly icon: string;
  readonly maxLevel: number;
  readonly desc: string;
}

export const PASSIVE_DEFS: Readonly<Record<PassiveKey, PassiveDef>> = {
  maxHp: { name: 'Vitality', icon: '❤️', maxLevel: 8, desc: '+20 max core integrity, heals on pickup.' },
  regen: { name: 'Regeneration', icon: '💧', maxLevel: 8, desc: '+0.3 integrity regen per second.' },
  armor: { name: 'Armor Plating', icon: '🛡️', maxLevel: 6, desc: '-7% damage taken from contact.' },
  atkSpeed: { name: 'Overclock', icon: '⏱️', maxLevel: 8, desc: '+9% attack speed, all weapons.' },
  damage: { name: 'Amplifier', icon: '💥', maxLevel: 8, desc: '+10% damage, all weapons.' },
  pickup: { name: 'Magnetism', icon: '🧲', maxLevel: 6, desc: 'Gems drift toward the core faster.' },
  xpGain: { name: 'Insight', icon: '📖', maxLevel: 6, desc: '+14% experience gained.' },
};
