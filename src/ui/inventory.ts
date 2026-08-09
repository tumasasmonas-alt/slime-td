import type { CoreGemInstance, ExtensionInstance, GameState, GemInstance } from '../state';
import { gemIcon, gemName } from '../tuning/gems';
import { PASSIVE_DEFS } from '../tuning/passives';
import { PLACEHOLDER_EXTENSION_NAME } from '../tuning/extensions';
import { WEAPON_DEFS } from '../tuning/weapons';
import type { GemKey, WeaponKey } from '../types';
import {
  extensionLegalFor,
  gemLegalFor,
  socketCoreGem,
  socketExtension,
  socketGem,
  unsocketCoreGem,
  unsocketExtension,
  unsocketGem,
} from '../systems/gemSockets';
import { investPoints, withdrawPoints } from '../systems/sockets';
import { renderWeaponRow } from './weaponRow';

export interface InventoryRefs {
  overlay: HTMLElement;
  points: HTMLElement;
  hint: HTMLElement;
  weapons: HTMLElement;
  core: HTMLElement;
  extList: HTMLElement;
  coreGemList: HTMLElement;
  gemList: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6c): which weapon's
// gem picker is expanded, if any — module-level UI state, same pattern
// ui/weaponSelect.ts's `draft` already uses for transient screen state
// that doesn't belong in GameState. Reset whenever the overlay closes so
// it never reopens stale on the next visit.
let gemPickerFor: WeaponKey | null = null;

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): the click-to-place
// state — which banked instance (if any) is currently selected for
// placement. Set by clicking an entry in the side panel; cleared by
// clicking it again, pressing Escape, or a successful placement. Also
// module-level for the same reason gemPickerFor is: this is a property of
// the *screen*, not of GameState, and must never survive a screen close.
type Placing =
  | { kind: 'gem'; instance: GemInstance }
  | { kind: 'extension'; instance: ExtensionInstance }
  | { kind: 'coreGem'; instance: CoreGemInstance };
let placing: Placing | null = null;

// Cached purely so the document-level Escape listener (registered once,
// in initInventory, before any GameState reference is available to it)
// can re-render after cancelling — renderInventory refreshes this on
// every call, so it's always the state the currently-open screen is
// showing.
let lastRenderState: GameState | null = null;

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
    hint: requireEl('inventory-hint'),
    weapons: requireEl('inventory-weapons'),
    core: requireEl('inventory-core'),
    extList: requireEl('inventory-ext-list'),
    coreGemList: requireEl('inventory-coregem-list'),
    gemList: requireEl('inventory-gem-list'),
  };
  requireEl(openBtnId).addEventListener('click', onOpen);
  requireEl(closeBtnId).addEventListener('click', onClose);

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): "or press Escape"
  // — registered once here rather than per-render, since it must survive
  // across renders and only needs to act while this screen is actually
  // open and something is actually selected.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (refs.overlay.classList.contains('hidden')) return;
    if (!placing) return;
    placing = null;
    if (lastRenderState) renderInventory(refs, lastRenderState);
  });

  return refs;
}

export function openInventory(refs: InventoryRefs, state: GameState): void {
  placing = null; // a fresh open never resumes a stale placement from last time
  renderInventory(refs, state);
  refs.overlay.classList.remove('hidden');
}

export function closeInventory(refs: InventoryRefs): void {
  refs.overlay.classList.add('hidden');
  gemPickerFor = null;
  placing = null;
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): whether — and how —
// `placing` fits weapon `key`. undefined outside placing mode (renders
// with no highlight, same as before this batch); 'no' for a core gem,
// which never fits a weapon row at all.
function highlightFor(state: GameState, key: WeaponKey): 'ok' | 'no' | undefined {
  if (!placing) return undefined;
  if (placing.kind === 'gem') return gemLegalFor(state, key, placing.instance.kind) ? 'ok' : 'no';
  if (placing.kind === 'extension') return extensionLegalFor(state, key, placing.instance) ? 'ok' : 'no';
  return 'no';
}

// Only succeeds (and clears `placing`) when the target is actually legal
// — clicking a dimmed/illegal socket is a deliberate no-op rather than
// cancelling the selection, so a mis-click doesn't lose the player's
// place.
function attemptPlaceInWeapon(state: GameState, key: WeaponKey): void {
  if (!placing) return;
  if (placing.kind === 'gem') {
    if (socketGem(state, key, placing.instance)) placing = null;
  } else if (placing.kind === 'extension') {
    if (socketExtension(state, key, placing.instance)) placing = null;
  }
}

