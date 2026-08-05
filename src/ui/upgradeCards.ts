import type { GameState } from '../state';
import { PASSIVE_DEFS } from '../tuning/passives';
import { WEAPON_DEFS } from '../tuning/weapons';
import type { PassiveKey, WeaponKey } from '../types';

// Vitality, Regeneration, and Armor Plating were gated out of the card
// pool in Phase 2C (nothing damaged the core yet, so all three would have
// been dead, unverifiable picks) and un-gated here in 2D now that contact
// damage exists. See docs/DECISIONS.md.

type CardChoice =
  | { kind: 'weapon'; key: WeaponKey; nextLevel: number; isNew: boolean }
  | { kind: 'passive'; key: PassiveKey; nextLevel: number; isNew: boolean }
  | { kind: 'heal' };

export interface CardRefs {
  overlay: HTMLElement;
  cards: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

export function initUpgradeCards(): CardRefs {
  return { overlay: requireEl('upgrade-overlay'), cards: requireEl('cards') };
}

function buildCardPool(state: GameState): CardChoice[] {
  const pool: CardChoice[] = [];
  for (const key of Object.keys(WEAPON_DEFS) as WeaponKey[]) {
    const def = WEAPON_DEFS[key];
    if (!def) continue;
    const lvl = state.weapons[key] ?? 0;
    if (lvl < def.maxLevel) pool.push({ kind: 'weapon', key, nextLevel: lvl + 1, isNew: lvl === 0 });
  }
  for (const key of Object.keys(PASSIVE_DEFS) as PassiveKey[]) {
    const def = PASSIVE_DEFS[key];
    const lvl = state.passives[key] ?? 0;
    if (lvl < def.maxLevel) pool.push({ kind: 'passive', key, nextLevel: lvl + 1, isNew: lvl === 0 });
  }
  return pool;
}

function pickThree(pool: CardChoice[]): CardChoice[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 3);
  return choices.length > 0 ? choices : [{ kind: 'heal' }];
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
  const choices = pickThree(buildCardPool(state));
  for (const choice of choices) {
    const div = document.createElement('div');
    const { icon, name, rank, desc } = describeCard(choice);
    div.className = 'card' + (choice.kind !== 'heal' && choice.isNew ? ' new' : '');
    div.innerHTML = `<div class="icon">${icon}</div><div class="name">${name}</div><div class="rank">${rank}</div><div class="desc">${desc}</div>`;
    div.addEventListener('click', () => applyUpgrade(refs, state, choice));
    refs.cards.appendChild(div);
  }
  refs.overlay.classList.remove('hidden');
}

function describeCard(choice: CardChoice): { icon: string; name: string; rank: string; desc: string } {
  if (choice.kind === 'weapon') {
    const def = WEAPON_DEFS[choice.key];
    if (!def) throw new Error(`No weapon def for ${choice.key}`);
    return {
      icon: def.icon,
      name: def.name,
      rank: choice.isNew ? 'NEW WEAPON' : `Level ${choice.nextLevel} / ${def.maxLevel}`,
      desc: def.desc(choice.nextLevel),
    };
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

function applyUpgrade(refs: CardRefs, state: GameState, choice: CardChoice): void {
  if (choice.kind === 'weapon') {
    state.weapons[choice.key] = choice.nextLevel;
  } else if (choice.kind === 'passive') {
    state.passives[choice.key] = choice.nextLevel;
    if (choice.key === 'maxHp') {
      state.tower.maxHp += 20;
      state.tower.hp = Math.min(state.tower.maxHp, state.tower.hp + 20);
    }
  } else {
    state.tower.hp = state.tower.maxHp;
  }
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  refs.overlay.classList.add('hidden');
  if (state.pendingLevelUps > 0) {
    showUpgradeCards(refs, state);
  } else {
    state.paused = false;
  }
}
