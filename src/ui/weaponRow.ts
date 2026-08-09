import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { socketCount } from '../tuning/sockets';
import { WEAPON_DEFS } from '../tuning/weapons';
import { minPointsForSockets, occupiedSlots } from '../systems/sockets';

// Shared between Phase 5C's inventory screen and Phase 6-0's pre-run
// weapon select (docs/plans/phase-5c-inventory-ui.md S6) — one row
// layout, two callers, so the weapon list isn't built twice.
export type WeaponRowMode = 'loadout' | 'select';

export interface WeaponRowHandlers {
  onInvest?: (key: WeaponKey) => void;
  onWithdraw?: (key: WeaponKey) => void;
  onToggle?: (key: WeaponKey) => void; // 'select' mode only
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
    renderLoadoutControls(row, header, key, lvl, def, state, handlers);
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
  stats.textContent = def?.stats(lvl) ?? '';
  row.appendChild(stats);

  const sockets = document.createElement('div');
  sockets.className = 'weapon-row-sockets';
  const total = socketCount(lvl);
  const filled = occupiedSlots(state.weaponSockets[key]);
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    const isFilled = i < filled;
    dot.className = 'socket-dot' + (isFilled ? ' filled' : '');
    dot.textContent = isFilled ? '◆' : '○';
    sockets.appendChild(dot);
  }
  row.appendChild(sockets);
}