function attemptPlaceInCore(state: GameState): void {
  if (!placing || placing.kind !== 'coreGem') return;
  if (socketCoreGem(state, placing.instance)) placing = null;
}

// Full rebuild on every change, same pattern ui/upgradeCards.ts already
// uses for its card panel — the whole screen is small (at most 7 weapon
// rows, 3 core slots, and a bounded inventory), and a full rebuild is far
// simpler than diffing socket counts, stat text and placing highlights
// separately.
export function renderInventory(refs: InventoryRefs, state: GameState): void {
  lastRenderState = state;

  const unsocketed = state.gemInventory.length;
  refs.points.textContent =
    `${state.enhancementPool} point${state.enhancementPool === 1 ? '' : 's'} unspent` +
    (unsocketed > 0 ? ` · ${unsocketed} unsocketed gem${unsocketed === 1 ? '' : 's'}` : '');

  renderHint(refs);

  refs.weapons.innerHTML = '';
  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    const lvl = state.weapons[key];
    if (lvl === undefined) continue; // absent means never equipped; 0 means equipped but unspent (S9 Q4) and still renders
    const row = renderWeaponRow(
      key,
      lvl,
      'loadout',
      state,
      {
        onInvest: (k) => {
          investPoints(state, k, 1);
          renderInventory(refs, state);
        },
        onWithdraw: (k) => {
          withdrawPoints(state, k, 1);
          renderInventory(refs, state);
        },
        onEmptySocketClick: (k) => {
          // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): placing
          // mode takes priority — an empty-dot click either places the
          // selected item or (if illegal) does nothing. Only when
          // nothing is selected does the click fall back to the pre-6A-3
          // per-row picker.
          if (placing) attemptPlaceInWeapon(state, k);
          else gemPickerFor = gemPickerFor === k ? null : k;
          renderInventory(refs, state);
        },
        onUnsocketGem: (k, gemId) => {
          unsocketGem(state, k, gemId);
          renderInventory(refs, state);
        },
        onSocketGem: (k, gemId) => {
          const instance = state.gemInventory.find((g) => g.id === gemId);
          if (instance) socketGem(state, k, instance);
          gemPickerFor = null;
          renderInventory(refs, state);
        },
        onUnsocketExtension: (k, extId) => {
          unsocketExtension(state, k, extId);
          renderInventory(refs, state);
        },
      },
      undefined,
      gemPickerFor === key,
      highlightFor(state, key),
    );
    refs.weapons.appendChild(row);
  }

  renderCoreRow(refs, state);
  renderExtensionSection(refs, state);
  renderCoreGemSection(refs, state);
  renderGemSection(refs, state);
}

function renderHint(refs: InventoryRefs): void {
  if (!placing) {
    refs.hint.textContent = 'Click a gem, extension, or core gem below, then click a socket to place it.';
    refs.hint.classList.remove('inv-hint-active');
    return;
  }
  let label: string;
  if (placing.kind === 'gem') {
    label = gemName(placing.instance.kind);
  } else if (placing.kind === 'extension') {
    const weaponDef = WEAPON_DEFS[placing.instance.weaponKey];
    label = `${weaponDef?.name ?? placing.instance.weaponKey}: ${PLACEHOLDER_EXTENSION_NAME}`;
  } else {
    label = PASSIVE_DEFS[placing.instance.kind].name;
  }
  refs.hint.textContent = `Placing: ${label} — click a lit socket, or click it again to cancel.`;
  refs.hint.classList.add('inv-hint-active');
}

function renderCoreRow(refs: InventoryRefs, state: GameState): void {
  refs.core.innerHTML = '';
  for (const kind of state.coreGems) {
    const slot = document.createElement('div');
    if (kind) {
      const def = PASSIVE_DEFS[kind];
      slot.className = 'core-slot filled';
      slot.innerHTML = `<span class="core-slot-icon">${def.icon}</span><span class="core-slot-name">${def.name}</span>`;
      slot.title = `${def.name} — click to unsocket`;
      // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S6): a filled core
      // slot is clickable now, mirroring gems/extensions — unsocketing
      // removes the gem's effect (systems/passives.ts's
      // removeCoreGemEffect), including the maxHp clamp the owner's rule
      // requires.
      slot.addEventListener('click', () => {
        unsocketCoreGem(state, kind);
        renderInventory(refs, state);
      });
    } else {
      slot.className = 'core-slot core-slot-empty';
      slot.textContent = '+';
      if (placing?.kind === 'coreGem') {
        slot.classList.add('core-slot-ok');
        slot.title = 'Click to place it here';
      } else if (placing) {
        slot.classList.add('core-slot-no');
        slot.title = "Doesn't fit here";
      } else {
        slot.title = 'Empty core slot';
      }
      slot.addEventListener('click', () => {
        attemptPlaceInCore(state);
        renderInventory(refs, state);
      });
    }
    refs.core.appendChild(slot);
  }
}

