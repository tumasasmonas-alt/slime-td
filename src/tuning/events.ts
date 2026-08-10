import { clamp, lerp } from '../util/math';

// Infection Events replace growth nodes (Phase 3B, Decision 29) as the
// game's pacing mechanism — one system, two variants, sharing a
// lifecycle: telegraph -> active -> peak -> decay -> removed (a new one
// spawns elsewhere). See
// docs/sessions/2026-08-05-slime-and-arsenal-rework.md §11 and
// docs/DECISIONS.md #29. Numbers here are first-pass, not balanced — see
// the Phase 3C playtest gate in docs/BACKLOG.md.

// Telegraph lengthened from 2.5s per the Phase 3C playtest gate
// (2026-08-06) — the player needs real time to see a vein coming and
// react, not a token warning before it starts flooding the field.
export const EVENT_TELEGRAPH_DURATION = 4.5;
export const EVENT_ACTIVE_DURATION = 4;
export const EVENT_PEAK_DURATION = 3.5;
export const EVENT_DECAY_DURATION = 1.5;

export const MAX_CONCURRENT_EVENTS = 2;

// A little breathing room before the first event of a run.
export const EVENT_INITIAL_DELAY = 8;

// Fraction of new events that are veins rather than blooms.
export const VEIN_WEIGHT = 0.6;

// Event frequency is one of the five organic escalation axes named in
// the 2026-08-05 session record §15 ("more simultaneous veins/blooms
// over time") and, per Decision 28, the *only* thing that triggers
// coagulation once 3C lands — this is the single pacing lever the design
// asks for. Same time-driven shape as ambientInfectionMult
// (tuning/growth.ts): decoupled from the tier table. A straight lerp to
// a floor rather than a breakpoint table, since there's no existing
// curve here to preserve.
// 2026-08-10: lowered (base 26→18, floor 10→7) — the owner's call,
// "increase event happening speed" as part of a broader difficulty
// pass. Ramp time is untouched, so the relative escalation shape over a
// run is preserved; only the absolute cadence at both ends moved.
const EVENT_INTERVAL_BASE = 18;
const EVENT_INTERVAL_FLOOR = 7;
const EVENT_INTERVAL_RAMP_TIME = 420;

export function eventSpawnInterval(elapsedSeconds: number): number {
  const t = clamp(elapsedSeconds / EVENT_INTERVAL_RAMP_TIME, 0, 1);
  return lerp(EVENT_INTERVAL_BASE, EVENT_INTERVAL_FLOOR, t);
}

// Vein geometry — a jagged branching polyline built once at telegraph
// time (systems/veinPath.ts), never regenerated per frame (the
// bubbleSeeds/novaFx bug class, docs/DECISIONS.md #4/#7). Recursive
// midpoint displacement from an arena-edge point aimed at the core;
// depth 5 gives 32 trunk segments.
export const VEIN_DISPLACEMENT_DEPTH = 5;
export const VEIN_INITIAL_OFFSET = 90;
export const VEIN_BRANCH_CHANCE = 0.35;
export const VEIN_BRANCH_DEPTH = 2;
export const VEIN_BRANCH_LENGTH = 70;

// How far growth injection (and the rendered stroke) reaches either side
// of the vein's centerline.
export const VEIN_WIDTH = 20;
export const VEIN_ACTIVE_RATE = 0.55;
export const VEIN_PEAK_RATE = 0.85;

// The vein's target point stops this far *outside* the perimeter, rather
// than at the core — found live during the Phase 3C playtest gate
// (2026-08-06): a vein aimed at the tower floods mass right at the
// defended ring, and a coagulant sparking from that mass can form inside
// or barely outside the ring with almost no runway to react. Veins are
// meant to deliver fresh, short-runway mass "close" (§11) — not mass that
// never had a distance to cross at all.
export const VEIN_STOP_MARGIN = 60;

// Bloom: radial and local. In 3B this is elevated growth in its radius
// only — its real job (accelerating maturity, per §11) waits for Phase
// 4C, not 4A: 4A already changes clear resistance globally, and stacking
// bloom-hardening on top would make that gate unreadable. Ships now so the
// event framework has one lifecycle, two variants, rather than bolting a
// second variant on later (Decision, 2026-08-06 follow-up session).
export const BLOOM_RADIUS = 110;
export const BLOOM_ACTIVE_RATE = 0.5;
export const BLOOM_PEAK_RATE = 0.8;

// Phase 4C-1 (Decision 68): the maturity payload deferred since 3B —
// "blooms let armour appear mid-field, earlier, as a discrete event"
// (§11), rather than Sclerotics only ever coming from the ring, which
// would make them always close and always late.
//
// Sized against the *active* phase alone, not active+peak — bloom's own
// formation attempt fires at the instant peak begins
// (systems/events.ts's advancePhase arms formationTimer to 0 exactly
// then), so only the 4s active window has actually accumulated maturity
// by the time a bloom tries to spark itself. Verified live via the
// debug-harness methodology (Decision 59): the first-pass rate (0.04)
// only reached ~0.16 maturity at the epicenter by then — nowhere near
// MATURITY_SCLEROTIC_THRESHOLD (0.55) — so no bloom ever produced a
// Sclerotic from its own spark across a 700s run. At 0.15/s, 4s of active
// reaches ~0.6 at the exact centre before flood-fill averaging (which
// pulls in lower-falloff neighbouring cells) dilutes it back down.
// PEAK_RATE keeps contributing afterward — not to the bloom's own spark,
// but to whatever a later vein's maturity-biased sampling finds there.
export const BLOOM_MATURITY_ACTIVE_RATE = 0.15;
export const BLOOM_MATURITY_PEAK_RATE = 0.2;

// Coagulant formation triggers, Phase 3C (Decision 28: events are the
// only spark; standing mass never spontaneously coagulates). A vein
// sheds along its length throughout peak — "coagulants bud off along
// its length," §10 — so it gets a repeating interval. A bloom is one
// discrete spark, not a stream, so it fires once per peak phase.
export const VEIN_FORMATION_INTERVAL = 0.9;

// Phase 4C-1 (Decision 68): "a vein reaching the scar ring... wakes
// Sclerotics from the player's own callus" (§11). Rather than a special-
// cased trigger, a vein's spark point samples this many candidate points
// along its revealed trunk/branches and keeps whichever sits on the
// most-scarred ground — still just terrain deciding what burns (§11's
// organising principle), biased rather than forced toward the ring.
export const VEIN_SPARK_CANDIDATES = 4;
