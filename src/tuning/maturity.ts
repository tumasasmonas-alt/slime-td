import { clamp } from '../util/math';

// Phase 4A (Decision 25/63): quality of ground, decoupled from `growth`'s
// quantity. "The battlefield hardens, the wilderness stays soft" — §7 of
// docs/sessions/2026-08-05-slime-and-arsenal-rework.md. Numbers here are
// deliberately gentle, not finalized: the designed counters (penetration,
// range upgrades) don't exist until Phase 5, so in 4A the player's only
// answer to their own scar ring is raw DPS. Better to ship subtle and
// crank it at the Phase 4C gate than to ship oppressive with no
// counterplay available yet. See docs/plans/phase-4a-maturity.md.

export const MATURITY_MAX = 1.0;

// How much maturity a cell gains per unit of density `clearAt` removes
// from it — "you scar what you clear." Rides the grid loop clearAt
// already runs; no new pass.
//
// Retuned 2026-08-07 (0.06 -> 0.15) alongside MATURITY_DECAY below, after
// a debug-harness verification (Decision 59's methodology) found the
// mechanic produced literally zero visible scarring under any tested
// loadout, weak or maxed — see MATURITY_DECAY's comment for the full
// diagnosis. This alone wasn't the fix; paired with the decay change.
export const SCAR_PER_DENSITY = 0.15;

// The slow global age drift (§7's "capped low ceiling, so the wilderness
// is not visually static, but can never approach a calcified wall by
// construction"). Expressed as a floor rather than a per-cell gain — see
// ageFloorAt() below for why.
export const AGE_CEILING = 0.33;
export const AGE_RATE = 0.0009; // per second; ~6 minutes to reach the ceiling

// Passive decay toward the age floor when a cell isn't being hit — what
// lets a relocated front's old scar ring heal (Decision 25: maturity is
// consumed by nobody, only ever decays).
//
// Retuned 2026-08-07, down from 0.01 (~10x) — found broken via the same
// debug-harness methodology as Decision 59. At 0.01/s a single hit's scar
// gain (removedHere * SCAR_PER_DENSITY, typically a few hundredths) decays
// back to the floor within single-digit *seconds* of the cell going quiet,
// which it does almost immediately once cleared: a cleared cell drops
// below `threshold` and is no longer a valid frontier target, so nothing
// fires at it again until ambient regrowth — deliberately slowed twice
// already for pacing (Decision 57) — pushes it back into range. Verified
// live: a max-weapons 400s run and a weak-weapons 53s-to-death run both
// produced maximum grid-wide maturity *exactly equal to the age floor* —
// zero scarring survived anywhere, in either direction. This is what "slow
// passive decay when a cell is not being hit" (§7) actually has to mean:
// slow enough that a genuine lull, not a few seconds between hits, is what
// erodes a scar. At this rate a fully-matured cell takes ~11 minutes to
// decay back to the floor, matching the timescale runs actually run on
// rather than the timescale of one weapon's cooldown.
export const MATURITY_DECAY = 0.0015; // per second; ~11 min from full to the age floor

// Maturity reduces how much a hit removes (never how much power is spent),
// floored so nothing is ever unclearable — Decision 44's guarantee restated
// for terrain rather than coagulant armor.
export const MATURITY_TOUGHNESS = 0.5;
export const MATURITY_YIELD_FLOOR = 0.4;

// How full a cell gets, as a fraction of its *headroom above its own
// threshold* — NOT as an absolute density. Virgin ground stays a little
// short of full because it's undisturbed and has no reason to harden into
// anything; scarred ground earns the full ceiling.
//
// The threshold-relative framing is load-bearing, not stylistic. The first
// implementation used absolute density (0.85 virgin / 1.0 mature) and that
// was a serious regression, caught in the project owner's playtest and then
// measured directly: `grid.threshold` runs up to 0.94 (grid.ts clamps
// `1 - vein` to [0.045, 0.94]), and `cellBucket` renders nothing at all
// while `growth <= threshold`. An absolute 0.85 virgin ceiling therefore
// made **22.3% of the arena — 2,876 cells — permanently invisible**, since
// ambient growth could never push them past their own reveal threshold.
// That is exactly the "top left area all black, slime never filled it"
// the playtest reported.
//
// Expressed as a fraction of headroom, any value above 0 guarantees
// `ceiling > threshold` for every cell, so the map always fills — the
// failure mode is impossible by construction rather than avoided by
// picking a lucky number.
//
// 0.75 rather than something higher because cellBucket quantizes to 5
// steps over that same headroom: at 0.8+ a virgin cell would land in the
// top bucket anyway and the whole mechanic would be visually inert. At
// 0.75 virgin ground caps one bucket short of scarred ground, which is
// the visible difference §6's two-axis table asks for.
export const CEILING_VIRGIN_FRAC = 0.75;
export const CEILING_MATURE_FRAC = 1.0;

