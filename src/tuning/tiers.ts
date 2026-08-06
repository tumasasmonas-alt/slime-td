// Risk-of-Rain-style escalating tier names, ported from the prototype's
// TIERS_LIST. Presentation only as of Decision 33 (2026-08-06) — naming,
// announcements, and colour on a time curve, with zero mechanical weight.
// The values that used to live here (safe-radius shrink, contact
// multiplier, ambient infection multiplier, node interval) moved to their
// own owners: the perimeter is fixed (tuning/world.ts, Decision 38),
// ambient escalation is its own curve (tuning/growth.ts, Decision 38),
// contact damage no longer scales on a timer (Decision 24), and nodes are
// deleted (Phase 3A).
export interface Tier {
  readonly name: string;
  readonly t: number;
  readonly color: string;
}

export const TIERS_LIST: readonly Tier[] = [
  { name: 'Simple Infection', t: 0, color: '#8fd17a' },
  { name: 'Localized Outbreak', t: 90, color: '#e0c34d' },
  { name: 'Spreading Epidemic', t: 220, color: '#ff9a3d' },
  { name: 'Full Outbreak', t: 380, color: '#ff5d5d' },
  { name: 'Apocalypse', t: 560, color: '#ff2f56' },
];

export function computeTierIndex(elapsedSeconds: number): number {
  let idx = 0;
  for (let k = 0; k < TIERS_LIST.length; k++) {
    const tier = TIERS_LIST[k];
    if (tier && elapsedSeconds >= tier.t) idx = k;
  }
  return idx;
}