function emptyNote(text: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'inv-empty';
  div.textContent = text;
  return div;
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S5): the three-section
// side panel the owner asked for — "the inventory itself has to have 3
// sections for extensions, core gems and support gems." Support gems can
// stack (duplicates are fine, arsenal plan S5), so they group by kind
// with a count; extensions and core gems can't (S3a's uniqueness
// invariant; core gems were never allowed to duplicate at all), so each
// renders as its own entry.
function renderGemSection(refs: InventoryRefs, state: GameState): void {
  refs.gemList.innerHTML = '';
  const counts = new Map<GemKey, number>();
  for (const g of state.gemInventory) counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);

  if (counts.size === 0) {
    refs.gemList.appendChild(emptyNote('None yet.'));
    return;
  }

  for (const [kind, count] of counts) {
    const selected = placing?.kind === 'gem' && placing.instance.kind === kind;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = selected ? 'inv-entry inv-entry-selected' : 'inv-entry';
    btn.innerHTML =
      `<span class="inv-entry-icon">${gemIcon(kind)}</span>` +
      `<span class="inv-entry-name">${gemName(kind)}</span>` +
      (count > 1 ? `<span class="inv-entry-count">x${count}</span>` : '');
    btn.addEventListener('click', () => {
      if (selected) {
        placing = null;
      } else {
        const instance = state.gemInventory.find((g) => g.kind === kind)!;
        placing = { kind: 'gem', instance };
        gemPickerFor = null; // placing mode and the old per-row picker are mutually exclusive
      }
      renderInventory(refs, state);
    });
    refs.gemList.appendChild(btn);
  }
}

function renderExtensionSection(refs: InventoryRefs, state: GameState): void {
  refs.extList.innerHTML = '';
  if (state.extensionInventory.length === 0) {
    refs.extList.appendChild(emptyNote('None yet.'));
    return;
  }

  for (const ext of state.extensionInventory) {
    const weaponDef = WEAPON_DEFS[ext.weaponKey];
    const selected = placing?.kind === 'extension' && placing.instance.id === ext.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = selected ? 'inv-entry inv-entry-selected' : 'inv-entry';
    btn.innerHTML =
      `<span class="inv-entry-icon">${weaponDef?.icon ?? '?'}</span>` +
      `<span class="inv-entry-name">${weaponDef?.name ?? ext.weaponKey}: ${PLACEHOLDER_EXTENSION_NAME}</span>` +
      `<span class="inv-entry-count">Lv${ext.level}</span>`;
    btn.addEventListener('click', () => {
      if (selected) {
        placing = null;
      } else {
        placing = { kind: 'extension', instance: ext };
        gemPickerFor = null;
      }
      renderInventory(refs, state);
    });
    refs.extList.appendChild(btn);
  }
}

function renderCoreGemSection(refs: InventoryRefs, state: GameState): void {
  refs.coreGemList.innerHTML = '';
  if (state.coreGemInventory.length === 0) {
    refs.coreGemList.appendChild(emptyNote('None yet.'));
    return;
  }

  for (const c of state.coreGemInventory) {
    const def = PASSIVE_DEFS[c.kind];
    const selected = placing?.kind === 'coreGem' && placing.instance.id === c.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = selected ? 'inv-entry inv-entry-selected' : 'inv-entry';
    btn.innerHTML = `<span class="inv-entry-icon">${def.icon}</span><span class="inv-entry-name">${def.name}</span>`;
    btn.addEventListener('click', () => {
      if (selected) {
        placing = null;
      } else {
        placing = { kind: 'coreGem', instance: c };
        gemPickerFor = null;
      }
      renderInventory(refs, state);
    });
    refs.coreGemList.appendChild(btn);
  }
}