// Ambient regrowth is also slower on mature ground — a durability threat,
// not a speed threat (§7: speeding up the kill zone would be unfair, since
// it's the one place the player is forced to fight).
export const REGROWTH_SLOWDOWN = 0.5;

// Infection Events (vein/bloom) inject at full density regardless of
// maturity — the project owner's call, 2026-08-07: events bring
// full-thickness slime, reinforcing veins as the mass pump (Decision 28)
// rather than being softened by the same ceiling ambient growth respects.
// See systems/events.ts's injectAt — deliberately NOT reading maturity.

// §6's "4 maturity steps" — also forced by performance, not just visual
// intent: maturity decays every cell every tick, so gating the dirty set on
// raw float change would mark the whole grid dirty every tick.
export const MATURITY_BUCKETS = 4;

// The density ambient growth converges toward for a cell, given its own
// reveal threshold. Always strictly above `threshold` (for any positive
// CEILING_VIRGIN_FRAC), so no cell can ever be rendered permanently
// invisible — see CEILING_VIRGIN_FRAC's comment for the regression this
// shape exists to make impossible.
export function growthCeiling(maturity: number, threshold: number): number {
  const frac =
    CEILING_VIRGIN_FRAC + (CEILING_MATURE_FRAC - CEILING_VIRGIN_FRAC) * clamp(maturity / MATURITY_MAX, 0, 1);
  const t = clamp(threshold, 0, 1);
  return t + (1 - t) * frac;
}

export function regrowthRateMult(maturity: number): number {
  return 1 - REGROWTH_SLOWDOWN * clamp(maturity / MATURITY_MAX, 0, 1);
}

export function maturityYieldMult(maturity: number): number {
  return Math.max(1 - MATURITY_TOUGHNESS * clamp(maturity / MATURITY_MAX, 0, 1), MATURITY_YIELD_FLOOR);
}

// The floor maturity decays toward — not zero, so scarring heals back to
// "however old the run is," not back to virgin. Age and decay would fight
// over every cell if age were a per-cell gain instead of a shared floor:
// the wilderness would settle wherever the two rates happened to cross
// rather than converging cleanly. As a floor, scarring pushes a cell above
// it and decay returns the cell to it, never below.
export function ageFloorAt(elapsedSeconds: number): number {
  return Math.min(AGE_CEILING, AGE_RATE * elapsedSeconds);
}

// Bucketed *relative to the current age floor*, not raw maturity, and with
// a front-loaded sensitivity curve — both found necessary live during the
// Phase 4A debug-harness verification (2026-08-07, same methodology as
// Decision 59).
//
// (1) A fixed 0..1 split puts AGE_CEILING (0.33) inside the second bucket,
// so once age drift pushes the whole map to that floor (~6 minutes into any
// run), literally every cell — deep wilderness and an actively-fought scar
// ring alike — lands in the same bucket, and the placeholder overlay goes
// invisible. No fixed scheme fixes this at any resolution, since the floor
// itself keeps rising over a run — what "counts" as scarred has to rise
// with it. Bucket 0 means "at the current baseline everyone has, fought
// over or not"; the remaining buckets are reserved for maturity actually
// earned above that baseline.
//
// (2) Relative-to-floor alone still wasn't enough. Checked against the same
// harness run: 6 minutes of maxed weapons — the most aggressive clearing
// the game can produce — plateaued at 0.443 maturity against a 0.33 floor,
// a relative fraction of only 0.169. A *uniform* bucket-1 threshold at 25%
// of the remaining span sits at 0.4975 there — even that extreme scarring
// falls short of the first visible step. `MATURITY_TOUGHNESS`'s own
// feedback (higher maturity -> lower yield -> smaller further scar gains)
// makes this self-limiting by design, not a bug in the scar-gain formula,
// so the fix belongs here in the *visual* grouping, not in retuning
// gameplay balance that Phase 4A deliberately kept conservative. A
// square-root compression front-loads sensitivity — the same relative
// fraction above now crosses into bucket 1 — while still reserving buckets
// 2-3 for real, sustained scarring rather than a single graze.
//
// The absolute-maturity formulas (growthCeiling, regrowthRateMult,
// maturityYieldMult above) are deliberately NOT changed to match either
// fix — toughness and regrowth behavior must stay a function of true
// maturity regardless of when a cell got there or how compressed its
// on-screen bucket is; only the visual grouping needs to be legible.
export function maturityBucket(maturity: number, ageFloor: number): number {
  const span = Math.max(0.0001, MATURITY_MAX - ageFloor);
  const t = clamp((maturity - ageFloor) / span, 0, 1);
  const perceptual = Math.sqrt(t);
  return Math.min(MATURITY_BUCKETS - 1, Math.floor(perceptual * MATURITY_BUCKETS));
}
