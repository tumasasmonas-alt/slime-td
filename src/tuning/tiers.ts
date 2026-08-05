// Risk-of-Rain-style escalating difficulty tiers. Ported from the
// prototype's TIERS_LIST. See docs/BACKLOG.md: this plateaus after
// the last tier — an endless-scaling tail is a known TODO, not yet built.
//
// safeRadius deliberately deviates from the prototype (which used
// 190/170/145/120/95). Ambient growth is hard-gated inside safeRadius, so
// those values left the infection stopping at a distant ring it could
// never cross — no sense of it closing in, and every tower-centered
// weapon stranded in a dead zone it could never shoot out of. See
// docs/DECISIONS.md.
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
  { name: 'Simple Infection', t: 0, infectionMult: 1.0, nodeInterval: 30, safeRadius: 100, contactMult: 1.0, color: '#8fd17a' },
  { name: 'Localized Outbreak', t: 90, infectionMult: 1.35, nodeInterval: 24, safeRadius: 85, contactMult: 1.2, color: '#e0c34d' },
  { name: 'Spreading Epidemic', t: 220, infectionMult: 1.8, nodeInterval: 19, safeRadius: 70, contactMult: 1.4, color: '#ff9a3d' },
  { name: 'Full Outbreak', t: 380, infectionMult: 2.3, nodeInterval: 15, safeRadius: 58, contactMult: 1.7, color: '#ff5d5d' },
  { name: 'Apocalypse', t: 560, infectionMult: 3.1, nodeInterval: 11, safeRadius: 45, contactMult: 2.1, color: '#ff2f56' },
];

export function computeTierIndex(elapsedSeconds: number): number {
  let idx = 0;
  for (let k = 0; k < TIERS_LIST.length; k++) {
    const tier = TIERS_LIST[k];
    if (tier && elapsedSeconds >= tier.t) idx = k;
  }
  return idx;
}
