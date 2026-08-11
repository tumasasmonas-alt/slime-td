// Global growth/simulation knobs. Keep these easy to find and change —
// they are not finalized (see Balance Notes in archive/PROTOTYPE_HANDOFF.md).
// AMBIENT_BASE and CREEP_RAMP both cut ~40% from the Phase 3C playtest
// gate (2026-08-06), then halved again the same day per a second
// playtest ("still overwhelming the core pretty fast" — the first cut
// wasn't enough on its own, with only the starting weapon and no arsenal
// yet to lean on). AMBIENT_ESCALATION below is untouched by either cut —
// this is the base rate the escalation curve multiplies, not the curve
// itself, so the relative ramp shape over a run is preserved.
// 2026-08-10: both raised ~30% — the owner's call, "make the slime
// overall more difficult," part of the same pass as the coagulant
// speed/arrival-damage and event-frequency bumps below. Same knobs,
// same shape, just turned up instead of down this time.
//
// 6D-0 (docs/plans/phase-6d0-balance-shape.md S3): both cut ~10% again —
// the owner's playtest read as "a bit too hard at the start." Ship
// alongside S4's aura reach fix (itself a large early buff) and re-judge
// together rather than cutting the opening twice.
export const AMBIENT_BASE = 0.018;
export const CONTACT_SCALE = 20;

// Floor rate ambient growth creeps at inside the safe zone (damped
// further by proximity to the tower), and the floor the outside ramp
// itself never drops below near the line — see docs/DECISIONS.md #15. Chosen to roughly match the old front-line
// speed at the line itself; a balance-pass knob like AMBIENT_BASE.
export const CREEP_RAMP = 0.032;

// Fixed simulation timestep in seconds, decoupled from render framerate.
export const SIM_TICK = 0.18;

// Ambient infection escalation, decoupled from TIERS_LIST (Decision 33/38
// — see docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md §"the
// perimeter"). This is axis 3 of the five organic escalation axes named
// in the 2026-08-05 session record §15 ("ambient rate — the existing
// lever"); the rework replaces the *tier table* as difficulty mechanism,
// not this curve. Same breakpoints and values the tier table used to
// carry, now driven directly by elapsed time so it survives tiers being
// demoted to flavour.
interface EscalationPoint {
  readonly t: number;
  readonly infectionMult: number;
}

const AMBIENT_ESCALATION: readonly EscalationPoint[] = [
  { t: 0, infectionMult: 1.0 },
  { t: 90, infectionMult: 1.35 },
  { t: 220, infectionMult: 1.8 },
  { t: 380, infectionMult: 2.3 },
  { t: 560, infectionMult: 3.1 },
];

// 6D-0 (docs/plans/phase-6d0-balance-shape.md S2): the breakpoint table
// above used to be the whole curve, and it stops climbing at t=560 while
// player power (levels, gems, extensions) never does — the same mismatch
// the 2026-08-05 playtest measured and that the Phase 5/6 rework absorbed
// without fixing. This factor keeps the table's shape (still exactly what
// the 2026-08-06 playtest tuned, up to t=560) but removes its ceiling:
// every elapsed minute compounds the multiplier by LATE_GROWTH_PER_MINUTE,
// forever. First-draft rate — doubles roughly every 14 minutes.
const LATE_GROWTH_PER_MINUTE = 1.05;

export function ambientInfectionMult(elapsedSeconds: number): number {
  let mult = AMBIENT_ESCALATION[0]!.infectionMult;
  for (const point of AMBIENT_ESCALATION) {
    if (elapsedSeconds >= point.t) mult = point.infectionMult;
  }
  return mult * LATE_GROWTH_PER_MINUTE ** (elapsedSeconds / 60);
}
