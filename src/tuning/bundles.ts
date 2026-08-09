import type { GemKey } from '../types';

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S8): every N levels
// the normal draw is replaced by a bundle draw — three thematic packages
// instead of four atoms, each granting every gem it holds in one pick.
// Deferred out of 6A-1 deliberately (arsenal plan S11's own reasoning,
// repeated here): six Amplifier gems alone can't form a package worth
// offering — "Amplifier + Overclock" teaches nothing a single card
// doesn't. Twenty gems can.
//
// N starts at 5 — one of the arsenal plan's own named open measurement
// items (S12: "what N is, for the bundle card"), not derived from
// anything. Expected to move once a real level curve exists to tune it
// against, same as every other first-draft constant in this batch.
export const BUNDLE_INTERVAL = 5;

export interface GemBundle {
  readonly name: string;
  readonly gems: readonly GemKey[];
}

// Mirrors the meta layer's own gem bundles (arsenal plan S10) — "a themed
// group of gems arriving together" is one idea the player meets in two
// places, not two. Named so a player recognises the build before reading
// the contents, same bar S10 set for the currency-bought versions.
export const GEM_BUNDLES: readonly GemBundle[] = [
  { name: 'Ballistics Package', gems: ['multishot', 'pierce', 'velocity'] },
  { name: 'Cascade Package', gems: ['chaining', 'fork', 'bounce'] },
  { name: 'Overdrive Package', gems: ['overclock', 'barrage', 'echo'] },
  { name: 'Ordnance Package', gems: ['splash', 'amplifier', 'kickback'] },
  { name: 'Precision Suite', gems: ['priming', 'homing', 'attunement'] },
  { name: 'Doctrine: Formation', gems: ['formation', 'expansion', 'overflow'] },
];
