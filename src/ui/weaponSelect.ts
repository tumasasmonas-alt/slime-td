import { WEAPON_DEFS } from '../tuning/weapons';
import type { WeaponKey } from '../types';
import { renderWeaponRow } from './weaponRow';

// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S5): the chosen deck
// is pre-run configuration, not run state. freshState() (state.ts) is
// rebuilt wholesale on every startRun(), which would destroy a deck
// stored there at exactly the moment it needs to survive — so it lives
// here instead, with one owner and an explicit lifetime. Matches the
// starting kit settled in arsenal plan S12.4: single-target, multi-
// target, area denial, the three tactical roles rather than three
// delivery types.
const DEFAULT_DECK: WeaponKey[] = ['bolt', 'chain', 'poison'];

let selectedDeck: WeaponKey[] = [...DEFAULT_DECK];

export function getDeck(): WeaponKey[] {
  return [...selectedDeck];
}

export function setDeck(deck: WeaponKey[]): void {
  selectedDeck = [...deck];
}

// Guards against a deck whose length has fallen out of step with
// weaponSlots — not reachable today (Phase 7's slot purchases don't
// exist yet, and the select screen never lets a draft leave at the wrong
// size), but starting a run with the wrong weapon count would be a
// confusing failure mode the moment a future slot count changes under a
// stored deck. Falls back to the full default kit rather than a partial
// one; getting the exact right weapons is a Phase 7 concern, not this
// guard's job.
export function resolveDeck(weaponSlots: number): WeaponKey[] {
  const deck = getDeck();
  return deck.length === weaponSlots ? deck : [...DEFAULT_DECK];
}

export interface WeaponSelectRefs {
  overlay: HTMLElement;
  list: HTMLElement;
  counter: HTMLElement;
  startBtn: HTMLButtonElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Opened from two places (docs/plans/phase-6-0-weapon-select.md S3): the
// start screen's "Choose Weapons" button and the game-over screen's
// "Change Loadout" button — both wired by ui/overlays.ts, which owns
// those two screens. This module only owns the overlay itself: the list,
// the draft selection, and its own Start/Back controls.
export function initWeaponSelect(startBtnId: string, backBtnId: string, onStart: () => void, onBack: () => void): WeaponSelectRefs {
  const refs: WeaponSelectRefs = {
    overlay: requireEl('weapon-select-overlay'),
    list: requireEl('weapon-select-list'),
    counter: requireEl('weapon-select-counter'),
    startBtn: requireEl(startBtnId) as HTMLButtonElement,
  };
  refs.startBtn.addEventListener('click', () => {
    if (draft.length !== requiredSlots) return; // the button is disabled at this point anyway — belt and suspenders
    setDeck(draft);
    onStart();
  });
  requireEl(backBtnId).addEventListener('click', onBack);
  return refs;
}

// The in-progress selection while the overlay is open. Separate from
// selectedDeck so Back can discard edits — nothing commits until Start is
// pressed, matching how the rest of the game never applies a pick until
// it's clicked (ui/upgradeCards.ts, ui/inventory.ts).
let draft: WeaponKey[] = [];
let requiredSlots = 3;

export function openWeaponSelect(refs: WeaponSelectRefs, weaponSlots: number): void {
  requiredSlots = weaponSlots;
  const current = getDeck();
  draft = current.length === weaponSlots ? current : [];
  renderList(refs);
  refs.overlay.classList.remove('hidden');
}

export function closeWeaponSelect(refs: WeaponSelectRefs): void {
  refs.overlay.classList.add('hidden');
}

function renderList(refs: WeaponSelectRefs): void {
  refs.list.innerHTML = '';
  const atCapacity = draft.length >= requiredSlots;
  for (const key of Object.keys(WEAPON_DEFS) as WeaponKey[]) {
    const selected = draft.includes(key);
    const row = renderWeaponRow(
      key,
      1,
      'select',
      undefined,
      {
        onToggle: () => {
          draft = draft.includes(key) ? draft.filter((k) => k !== key) : [...draft, key];
          renderList(refs);
        },
      },
      { selected, disabled: atCapacity },
    );
    refs.list.appendChild(row);
  }
  refs.counter.textContent = `${draft.length} of ${requiredSlots} slots filled`;
  refs.startBtn.disabled = draft.length !== requiredSlots;
}

// The small icon row shown on the start and game-over screens (S3) so
// the deck about to be used is visible without opening the overlay.
export function renderDeckLine(el: HTMLElement): void {
  el.innerHTML = getDeck()
    .map((key) => `<span class="deck-line-icon">${WEAPON_DEFS[key]?.icon ?? '?'}</span>`)
    .join('');
}
