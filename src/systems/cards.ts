import type { ExtensionSlot, GameState } from '../state';
import { CORE_GEM_KEYS, type CoreGemKey } from '../tuning/coreGems';
import {
  PLACEHOLDER_EXTENSION_KIND,
  PLACEHOLDER_EXTENSION_MAX_LEVEL,
} from '../tuning/extensions';
import { PASSIVE_DEFS } from '../tuning/passives';
import type { PassiveKey, WeaponKey } from '../types';
import { freeSlots } from './sockets';

// Phase 5B (docs/plans/phase-5b-framework.md S4): weapon LEVEL cards are
// gone entirely (Decision 40) — weapon power comes only from
// state.enhancementPool spend (S3), never a card pick. Cards now grant
// *access* (a new extension level or a core gem) rather than power
// directly.
//
// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S4): the pool never
// offers a weapon either, by the project owner's 2026-08-09 rule — the
// deck is chosen once, before the run, on the pre-run select screen, and
// is fixed for the run's duration. The `newWeapon` kind that used to live
// here is deleted outright, not merely unreachable: it was already dead
// in practice (the starting deck always filled every slot), and Phase
// 6-0 makes that permanent by design rather than by accident.
export type CardChoice =
  | { kind: 'extension'; weaponKey: WeaponKey; extKind: string; nextLevel: 1 | 2 | 3 }
  | { kind: 'coreGem'; key: CoreGemKey }
  | { kind: 'passive'; key: PassiveKey; nextLevel: number; isNew: boolean }
  | { kind: 'heal' };

// damage/atkSpeed (Amplifier/Overclock) become per-weapon socketed gems in
// Phase 6A (arsenal plan S9A) — until then they stay on the pre-5B
// unrestricted passive-card mechanism, the one deliberate exception to
// "everything routes through sockets now." See
// docs/plans/phase-5b-framework.md S6.
const LEGACY_PASSIVE_KEYS: PassiveKey[] = (Object.keys(PASSIVE_DEFS) as PassiveKey[]).filter(
  (k) => !(CORE_GEM_KEYS as readonly PassiveKey[]).includes(k),
);

function findExtension(state: GameState, weaponKey: WeaponKey, extKind: string): ExtensionSlot | undefined {
  return state.weaponSockets[weaponKey]?.extensions.find((e) => e.kind === extKind);
}

// Extension candidates, gated on free weapon sockets so a dead card
// (nowhere to put the pick) is never offered. Legacy passives
// (damage/atkSpeed) are pooled in here too since they still compete for
// the same 4 draw slots. No weapon ever appears here (S4 above) — every
// key in state.weapons was fixed by the pre-run select screen and stays
// fixed for the run's duration.
export function buildWeaponSidePool(state: GameState): CardChoice[] {
  const pool: CardChoice[] = [];

  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    if (freeSlots(state, key) <= 0) continue;
    const existing = findExtension(state, key, PLACEHOLDER_EXTENSION_KIND);
    const currentLevel = existing?.level ?? 0;
    if (currentLevel >= PLACEHOLDER_EXTENSION_MAX_LEVEL) continue; // owner's rule: maxed, gone for good
    pool.push({
      kind: 'extension',
      weaponKey: key,
      extKind: PLACEHOLDER_EXTENSION_KIND,
      nextLevel: (currentLevel + 1) as 1 | 2 | 3,
    });
  }

  for (const key of LEGACY_PASSIVE_KEYS) {
    const def = PASSIVE_DEFS[key];
    const lvl = state.passives[key] ?? 0;
    if (lvl < def.maxLevel) pool.push({ kind: 'passive', key, nextLevel: lvl + 1, isNew: lvl === 0 });
  }

  return pool;
}

export function buildCoreGemPool(state: GameState): CardChoice[] {
  if (!state.coreGems.includes(null)) return []; // exhausted — every socket full, never offer a dead card
  return CORE_GEM_KEYS.filter((key) => !state.coreGems.includes(key)).map((key) => ({ kind: 'coreGem', key }));
}

// Unbiased Fisher-Yates — sort(() => Math.random() - 0.5) is not a
// uniform permutation and would have corrupted the pool-dilution
// measurement the Phase 5B gate exists to take (arsenal plan S13 audit
// finding, docs/plans/phase-5b-framework.md S6).
export function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const CARDS_PER_DRAW = 4;

// Core gems get one guaranteed slot every second level-up rather than a
// separate draw or a slot in every draw (docs/plans/phase-5b-framework.md
// S4, settled 2026-08-08) — a separate draw goes dead once the 3 sockets
// fill, and a slot in every draw permanently spends a quarter of the pool
// on defence.
export function pickCards(state: GameState): CardChoice[] {
  const weaponSide = shuffled(buildWeaponSidePool(state));
  const wantsCoreSlot = state.tower.level % 2 === 0;
  const coreCandidates = wantsCoreSlot ? shuffled(buildCoreGemPool(state)) : [];

  const choices: CardChoice[] = [];
  if (coreCandidates.length > 0) choices.push(coreCandidates[0]!);
  for (const c of weaponSide) {
    if (choices.length >= CARDS_PER_DRAW) break;
    choices.push(c);
  }

  return choices.length > 0 ? choices : [{ kind: 'heal' }];
}

// The state-mutation half of picking a card — separated from
// ui/upgradeCards.ts's DOM/overlay bookkeeping (closing the card panel,
// re-showing it for a queued level-up) so it's testable directly.
export function applyCardChoice(state: GameState, choice: CardChoice): void {
  if (choice.kind === 'extension') {
    const sockets = (state.weaponSockets[choice.weaponKey] ??= { extensions: [], gems: [] });
    const existing = sockets.extensions.find((e) => e.kind === choice.extKind);
    if (existing) existing.level = choice.nextLevel;
    else sockets.extensions.push({ kind: choice.extKind, level: choice.nextLevel });
  } else if (choice.kind === 'coreGem') {
    const idx = state.coreGems.indexOf(null);
    if (idx !== -1) {
      state.coreGems[idx] = choice.key;
      state.passives[choice.key] = (state.passives[choice.key] ?? 0) + 1;
      if (choice.key === 'maxHp') {
        state.tower.maxHp += 20;
        state.tower.hp = Math.min(state.tower.maxHp, state.tower.hp + 20);
      }
    }
  } else if (choice.kind === 'passive') {
    state.passives[choice.key] = choice.nextLevel;
  } else {
    state.tower.hp = state.tower.maxHp;
  }
}
