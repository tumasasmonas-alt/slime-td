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
const EVENT_INTERVAL_BASE = 26;
const EVENT_INTERVAL_FLOOR = 10;
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

// Coagulant formation triggers, Phase 3C (Decision 28: events are the
// only spark; standing mass never spontaneously coagulates). A vein
// sheds along its length throughout peak — "coagulants bud off along
// its length," §10 — so it gets a repeating interval. A bloom is one
// discrete spark, not a stream, so it fires once per peak phase.
export const VEIN_FORMATION_INTERVAL = 0.9;
