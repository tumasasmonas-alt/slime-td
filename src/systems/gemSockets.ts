import type { GameState, GemInstance } from '../state';
import { gemSupportsDelivery } from '../tuning/gems';
import { WEAPON_DEFS } from '../tuning/weapons';
import type { GemKey, WeaponKey } from '../types';
import { freeSlots } from './sockets';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6c): the socketing
// system 5C left as a read-only affordance. Whether `kind` could be
// socketed into `weaponKey` right now — its delivery archetype supports
// the gem, and it isn't already sitting in that weapon (arsenal plan S5:
// the same gem may sit in several different weapons, never twice in one).
export function gemLegalFor(state: GameState, weaponKey: WeaponKey, kind: GemKey): boolean {
  if (state.weapons[weaponKey] === undefined) return false; // not in the deck this run
  const def = WEAPON_DEFS[weaponKey];
  if (!def) return false;
  if (!gemSupportsDelivery(kind, def.delivery)) return false;
  const sockets = state.weaponSockets[weaponKey];
  if (sockets?.gems.some((g) => g.kind === kind)) return false;
  return true;
}

// Whether `kind` has anywhere legal to go among the equipped deck right
// now — a free socket on some weapon that also passes gemLegalFor. The
// card pool's no-dead-card rule (arsenal plan S11) reads this before ever
// offering a gem card.
export function gemHasLegalHome(state: GameState, kind: GemKey): boolean {
  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    if (freeSlots(state, key) > 0 && gemLegalFor(state, key, kind)) return true;
  }
  return false;
}

// Moves a gem instance from inventory into a weapon's sockets. Returns
// whether it happened — false covers every illegal case (no free socket,
// wrong archetype, already there) uniformly, so a caller can't
// accidentally socket a gem it shouldn't.
export function socketGem(state: GameState, weaponKey: WeaponKey, instance: GemInstance): boolean {
  if (freeSlots(state, weaponKey) <= 0) return false;
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
