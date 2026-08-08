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

// The floor withdrawPoints() will not cross — points can never drop
// below whatever socketCount() needs to hold the extensions already
// committed to a weapon (extensions have nowhere to return to, unlike
// gems). Exported so the inventory UI (Phase 5C) can disable the "-"
// button exactly when it would have no effect, rather than showing it
// live and silently clamping.
export function minPointsForSockets(sockets: WeaponSockets | undefined): number {
  const extensionCount = sockets?.extensions.length ?? 0;
  let minPoints = 0;
  while (socketCount(minPoints) < extensionCount) minPoints++;
  return minPoints;
}

// Phase 5C (docs/plans/phase-5b-framework.md S3 / phase-5c-inventory-ui.md):
// investPoints is withdrawPoints' mirror on the spend side. Investment
// never needs eviction logic — more points can only ever open more
// sockets, never close one — so it's a straight transfer from the bank
// to the weapon. Returns the amount actually invested, capped at what
// was available to spend.
export function investPoints(state: GameState, key: WeaponKey, amount: number): number {
  const actualAmount = Math.max(0, Math.min(amount, state.enhancementPool));
  if (actualAmount <= 0) return 0;
  state.weapons[key] = (state.weapons[key] ?? 0) + actualAmount;
  state.enhancementPool -= actualAmount;
  return actualAmount;
}

// Phase 5B (docs/plans/phase-5b-framework.md S5): "no destructive
// respec, ever" (arsenal plan S5). Gems in a socket that closes return to
// gemInventory, most-recently-socketed first. Extensions have nowhere to
// return to (no extension inventory exists in the design), so the
// withdrawal is clamped rather than ever destroying one — see
// minPointsForSockets() above.
//
// Returns the amount actually withdrawn, which may be less than
// requested if the clamp engaged. Withdrawn points return to
// state.enhancementPool — this is a transfer, not a deletion, mirroring
// investPoints() exactly.
export function withdrawPoints(state: GameState, key: WeaponKey, amount: number): number {
  const current = state.weapons[key] ?? 0;
  const sockets = state.weaponSockets[key];
  const minPoints = minPointsForSockets(sockets);

  const actualAmount = Math.min(amount, Math.max(0, current - minPoints));
  const newPoints = current - actualAmount;
  state.weapons[key] = newPoints;
  state.enhancementPool += actualAmount;

  if (sockets) {
    const newSocketCount = socketCount(newPoints);
    while (occupiedSlots(sockets) > newSocketCount && sockets.gems.length > 0) {
      const gem = sockets.gems.pop()!;
      state.gemInventory.push(gem);
    }
  }

  return actualAmount;
}
