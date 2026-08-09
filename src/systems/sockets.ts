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
// respec, ever" (arsenal plan S5) — nothing withdrawal touches is ever
// destroyed, only moved to inventory. Gems in a socket that closes
// return to gemInventory, most-recently-socketed first; as of Phase 6A-3
// (docs/plans/phase-6a3-loop-fixes.md S4), extensions do the exact same
// thing, returning to extensionInventory instead of clamping the
// withdrawal — the clamp existed only because extensions used to have
// nowhere to go. Gems evict before extensions purely to keep the
// existing gem-eviction tests' behaviour unchanged; the plan doesn't
// specify an ordering preference between the two.
//
// Withdrawal is therefore never partial any more — the full requested
// amount always succeeds, up to what the weapon actually has invested.
// Withdrawn points return to state.enhancementPool — a transfer, not a
// deletion, mirroring investPoints() exactly.
export function withdrawPoints(state: GameState, key: WeaponKey, amount: number): number {
  const current = state.weapons[key] ?? 0;
  const actualAmount = Math.min(amount, current);
  const newPoints = current - actualAmount;
  state.weapons[key] = newPoints;
  state.enhancementPool += actualAmount;

  const sockets = state.weaponSockets[key];
  if (sockets) {
    const newSocketCount = socketCount(newPoints);
    while (occupiedSlots(sockets) > newSocketCount) {
      if (sockets.gems.length > 0) {
        const gem = sockets.gems.pop()!;
        state.gemInventory.push(gem);
      } else if (sockets.extensions.length > 0) {
        const ext = sockets.extensions.pop()!;
        state.extensionInventory.push(ext);
      } else {
        break; // occupiedSlots() and the two arrays disagreed — shouldn't happen
      }
    }
  }

  return actualAmount;
}
