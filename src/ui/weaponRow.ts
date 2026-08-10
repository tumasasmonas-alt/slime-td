import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { extensionDesc, extensionIcon, extensionName } from '../tuning/extensions';
import { gemDesc, gemIcon, gemName } from '../tuning/gems';
import { extensionSlotCount, gemSocketCount } from '../tuning/sockets';
import { WEAPON_DEFS } from '../tuning/weapons';
import { extensionLegalFor, gemLegalFor } from '../systems/gemSockets';
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
  // mode only — the socketing UI 5C shipped as read-only. Clicking a
  // filled gem dot unsockets immediately (no confirmation, matching the
  // +/- buttons' single-click-single-action feel — a gem is never
  // destroyed, only returned to inventory, so there's nothing to protect
  // against); picking a gem from the open picker sockets it.
  //
  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): onEmptyGemSocketClick
  // fires for every empty gem-dot click — ui/inventory.ts (the module that
  // owns placing-mode state) decides what that click means: place the
  // currently-selected inventory item if one is legal here, otherwise
  // fall back to opening this row's own picker (the pre-6A-3 route,
  // which stays as a second way in).
  //
  // Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2): two
  // independent socket LINES now (extensions and gems no longer share
  // one pool — a reversal of arsenal plan S5, restoring Decision 32),
  // so the empty-dot click and the picker-open route both split in two.
  onEmptyGemSocketClick?: (key: WeaponKey) => void;
  onEmptyExtensionSocketClick?: (key: WeaponKey) => void;
  onUnsocketGem?: (key: WeaponKey, gemId: number) => void;
  onSocketGem?: (key: WeaponKey, gemId: number) => void;
  onUnsocketExtension?: (key: WeaponKey, extId: number) => void;
  onSocketExtension?: (key: WeaponKey, extId: number) => void;
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

// Phase 6B-1: which per-row picker is open, if any, and which of the two
// lines a pending placement lights up. Both replace 5C/6A-3's single
// `gemPickerOpen: boolean` / `placingHighlight` — one flag each is no
// longer enough once a weapon has two independently-legal lines.
export type WeaponRowPickerOpen = 'gem' | 'extension' | null;
export interface WeaponRowHighlight {
  gems?: 'ok' | 'no';
  extensions?: 'ok' | 'no';
}

export function renderWeaponRow(
  key: WeaponKey,
  lvl: number,
  mode: WeaponRowMode,
  state: GameState | undefined,
  handlers: WeaponRowHandlers,
  selectState?: WeaponRowSelectState,
  pickerOpen: WeaponRowPickerOpen = null,
  highlight?: WeaponRowHighlight,
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
    renderLoadoutControls(row, header, key, lvl, def, state, handlers, pickerOpen, highlight);
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
  pickerOpen: WeaponRowPickerOpen,
  highlight: WeaponRowHighlight | undefined,
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
  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): withdrawal no
  // longer has a floor — sockets that close evict their contents to
  // inventory instead of blocking the withdrawal (systems/sockets.ts's
  // withdrawPoints), so the only reason to disable this button now is
  // having nothing left to withdraw.
  minus.disabled = lvl <= 0;
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
  // job Decision 65 requires, extended from points (5C) to gems, then
  // to extensions (6B-1, via weaponMods folding in extensionMods).
  stats.textContent = def?.stats(lvl, weaponMods(state, key)) ?? '';
  row.appendChild(stats);

  // Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2): two
  // independent socket lines — extensions never compete with gems for
  // the same slot any more (a reversal of arsenal plan S5, restoring
  // Decision 32's "per-weapon extension slots, universal support gems").
  const weaponSockets = state.weaponSockets[key];
  const extLine = document.createElement('div');
  extLine.className = 'weapon-row-socket-line';
  extLine.innerHTML = '<span class="weapon-row-line-label">Ext</span>';
  renderSocketLine(
    extLine,
    extensionSlotCount(lvl),
    weaponSockets?.extensions ?? [],
    (ext) => extensionIcon(ext.kind),
    (ext) => `${extensionName(ext.kind)} Lv${ext.level} — click to unsocket`,
    (ext) => handlers.onUnsocketExtension?.(key, ext.id),
    () => handlers.onEmptyExtensionSocketClick?.(key),
    highlight?.extensions,
  );
  row.appendChild(extLine);

  const gemLine = document.createElement('div');
  gemLine.className = 'weapon-row-socket-line';
  gemLine.innerHTML = '<span class="weapon-row-line-label">Gem</span>';
  renderSocketLine(
    gemLine,
    gemSocketCount(lvl),
    weaponSockets?.gems ?? [],
    (gem) => gemIcon(gem.kind),
    (gem) => `${gemName(gem.kind)} — click to unsocket`,
    (gem) => handlers.onUnsocketGem?.(key, gem.id),
    () => handlers.onEmptyGemSocketClick?.(key),
    highlight?.gems,
  );
  row.appendChild(gemLine);

  if (pickerOpen === 'extension') row.appendChild(renderExtensionPicker(state, key, handlers));
  if (pickerOpen === 'gem') row.appendChild(renderGemPicker(state, key, def, handlers));
}

// Phase 6B-1: one socket line's dots — shared by the extension line and
// the gem line, since both are "N dots, some filled, click a filled one
// to unsocket, click an empty one to place/open the picker," differing
// only in what fills them and how many there are.
function renderSocketLine<T extends { id: number }>(
  container: HTMLElement,
  total: number,
  filled: T[],
  iconFor: (item: T) => string,
  titleFor: (item: T) => string,
  onUnsocket: (item: T) => void,
  onEmptyClick: () => void,
  lineHighlight: 'ok' | 'no' | undefined,
): void {
  const dots = document.createElement('div');
  dots.className = 'weapon-row-sockets';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    if (i < filled.length) {
      const item = filled[i]!;
      dot.className = 'socket-dot filled';
      dot.textContent = iconFor(item);
      dot.title = titleFor(item);
      dot.addEventListener('click', () => onUnsocket(item));
    } else {
      dot.className = 'socket-dot socket-dot-empty';
      dot.textContent = '+';
      if (lineHighlight === 'ok') {
        dot.classList.add('socket-dot-ok');
        dot.title = 'Click to place it here';
      } else if (lineHighlight === 'no') {
        dot.classList.add('socket-dot-no');
        dot.title = "Doesn't fit here";
      } else {
        dot.title = 'Empty socket — click to place';
      }
      dot.addEventListener('click', onEmptyClick);
    }
    dots.appendChild(dot);
  }
  container.appendChild(dots);
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

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S5.3): the
// extension line's own picker, mirroring renderGemPicker exactly —
// closing the gap where the per-row picker only ever offered gems, even
// after 6A-3 made extensions bankable too.
function renderExtensionPicker(state: GameState, key: WeaponKey, handlers: WeaponRowHandlers): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'gem-picker';

  const legal = state.extensionInventory.filter((e) => extensionLegalFor(state, key, e));
  if (legal.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gem-picker-empty';
    empty.textContent = state.extensionInventory.length === 0 ? 'No extensions in inventory yet.' : 'No unsocketed extension fits here.';
    picker.appendChild(empty);
    return picker;
  }

  for (const ext of legal) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gem-picker-btn';
    btn.innerHTML = `<span class="gem-picker-icon">${extensionIcon(ext.kind)}</span> ${extensionName(ext.kind)} Lv${ext.level}`;
    btn.title = extensionDesc(ext.kind, ext.level);
    btn.addEventListener('click', () => handlers.onSocketExtension?.(key, ext.id));
    picker.appendChild(btn);
  }
  return picker;
}
