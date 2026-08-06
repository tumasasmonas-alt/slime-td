// Deliberately close to linear so the ~8-tier weapon progression paces out
// across most of a run instead of front- or back-loading. See Balance
// Notes in archive/PROTOTYPE_HANDOFF.md.
export function xpToNext(level: number): number {
  return Math.round(12 + level * 6.5);
}

// Gems drop when a single hit clears enough density; value scales with how
// much was actually removed. Uncapped — Decision 31's XP change ("remove
// the clamp(…, 0, 10) value cap") pulled forward from Phase 3D into 3C,
// since coagulant kills route through this same function and reading the
// 3C playtest gate through a broken reward economy (a 20-second behemoth
// kill paying the same as a routine bolt hit) would actively mislead it.
// The rest of Decision 31 — the superlinear level curve, gem showers on
// big removals, the risk premium on horde kills — stays in Phase 3D.
export function gemValueFromRemoved(removed: number): number {
  return Math.max(0, Math.round(removed * 1.3));
}
