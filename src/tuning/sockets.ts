// Phase 5B (docs/plans/phase-5b-framework.md S2): sockets open on enhancement
// investment rather than a fixed count per weapon. A pure function, kept in
// its own file specifically so retuning the ladder at the Phase 5 gate is a
// one-line edit rather than a hunt through the socketing logic.
const SOCKET_THRESHOLDS = [0, 3, 8, 15, 24] as const;

export function socketCount(pointsInvested: number): number {
  let count = 1;
  for (let i = 1; i < SOCKET_THRESHOLDS.length; i++) {
    if (pointsInvested >= SOCKET_THRESHOLDS[i]!) count++;
  }
  return count;
}
