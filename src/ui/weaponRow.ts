import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { gemDesc, gemIcon, gemName } from '../tuning/gems';
import { socketCount } from '../tuning/sockets';
import { WEAPON_DEFS } from '../tuning/weapons';
import { gemLegalFor } from '../systems/gemSockets';
import { minPointsForSockets } from '../systems/sockets';
import { weaponMods } from '../systems/weaponMods';

// Shared between Phase 5C's inventory screen and Phase 6-0's pre-run
// weapon select (docs/plans/phase-5c-inventory-ui.md S6) — one row
// layout, two callers, so the weapon list isn't built twice.
export type WeaponRowMode = 'loadout' | 'select';

export interface WeaponRowHandlers {
  onInvest?: (key: WeaponKey) => void;
  onWithdraw?: (key: WeaponKey) => void;
  onToggle?: (key: WeaponKey) => void; // 'select' mode only
  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6c): 'loadout'
  // mode only — the socketing UI 5C shipped as read-only. Clicking an
  // empty dot opens this row's picker; clicking a filled gem dot
  // unsockets immediately (no confirmation, matching the +/- buttons'
  // single-click-single-action feel — a gem is never destroyed, only
  // returned to inventory, so there's nothing to protect against);
  // picking a gem from the open picker sockets it.
  onOpenGemPicker?: (key: WeaponKey) => void;
  onUnsocketGem?: (key: WeaponKey, gemId: number) => void;
  onSocketGem?: (key: WeaponKey, gemId: number) => void;
}

// 'select' mode's checkbox state. Lives outside GameState — the pre-run
// deck is not run state (docs/plans/phase-6-0-weapon-select.md S5), so
// unlike 'loadout' mode this can't be read off `state`. `disabled` means
// the deck is already at its required size and this row isn't part of
// it; the row stays enabled if it's the one that's currently checked, so
// unchecking always works.
export interface WeaponRowSelectState {
  selected: boolean;
  disabled: boolean;
}

export function renderWeaponRow(
  key: WeaponKey,
  lvl: number,
  mode: WeaponRowMode,
  state: GameState | undefined,
  handlers: WeaponRowHandlers,
  selectState?: WeaponRowSelectState,
  gemPickerOpen = false,
): HTMLElement {
  const def = WEAPON_DEFS[key];

  const row = document.createElement('div');
  row.className = 'weapon-row';

  const header = document.createElement('div');
  header.className = 'weapon-row-header';
  header.innerHTML = `<span class="weapon-row-icon">${def?.icon ?? '?'}</span><span class="weapon-row-name">${def?.name ?? key}</span>`;
  row.appendChild(header);

  if (mode === 'loadout') {
    if (!state) throw new Error('loadout mode requires state');
    renderLoadoutControls(row, header, key, lvl, def, state, handlers, gemPickerOpen);
  } else {
    renderSelectControls(row, header, key, def, handlers, selectState);
  }

  return row;
}

function renderSelectControls(
  row: HTMLElement,
  header: HTMLElement,
  key: WeaponKey,
  def: (typeof WEAPON_DEFS)[WeaponKey],
  handlers: WeaponRowHandlers,
  selectState: WeaponRowSelectState | undefined,
): void {
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'weapon-row-toggle';
  toggle.checked = selectState?.selected ?? false;
  toggle.disabled = (selectState?.disabled ?? false) && !toggle.checked;
  toggle.addEventListener('change', () => handlers.onToggle?.(key));
  header.appendChild(toggle);

  row.classList.toggle('weapon-row-selected', selectState?.selected ?? false);
  row.classList.toggle('weapon-row-disabled', toggle.disabled);

  const stats = document.createElement('div');
  stats.className = 'weapon-row-stats';
  stats.textContent = def?.stats(1) ?? '';
  row.appendChild(stats);
}

