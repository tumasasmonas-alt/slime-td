import type { GameState, WeaponSockets } from '../state';
import type { WeaponKey } from '../types';
import { socketCount } from '../tuning/sockets';

// How many of a weapon's sockets are currently filled — extensions and
// gems share one pool (arsenal plan S5), so this sums both rather than
// tracking them separately.
export function occupiedSlots(sockets: WeaponSockets | undefined): number {
  if (!sockets) return 0;
  return sockets.extensions.length + sockets.gems.length;
}

export function freeSlots(state: GameState, key: WeaponKey): number {
  const points = state.weapons[key] ?? 0;
  return socketCount(points) - occupiedSlots(state.weaponSockets[key]);
}

// Phase 5B (docs/plans/phase-5b-framework.md S5): "no destructive
// respec, ever" (arsenal plan S5), built now as pure plumbing even
// though 5B has no UI trigger for it yet — 5C's +/- control is the first
// thing that calls this. Gems in a socket that closes return to
// gemInventory, most-recently-socketed first. Extensions have nowhere to
// return to (no extension inventory exists in the design), so the
// withdrawal is clamped rather than ever destroying one: points can
// never drop below whatever socketCount() needs to hold the extensions
// already committed to this weapon.
//
// Returns the amount actually withdrawn, which may be less than
// requested if the clamp engaged.
export function withdrawPoints(state: GameState, key: WeaponKey, amount: number): number {
  const current = state.weapons[key] ?? 0;
  const sockets = state.weaponSockets[key];
  const extensionCount = sockets?.extensions.length ?? 0;

  let minPoints = 0;
  while (socketCount(minPoints) < extensionCount) minPoints++;

  const actualAmount = Math.min(amount, Math.max(0, current - minPoints));
  const newPoints = current - actualAmount;
  state.weapons[key] = newPoints;

  if (sockets) {
    const newSocketCount = socketCount(newPoints);
    while (occupiedSlots(sockets) > newSocketCount && sockets.gems.length > 0) {
      const gem = sockets.gems.pop()!;
      state.gemInventory.push(gem);
    }
  }

  return actualAmount;
}
