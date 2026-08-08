import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { atkSpeedMult } from '../systems/passives';
import { nearestFrontierPoint, type FrontierPoint } from '../systems/frontier';

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
export type DeliverFn = (state: GameState, lvl: number, target: FrontierPoint | null) => void;

export interface WeaponPipeline {
  ready: ReadyFn;
  acquire?: AcquireFn;
  deliver: DeliverFn;
}

// The shared driver every per-weapon update function delegates to. `lvl`
// is passed in rather than read from state internally so a caller's own
// "not equipped" cleanup (Blades clears its orbitals) stays in the thin
// per-weapon wrapper, not duplicated here.
export function runWeaponPipeline(state: GameState, dt: number, lvl: number, pipeline: WeaponPipeline): void {
  if (!pipeline.ready(state, dt, lvl)) return;
  let target: FrontierPoint | null = null;
  if (pipeline.acquire) {
    target = pipeline.acquire(state);
    if (!target) return;
  }
  pipeline.deliver(state, lvl, target);
}

// Shared READY for every cooldown-timer weapon. Reads/writes
// state.weaponTimers[key] exactly as each weapon's own inline code did
// before this refactor, including dividing by atkSpeedMult - Overclock
// applies to every weapon built on this helper.
export function cooldownReady(key: WeaponKey, cooldown: (lvl: number) => number): ReadyFn {
  return (state, dt, lvl) => {
    state.weaponTimers[key] -= dt;
    if (state.weaponTimers[key] > 0) return false;
    state.weaponTimers[key] = cooldown(lvl) / atkSpeedMult(state);
    return true;
  };
}

// Shared ACQUIRE for every weapon that fires at the nearest frontier
// point (Bolt, Chain, Poison, Missile).
export const frontierAcquire: AcquireFn = (state) => nearestFrontierPoint(state);

export type { FrontierPoint };
