import type { CoreGemInstance, ExtensionInstance, GameState, GemInstance } from '../state';
import type { CoreGemKey } from '../tuning/coreGems';
import { gemSupportsDelivery, isTargetingGem } from '../tuning/gems';
import { WEAPON_DEFS } from '../tuning/weapons';
import type { GemKey, WeaponKey } from '../types';
import { applyCoreGemEffect, removeCoreGemEffect } from './passives';
import { freeExtensionSlots, freeGemSlots } from './sockets';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6c): the socketing
// system 5C left as a read-only affordance. Whether `kind` could be
// socketed into `weaponKey` right now — its delivery archetype supports
// the gem, and it isn't already sitting in that weapon (arsenal plan S5:
// the same gem may sit in several different weapons, never twice in one).
//
// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): a Targeting gem
// replaces a weapon's ACQUIRE stage wholesale, and you can't replace it
// twice — at most one Targeting gem per weapon, refused here the same way
// an already-owned kind or an unsupported archetype is, so the UI never
// needs its own copy of this rule.
export function gemLegalFor(state: GameState, weaponKey: WeaponKey, kind: GemKey): boolean {
  if (state.weapons[weaponKey] === undefined) return false; // not in the deck this run
  const def = WEAPON_DEFS[weaponKey];
  if (!def) return false;
  if (!gemSupportsDelivery(kind, def.delivery)) return false;
  const sockets = state.weaponSockets[weaponKey];
  if (sockets?.gems.some((g) => g.kind === kind)) return false;
  if (isTargetingGem(kind) && sockets?.gems.some((g) => isTargetingGem(g.kind))) return false;
  return true;
}

// Moves a gem instance from inventory into a weapon's sockets. Returns
// whether it happened — false covers every illegal case (no free socket,
// wrong archetype, already there) uniformly, so a caller can't
// accidentally socket a gem it shouldn't.
export function socketGem(state: GameState, weaponKey: WeaponKey, instance: GemInstance): boolean {
  if (freeGemSlots(state, weaponKey) <= 0) return false;
  if (!gemLegalFor(state, weaponKey, instance.kind)) return false;
  const sockets = (state.weaponSockets[weaponKey] ??= { extensions: [], gems: [] });
  sockets.gems.push(instance);
  state.gemInventory = state.gemInventory.filter((g) => g.id !== instance.id);
  return true;
}

// The mirror: a socketed gem always returns to inventory, never destroyed
// (call 13, "no destructive respec, ever" — the same rule
// systems/sockets.ts's withdrawPoints() already follows for extensions).
export function unsocketGem(state: GameState, weaponKey: WeaponKey, gemId: number): boolean {
  const sockets = state.weaponSockets[weaponKey];
  if (!sockets) return false;
  const idx = sockets.gems.findIndex((g) => g.id === gemId);
  if (idx === -1) return false;
  const [instance] = sockets.gems.splice(idx, 1);
  state.gemInventory.push(instance!);
  return true;
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): an extension is
// bound to the weapon it was rolled for (unlike a gem, which can sit in
// any archetype-legal weapon) — legality here is just "is this the right
// weapon, is it equipped, is it not already sitting in that weapon's own
// sockets" (the last check is defensive: systems/cards.ts's applyCardChoice
// never creates a second instance of an owned (weaponKey, kind) pair, so
// this should be unreachable in practice, not a case the UI needs to
// handle).
export function extensionLegalFor(state: GameState, weaponKey: WeaponKey, instance: ExtensionInstance): boolean {
  if (instance.weaponKey !== weaponKey) return false;
  if (state.weapons[weaponKey] === undefined) return false;
  const sockets = state.weaponSockets[weaponKey];
  if (sockets?.extensions.some((e) => e.kind === instance.kind)) return false;
  return true;
}

// Mirrors socketGem/unsocketGem exactly — an extension moving in or out
// of a weapon's sockets is the same array-move operation gems already
// use, just reading extensionInventory/extensionLegalFor and its own
// line's capacity (freeExtensionSlots, not freeGemSlots — Phase 6B-1's
// two independent lines) instead.
export function socketExtension(state: GameState, weaponKey: WeaponKey, instance: ExtensionInstance): boolean {
  if (freeExtensionSlots(state, weaponKey) <= 0) return false;
  if (!extensionLegalFor(state, weaponKey, instance)) return false;
  const sockets = (state.weaponSockets[weaponKey] ??= { extensions: [], gems: [] });
  sockets.extensions.push(instance);
  state.extensionInventory = state.extensionInventory.filter((e) => e.id !== instance.id);
  return true;
}

export function unsocketExtension(state: GameState, weaponKey: WeaponKey, instanceId: number): boolean {
  const sockets = state.weaponSockets[weaponKey];
  if (!sockets) return false;
  const idx = sockets.extensions.findIndex((e) => e.id === instanceId);
  if (idx === -1) return false;
  const [instance] = sockets.extensions.splice(idx, 1);
  state.extensionInventory.push(instance!);
  return true;
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S6): a core gem's effect
// applies only once it actually occupies one of the 3 fixed core slots —
// socketing/unsocketing calls applyCoreGemEffect/removeCoreGemEffect
// (systems/passives.ts) exactly once each, so the two always stay a
// matched pair regardless of how many times a gem moves in and out.
export function socketCoreGem(state: GameState, instance: CoreGemInstance): boolean {
  const idx = state.coreGems.indexOf(null);
  if (idx === -1) return false;
  state.coreGems[idx] = instance.kind;
  state.coreGemInventory = state.coreGemInventory.filter((c) => c.id !== instance.id);
  applyCoreGemEffect(state, instance.kind);
  return true;
}

// The mirror: a core gem always returns to inventory, never destroyed —
// same "no destructive respec" rule as gems and extensions.
export function unsocketCoreGem(state: GameState, kind: CoreGemKey): boolean {
  const idx = state.coreGems.indexOf(kind);
  if (idx === -1) return false;
  state.coreGems[idx] = null;
  state.coreGemInventory.push({ id: state.nextGemId++, kind });
  removeCoreGemEffect(state, kind);
  return true;
}
