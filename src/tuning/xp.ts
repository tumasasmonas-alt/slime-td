// Phase 3D (Decision 31/61): the lever for pacing level-ups is how much XP
// a level *costs*, not how much a hit *grants* — granted XP must stay
// honest to destroyed mass or the anti-farming argument in Decision 31
// collapses. Quadratic rather than linear so early levels barely move
// (close to the old linear curve) while late levels bend hard, the same
// shape most other games use to keep a run's opening pace while making
// deep runs cost real time. Not finalized — see Balance Notes in
// archive/PROTOTYPE_HANDOFF.md and the Phase 8 balance pass.
const XP_BASE = 12;
const XP_LINEAR = 6.5;
const XP_QUADRATIC = 0.45;

export function xpToNext(level: number): number {
  return Math.round(XP_BASE + XP_LINEAR * level + XP_QUADRATIC * level * level);
}

// Gems drop when a single hit clears enough density; value scales with how
// much was actually removed. Uncapped — Decision 31's XP change ("remove
// the clamp(…, 0, 10) value cap") pulled forward from Phase 3D into 3C,
// since coagulant kills route through this same function and reading the
// 3C playtest gate through a broken reward economy (a 20-second behemoth
// kill paying the same as a routine bolt hit) would actively mislead it.
export function gemValueFromRemoved(removed: number): number {
  return Math.max(0, Math.round(removed * 1.3));
}

// Rule 3's "risk premium" (Decision 31/61) — a horde kill pays a little
// more than the same mass removed loose in the field, since it was
// actively trying to kill you. Applied only to the coagulant portion of a
// clearAt() call's totalRemoved, never the grid portion — see
// grid/clear.ts. Kept deliberately low (15%, the project owner's call,
// below the 25-50% range Decision 31 originally floated) since the trap
// Decision 31 exists to avoid — neglecting the field becomes an XP
// strategy — gets worse the higher this goes.
export const COAGULANT_XP_RISK_PREMIUM = 0.15;

// A single clearAt() call drops one gem below this value; above it, the
// XP fans out into a shower instead — otherwise a single behemoth kill
// dumps its entire, now-large XP value into one pickup that arrives at
// the core in one instant, crossing several level-up thresholds at once
// and stacking three modal upgrade-card screens back to back. See
// systems/gems.ts's dropGemShower.
export const GEM_SHOWER_UNIT = 8;
// Hard cap on gems in one shower — a huge behemoth kill still resolves to
// a finite, cheap number of particles rather than scaling with mass.
export const GEM_SHOWER_MAX_COUNT = 12;
