import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { maybeScheduleEchoBarrage } from '../systems/emissions';
import { nearestFrontierPoint, type FrontierPoint } from '../systems/frontier';
import { weaponMods } from '../systems/weaponMods';

// Phase 5A (docs/plans/phase-5-6-arsenal.md S4): every weapon becomes a
// walk through four named stages. This module carries the first three;
// the fourth (RESOLVE - what a hit does once it lands) stays where it
// already lives today, split between clearAt (instant weapons) and
// systems/projectiles.ts/systems/clouds.ts (deferred ones), since no gem
// yet needs a uniform hook there. Building that generalization now, before
// a single gem exists to prove it against, is exactly the over-built risk
// the plan itself flags.
//
// A gem later attaches by wrapping or replacing one of these three
// functions on a weapon's pipeline object - never by special-casing the
// weapon. See the plan's S4 table for which gem class hooks which stage.

// Stage 1 - READY: does the weapon act this tick? Owns the weapon's own
// cooldown bookkeeping. Continuous weapons (Blades) have no shared
// cooldown and are always ready; their own per-emission gating happens
// inside DELIVER instead.
export type ReadyFn = (state: GameState, dt: number, lvl: number) => boolean;

// Stage 2 - ACQUIRE: what does it aim at? Omitted for self-centered
// weapons (Blades, Frost, Immolation) - there is nothing to acquire, the
// tower is always the origin. A Targeting gem (Phase 6) replaces this
// stage wholesale; a weapon with no acquire stage has nothing for a
// Targeting gem to replace.
export type AcquireFn = (state: GameState) => FrontierPoint | null;

// Stage 3 - DELIVER: emit the weapon's effect - spawn a projectile or
// cloud, or apply an instant hit. For instant weapons this also performs
// what stage 4 will eventually own; for projectile/cloud weapons,
// resolution happens later in already-shared downstream code.
//
// Phase 6A-2: `powerMult` defaults to 1 and scales whatever this deliver
// treats as its power term — a normal fire never passes it; Echo/Barrage
// do, when systems/emissions.ts's queue re-invokes this same function
// later than the tick that decided to fire.
export type DeliverFn = (state: GameState, lvl: number, target: FrontierPoint | null, powerMult?: number) => void;

export interface WeaponPipeline {
  ready: ReadyFn;
  acquire?: AcquireFn;
  deliver: DeliverFn;
  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S4): run instead of
  // the pipeline when the weapon isn't equipped (or the grid isn't ready
  // yet) this frame — the one piece of "not equipped" cleanup a weapon
  // needs (Blades clearing its orbitals) that used to live in each
  // per-weapon updateXWeapon() wrapper. Declaring it on the pipeline
  // object, rather than keeping it only in the wrapper, is what lets
  // weapons/registry.ts's updateAllWeapons() drive every weapon through
  // one generic loop without losing that cleanup.
  cleanup?: (state: GameState) => void;
}

// The shared driver every per-weapon update function delegates to. `lvl`
// is passed in rather than read from state internally so a caller's own
// "not equipped" cleanup (Blades clears its orbitals) stays in the thin
// per-weapon wrapper, not duplicated here.
//
// Phase 6A-2: takes the weapon's own key now, so it can check for an
// Echo/Barrage gem after a normal fire succeeds and queue the follow-up
// emissions systems/emissions.ts drains later. Every existing caller
// already knows its own key statically (it's the weapon whose file this
// is), so this is a one-argument addition at each call site, not a new
// lookup.
export function runWeaponPipeline(state: GameState, dt: number, lvl: number, pipeline: WeaponPipeline, key: WeaponKey): void {
  if (!pipeline.ready(state, dt, lvl)) return;
  let target: FrontierPoint | null = null;
  if (pipeline.acquire) {
    target = pipeline.acquire(state);
    if (!target) return;
  }
  pipeline.deliver(state, lvl, target);
  maybeScheduleEchoBarrage(state, key, lvl, target);
}

// Shared READY for every cooldown-timer weapon. Reads/writes
// state.weaponTimers[key] exactly as each weapon's own inline code did
// before this refactor. Phase 6A-1: divides by this weapon's own
// weaponMods().rate rather than the deleted global atkSpeedMult() —
// Overclock now applies per-weapon, via whatever gem is socketed into
// THIS weapon, not as a whole-game passive.
export function cooldownReady(key: WeaponKey, cooldown: (lvl: number) => number): ReadyFn {
  return (state, dt, lvl) => {
    state.weaponTimers[key] -= dt;
    if (state.weaponTimers[key] > 0) return false;
    state.weaponTimers[key] = cooldown(lvl) / weaponMods(state, key).rate;
    return true;
  };
}

// Shared ACQUIRE for every weapon that fires at the nearest frontier
// point (Bolt, Chain, Poison, Missile).
export const frontierAcquire: AcquireFn = (state) => nearestFrontierPoint(state);

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S5): Multishot and
// Formation's angular spread, shared by every projectile weapon that
// fires more than once per emissionPlan(). The distinction between them
// is deliberately mechanical, not cosmetic: Formation's copies land at
// fixed, symmetric offsets every time; plain Multishot jitters that same
// spread randomly, so the two read differently in play rather than being
// the same card twice.
export function emissionAngles(count: number, baseAngle: number, formation: boolean, spreadRadians: number): number[] {
  if (count <= 1) return [baseAngle];
  const angles: number[] = [];
  for (let i = 0; i < count; i++) {
    const centered = i - (count - 1) / 2;
    const jitter = formation ? 0 : (Math.random() - 0.5) * spreadRadians * 0.6;
    angles.push(baseAngle + centered * spreadRadians + jitter);
  }
  return angles;
}

export type { FrontierPoint };
