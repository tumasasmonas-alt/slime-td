import type { GameState } from '../state';
import { EXTENSION_MAX_LEVEL, extensionDesc, extensionIcon, extensionName } from '../tuning/extensions';
import { gemGenericDesc, gemIcon, gemName } from '../tuning/gems';
import { PASSIVE_DEFS } from '../tuning/passives';
import { WEAPON_DEFS } from '../tuning/weapons';
import { applyCardChoice, pickCards, type CardChoice } from '../systems/cards';

export interface CardRefs {
  overlay: HTMLElement;
  cards: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Phase 5C (docs/plans/phase-5c-inventory-ui.md S5): "just got a point" is
// exactly when a player wants to spend one, so the level-up screen gets a
// direct path into the inventory rather than making the player close out
// and hunt for the HUD button. main.ts owns the actual open/close
// coordination (which of the two overlays is "underneath"), same as
// initOverlays(onStart) already does for the start/restart buttons.
//
// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10 Q1): picking a
// 'gem' card routes through the same open-the-inventory path as Manage
// Loadout, via onGemPicked (captured below, same module-level-callback
// pattern ui/weaponSelect.ts already uses for its transient UI state) —
// "just picked a gem" is exactly the same "want to spend it now" moment
// 5C already built this path for, so a gem is never invisible between
// the pick and the socket the way the 2026-08-05 "cards appear to do
// nothing" playtest finding described.
//
// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): 'extension' and
// 'coreGem' now bank instead of applying immediately, so they route
// through this exact same callback — the name stayed onGemPicked rather
// than being generalized, since "just banked something, want to place it"
// is the same moment regardless of which of the four bankable kinds it
// was.
let onGemPicked: () => void = () => {};

export function initUpgradeCards(onManageLoadout: () => void, onGemPickedCb: () => void): CardRefs {
  const refs = { overlay: requireEl('upgrade-overlay'), cards: requireEl('cards') };
  requireEl('manage-loadout-btn').addEventListener('click', onManageLoadout);
  onGemPicked = onGemPickedCb;
  return refs;
}

// Consumes one pending level-up per call, showing exactly one card set
// per level regardless of how many thresholds a single XP grant crossed
// — see systems/xp.ts and docs/BACKLOG.md "A single XP grant
// crossing two levels ate an upgrade".
export function syncUpgradeOverlay(refs: CardRefs, state: GameState): void {
  if (state.pendingLevelUps <= 0) return;
  showUpgradeCards(refs, state);
}

function showUpgradeCards(refs: CardRefs, state: GameState): void {
  state.paused = true;
  refs.cards.innerHTML = '';
  const choices = pickCards(state);
  for (const choice of choices) {
    const div = document.createElement('div');
    const { icon, name, rank, desc } = describeCard(choice);
    div.className = 'card';
    div.innerHTML = `<div class="icon">${icon}</div><div class="name">${name}</div><div class="rank">${rank}</div><div class="desc">${desc}</div>`;
    div.addEventListener('click', () => selectCard(refs, state, choice));
    refs.cards.appendChild(div);
  }
  refs.overlay.classList.remove('hidden');
}

function describeCard(choice: CardChoice): { icon: string; name: string; rank: string; desc: string } {
  if (choice.kind === 'extension') {
    const weaponDef = WEAPON_DEFS[choice.weaponKey];
    return {
      icon: extensionIcon(choice.extKind),
      name: `${weaponDef?.name ?? choice.weaponKey} — ${extensionName(choice.extKind)}`,
      rank: `Lv${choice.nextLevel}/${EXTENSION_MAX_LEVEL}`,
      desc: extensionDesc(choice.extKind, choice.nextLevel),
    };
  }
  if (choice.kind === 'gem') {
    return { icon: gemIcon(choice.key), name: gemName(choice.key), rank: 'GEM', desc: gemGenericDesc(choice.key) };
  }
  if (choice.kind === 'coreGem') {
    const def = PASSIVE_DEFS[choice.key];
    return { icon: def.icon, name: def.name, rank: 'CORE GEM', desc: def.desc };
  }
  return { icon: '✚', name: 'Emergency Repair', rank: 'FULL HEAL', desc: 'Restore all core integrity.' };
}

function selectCard(refs: CardRefs, state: GameState, choice: CardChoice): void {
  applyCardChoice(state, choice);
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  refs.overlay.classList.add('hidden');
  if (choice.kind !== 'heal') {
    // S10 Q1, extended by Phase 6A-3 S4 — every kind that just banked an
    // instance (gem, extension, coreGem) drops straight into the socket
    // picker rather than re-showing cards or
    // silently unpausing; the inventory close handler (main.ts) already
    // knows how to resume whichever pending level-ups are left once the
    // player closes it. 'heal' is the only kind left with nothing to
    // place.
    onGemPicked();
  } else if (state.pendingLevelUps > 0) {
    showUpgradeCards(refs, state);
  } else {
    state.paused = false;
  }
}
