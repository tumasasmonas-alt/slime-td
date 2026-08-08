import type { GameState } from '../state';
import { PASSIVE_DEFS } from '../tuning/passives';
import type { WeaponKey } from '../types';
import { investPoints, withdrawPoints } from '../systems/sockets';
import { renderWeaponRow } from './weaponRow';

export interface InventoryRefs {
  overlay: HTMLElement;
  points: HTMLElement;
  weapons: HTMLElement;
  core: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Opened two ways (docs/plans/phase-5c-inventory-ui.md S5): the HUD
// button during normal play, and a "Manage Loadout" button inside the
// level-up card screen. Both onOpen/onClose callbacks are wired by
// main.ts, which already coordinates hudRefs/cardRefs/overlayRefs and is
// the only place that knows which of the two contexts is active — this
// module stays a thin content-rendering wrapper, same split as 5B's
// systems/cards.ts vs ui/upgradeCards.ts.
export function initInventory(openBtnId: string, closeBtnId: string, onOpen: () => void, onClose: () => void): InventoryRefs {
  const refs: InventoryRefs = {
    overlay: requireEl('inventory-overlay'),
    points: requireEl('inventory-points'),
    weapons: requireEl('inventory-weapons'),
    core: requireEl('inventory-core'),
  };
  requireEl(openBtnId).addEventListener('click', onOpen);
  requireEl(closeBtnId).addEventListener('click', onClose);
  return refs;
}

export function openInventory(refs: InventoryRefs, state: GameState): void {
  renderInventory(refs, state);
  refs.overlay.classList.remove('hidden');
}

export function closeInventory(refs: InventoryRefs): void {
  refs.overlay.classList.add('hidden');
}

// Full rebuild on every change, same pattern ui/upgradeCards.ts already
// uses for its card panel — the whole screen is small (at most 7 weapon
// rows plus 3 core slots), and a full rebuild is far simpler than
// diffing socket counts, stat text and button disabled-state separately.
export function renderInventory(refs: InventoryRefs, state: GameState): void {
  refs.points.textContent = `${state.enhancementPool} point${state.enhancementPool === 1 ? '' : 's'} unspent`;

  refs.weapons.innerHTML = '';
  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    const lvl = state.weapons[key];
    if (lvl === undefined) continue; // absent means never equipped; 0 means equipped but unspent (S9 Q4) and still renders
    const row = renderWeaponRow(key, lvl, 'loadout', state, {
      onInvest: (k) => {
        investPoints(state, k, 1);
        renderInventory(refs, state);
      },
      onWithdraw: (k) => {
        withdrawPoints(state, k, 1);
        renderInventory(refs, state);
      },
    });
    refs.weapons.appendChild(row);
  }

  renderCoreRow(refs, state);
}

function renderCoreRow(refs: InventoryRefs, state: GameState): void {
  refs.core.innerHTML = '';
  for (const kind of state.coreGems) {
    const slot = document.createElement('div');
    if (kind) {
      const def = PASSIVE_DEFS[kind];
      slot.className = 'core-slot filled';
      slot.innerHTML = `<span class="core-slot-icon">${def.icon}</span><span class="core-slot-name">${def.name}</span>`;
    } else {
      slot.className = 'core-slot';
      slot.textContent = '○';
    }
    refs.core.appendChild(slot);
  }
}