function renderLoadoutControls(
  row: HTMLElement,
  header: HTMLElement,
  key: WeaponKey,
  lvl: number,
  def: (typeof WEAPON_DEFS)[WeaponKey],
  state: GameState,
  handlers: WeaponRowHandlers,
  gemPickerOpen: boolean,
): void {
  const pts = document.createElement('span');
  pts.className = 'weapon-row-points';
  pts.textContent = lvl === 1 ? '1 pt' : `${lvl} pts`;
  header.appendChild(pts);

  const controls = document.createElement('div');
  controls.className = 'weapon-row-controls';

  const minus = document.createElement('button');
  minus.className = 'weapon-row-btn';
  minus.textContent = '−';
  minus.disabled = lvl <= minPointsForSockets(state.weaponSockets[key]);
  minus.addEventListener('click', () => handlers.onWithdraw?.(key));
  controls.appendChild(minus);

  const plus = document.createElement('button');
  plus.className = 'weapon-row-btn';
  plus.textContent = '+';
  plus.disabled = state.enhancementPool <= 0;
  plus.addEventListener('click', () => handlers.onInvest?.(key));
  controls.appendChild(plus);

  header.appendChild(controls);

  const stats = document.createElement('div');
  stats.className = 'weapon-row-stats';
  // Phase 6A-1: live weaponMods so a socketed gem's effect on this
  // number is visible the instant it's socketed — the confirmation
  // job Decision 65 requires, extended from points (5C) to gems.
  stats.textContent = def?.stats(lvl, weaponMods(state, key)) ?? '';
  row.appendChild(stats);

  const sockets = document.createElement('div');
  sockets.className = 'weapon-row-sockets';
  const total = socketCount(lvl);
  const weaponSockets = state.weaponSockets[key];
  const extCount = weaponSockets?.extensions.length ?? 0;
  const gemInstances = weaponSockets?.gems ?? [];
  const filled = extCount + gemInstances.length;

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    if (i < extCount) {
      // Extensions aren't clickable here — 6B builds real ones; the
      // shared PLACEHOLDER_EXTENSION_KIND leaves the same way it always
      // has, via the +/- withdrawing points until its socket closes.
      dot.className = 'socket-dot filled socket-dot-extension';
      dot.textContent = '◆';
      dot.title = 'Extension';
    } else if (i < filled) {
      const gem = gemInstances[i - extCount]!;
      dot.className = 'socket-dot filled socket-dot-gem';
      dot.textContent = gemIcon(gem.kind);
      dot.title = `${gemName(gem.kind)} — click to unsocket`;
      dot.addEventListener('click', () => handlers.onUnsocketGem?.(key, gem.id));
    } else {
      dot.className = 'socket-dot';
      dot.textContent = '○';
      dot.title = 'Empty socket — click to place a gem';
      dot.addEventListener('click', () => handlers.onOpenGemPicker?.(key));
    }
    sockets.appendChild(dot);
  }
  row.appendChild(sockets);

  if (gemPickerOpen) row.appendChild(renderGemPicker(state, key, def, handlers));
}

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6c): the socket
// picker — every unsocketed gem in inventory that's legal for THIS
// weapon (archetype support + not already socketed here). Toggled open
// by clicking any empty dot on this row (ui/inventory.ts owns which
// weapon's picker is open, since it's the module with the full
// gemInventory in view).
function renderGemPicker(
  state: GameState,
  key: WeaponKey,
  def: (typeof WEAPON_DEFS)[WeaponKey],
  handlers: WeaponRowHandlers,
): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'gem-picker';

  const legal = state.gemInventory.filter((g) => gemLegalFor(state, key, g.kind));
  if (legal.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gem-picker-empty';
    empty.textContent = state.gemInventory.length === 0 ? 'No gems in inventory yet.' : 'No unsocketed gem fits here.';
    picker.appendChild(empty);
    return picker;
  }

  for (const gem of legal) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gem-picker-btn';
    btn.innerHTML = `<span class="gem-picker-icon">${gemIcon(gem.kind)}</span> ${gemName(gem.kind)}`;
    if (def) btn.title = gemDesc(gem.kind, def.delivery);
    btn.addEventListener('click', () => handlers.onSocketGem?.(key, gem.id));
    picker.appendChild(btn);
  }
  return picker;
}
