import type { GameState } from '../state';
import {
  PLACEHOLDER_EXTENSION_DESC,
  PLACEHOLDER_EXTENSION_MAX_LEVEL,
  PLACEHOLDER_EXTENSION_NAME,
} from '../tuning/extensions';
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
export function initUpgradeCards(onManageLoadout: () => void): CardRefs {
  const refs = { overlay: requireEl('upgrade-overlay'), cards: requireEl('cards') };
  requireEl('manage-loadout-btn').addEventListener('click', onManageLoadout);
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
    div.className = 'card' + (choice.kind === 'newWeapon' ? ' new' : '');
    div.innerHTML = `<div class="icon">${icon}</div><div class="name">${name}</div><div class="rank">${rank}</div><div class="desc">${desc}</div>`;
    div.addEventListener('click', () => selectCard(refs, state, choice));
    refs.cards.appendChild(div);
  }
  refs.overlay.classList.remove('hidden');
}

function describeCard(choice: CardChoice): { icon: string; name: string; rank: string; desc: string } {
  if (choice.kind === 'newWeapon') {
    const def = WEAPON_DEFS[choice.key];
    if (!def) throw new Error(`No weapon def for ${choice.key}`);
    return { icon: def.icon, name: def.name, rank: 'NEW WEAPON', desc: def.desc(1) };
  }
  if (choice.kind === 'extension') {
    const weaponDef = WEAPON_DEFS[choice.weaponKey];
    return {
      icon: weaponDef?.icon ?? '🔧',
      name: `${weaponDef?.name ?? choice.weaponKey} — ${PLACEHOLDER_EXTENSION_NAME}`,
      rank: `Lv${choice.nextLevel}/${PLACEHOLDER_EXTENSION_MAX_LEVEL}`,
      desc: PLACEHOLDER_EXTENSION_DESC(choice.nextLevel),
    };
  }
  if (choice.kind === 'coreGem') {
    const def = PASSIVE_DEFS[choice.key];
    return { icon: def.icon, name: def.name, rank: 'CORE GEM', desc: def.desc };
  }
  if (choice.kind === 'passive') {
    const def = PASSIVE_DEFS[choice.key];
    return {
      icon: def.icon,
      name: def.name,
      rank: choice.isNew ? 'NEW' : `Level ${choice.nextLevel} / ${def.maxLevel}`,
      desc: def.desc,
    };
  }
  return { icon: '✚', name: 'Emergency Repair', rank: 'FULL HEAL', desc: 'Restore all core integrity.' };
}

function selectCard(refs: CardRefs, state: GameState, choice: CardChoice): void {
  applyCardChoice(state, choice);
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  refs.overlay.classList.add('hidden');
  if (state.pendingLevelUps > 0) {
    showUpgradeCards(refs, state);
  } else {
    state.paused = false;
  }
}
