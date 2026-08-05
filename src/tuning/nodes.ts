// Growth-node formulas, scaled by the current difficulty tier index.
// Kept easy to find and change — not finalized, see Balance Notes in
// archive/PROTOTYPE_HANDOFF.md.
export function nodeHp(tierIndex: number): number {
  return 220 * (1 + 0.35 * tierIndex);
}

export function nodeRadius(tierIndex: number): number {
  return 95 + tierIndex * 10;
}

export function nodeStrength(tierIndex: number): number {
  return 0.55 + tierIndex * 0.08;
}

export const NODE_HIT_RADIUS = 16;

export function nodeXpValue(tierIndex: number): number {
  return 45 + tierIndex * 12;
}
