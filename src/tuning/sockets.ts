// Phase 5B (docs/plans/phase-5b-framework.md S2): sockets open on enhancement
// investment rather than a fixed count per weapon. Pure functions, kept in
// their own file specifically so retuning either ladder at the Phase 5 gate
// is a one-line edit rather than a hunt through the socketing logic.
//
// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2): extensions
// and gems used to share one combined count here (arsenal plan S5). The
// owner reversed that — restoring Decision 32's original "per-weapon
// extension slots" — so there are now two independent ladders. Renamed
// socketCount -> gemSocketCount (unchanged thresholds/values) so the two
// don't read as accidentally identical.
const GEM_SOCKET_THRESHOLDS = [0, 3, 8, 15, 24] as const;

export function gemSocketCount(pointsInvested: number): number {
  let count = 1;
  for (let i = 1; i < GEM_SOCKET_THRESHOLDS.length; i++) {
    if (pointsInvested >= GEM_SOCKET_THRESHOLDS[i]!) count++;
  }
  return count;
}

// The owner's own sub-proposal (docs/plans/phase-6b-incumbent-extensions.md
// S8 Q5): no extension slot below 5 points invested, one at 5-9, two at
// 10+. Keeps "points buy depth" as the single legible rule across both
// ladders — an extension card simply banks until a weapon is invested in,
// which 6A-3's banking already handles.
const EXTENSION_SLOT_THRESHOLDS = [5, 10] as const;
export const EXTENSION_SLOT_CAP = EXTENSION_SLOT_THRESHOLDS.length;

export function extensionSlotCount(pointsInvested: number): number {
  let count = 0;
  for (const threshold of EXTENSION_SLOT_THRESHOLDS) {
    if (pointsInvested >= threshold) count++;
  }
  return count;
}
