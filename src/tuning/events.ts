import { clamp, lerp } from '../util/math';

// Infection Events replace growth nodes (Phase 3B, Decision 29) as the
// game's pacing mechanism — one system, two variants, sharing a
// lifecycle: telegraph -> active -> peak -> decay -> removed (a new one
// spawns elsewhere). See
// docs/sessions/2026-08-05-slime-and-arsenal-rework.md §11 and
// docs/DECISIONS.md #29. Numbers here are first-pass, not balanced — see
// the Phase 3C playtest gate in docs/BACKLOG.md.

export const EVENT_TELEGRAPH_DURATION = 2.5;
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

// Bloom: radial and local. In 3B this is elevated growth in its radius
// only — its real job (accelerating maturity, per §11) waits for Phase
// 4A; ships now so the event framework has one lifecycle, two variants,
// rather than bolting a second variant on later (Decision, 2026-08-06
// follow-up session).
export const BLOOM_RADIUS = 110;
export const BLOOM_ACTIVE_RATE = 0.5;
export const BLOOM_PEAK_RATE = 0.8;
