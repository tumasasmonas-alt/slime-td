// Risk-of-Rain-style escalating difficulty tiers. Direct port of the
// prototype's TIERS_LIST. See docs/KNOWN_ISSUES.md: this plateaus after
// the last tier — an endless-scaling tail is a known TODO, not yet built.
export interface Tier {
  readonly name: string;
  readonly t: number;
  readonly infectionMult: number;
  readonly nodeInterval: number;
  readonly safeRadius: number;
  readonly contactMult: number;
  readonly color: string;
}

export const TIERS_LIST: readonly Tier[] = [
  { name: 'Simple Infection', t: 0, infectionMult: 1.0, nodeInterval: 30, safeRadius: 190, contactMult: 1.0, color: '#8fd17a' },
  { name: 'Localized Outbreak', t: 90, infectionMult: 1.35, nodeInterval: 24, safeRadius: 170, contactMult: 1.2, color: '#e0c34d' },
  { name: 'Spreading Epidemic', t: 220, infectionMult: 1.8, nodeInterval: 19, safeRadius: 145, contactMult: 1.4, color: '#ff9a3d' },
  { name: 'Full Outbreak', t: 380, infectionMult: 2.3, nodeInterval: 15, safeRadius: 120, contactMult: 1.7, color: '#ff5d5d' },
  { name: 'Apocalypse', t: 560, infectionMult: 3.1, nodeInterval: 11, safeRadius: 95, contactMult: 2.1, color: '#ff2f56' },
];

export function computeTierIndex(elapsedSeconds: number): number {
  let idx = 0;
  for (let k = 0; k < TIERS_LIST.length; k++) {
    const tier = TIERS_LIST[k];
    if (tier && elapsedSeconds >= tier.t) idx = k;
  }
  return idx;
}
