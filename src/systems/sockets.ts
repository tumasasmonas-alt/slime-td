import type { GameState, WeaponSockets } from '../state';
import type { WeaponKey } from '../types';
import { extensionSlotCount, gemSocketCount } from '../tuning/sockets';

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2): extensions
// and gems each get their own line now — occupiedSlots()/freeSlots() (one
// combined count) are replaced by a pair of functions, one per line,
// rather than widened, since there is no longer a single "how full is
// this weapon" number that means anything.
export function freeGemSlots(state: GameState, key: WeaponKey): number {
  const points = state.weapons[key] ?? 0;
  const sockets = state.weaponSockets[key];
  return gemSocketCount(points) - (sockets?.gems.length ?? 0);
}

export function freeExtensionSlots(state: GameState, key: WeaponKey): number {
  const points = state.weapons[key] ?? 0;
  const sockets = state.weaponSockets[key];
  return extensionSlotCount(points) - (sockets?.extensions.length ?? 0);
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
// destroyed, only moved to inventory. As of Phase 6B-1, each line evicts
// independently against its own new count — there is no more "which kind
// evicts first" tiebreak to make, since a gem closing no longer has any
// effect on how many extension slots exist, and vice versa. Most-
// recently-socketed first within each line, same rule 6A-3 already used.
//
// Withdrawal is therefore never partial — the full requested amount
// always succeeds, up to what the weapon actually has invested. Withdrawn
// points return to state.enhancementPool, a transfer mirroring
// investPoints() exactly.
export function withdrawPoints(state: GameState, key: WeaponKey, amount: number): number {
  const current = state.weapons[key] ?? 0;
  const actualAmount = Math.min(amount, current);
  const newPoints = current - actualAmount;
  state.weapons[key] = newPoints;
  state.enhancementPool += actualAmount;

  const sockets: WeaponSockets | undefined = state.weaponSockets[key];
  if (sockets) {
    const newGemCount = gemSocketCount(newPoints);
    while (sockets.gems.length > newGemCount) {
      const gem = sockets.gems.pop()!;
      state.gemInventory.push(gem);
    }
    const newExtCount = extensionSlotCount(newPoints);
    while (sockets.extensions.length > newExtCount) {
      const ext = sockets.extensions.pop()!;
      state.extensionInventory.push(ext);
    }
  }

  return actualAmount;
}
