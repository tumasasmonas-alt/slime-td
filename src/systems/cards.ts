import type { ExtensionSlot, GameState } from '../state';
import { BUNDLE_INTERVAL, GEM_BUNDLES, type GemBundle } from '../tuning/bundles';
import { CORE_GEM_KEYS, type CoreGemKey } from '../tuning/coreGems';
import {
  PLACEHOLDER_EXTENSION_KIND,
  PLACEHOLDER_EXTENSION_MAX_LEVEL,
} from '../tuning/extensions';
import { ALL_GEM_KEYS } from '../tuning/gems';
import type { GemKey, WeaponKey } from '../types';
import { gemHasLegalHome } from './gemSockets';
import { freeSlots } from './sockets';

// Phase 5B (docs/plans/phase-5b-framework.md S4): weapon LEVEL cards are
// gone entirely (Decision 40) — weapon power comes only from
// state.enhancementPool spend (S3), never a card pick. Cards now grant
// *access* (a new extension level, a gem instance, or a core gem) rather
// than power directly.
//
// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S4): the pool never
// offers a weapon either, by the project owner's 2026-08-09 rule — the
// deck is chosen once, before the run, on the pre-run select screen, and
// is fixed for the run's duration.
//
// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6a): `passive` is
// gone too — it existed only for the legacy damage/atkSpeed passives,
// which are deleted now that Amplifier/Overclock exist as real gems.
//
// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S8): 'bundle' is the
// pacing beat the level-up loop had none of — every BUNDLE_INTERVAL
// levels, the normal draw is replaced by three thematic packages instead
// of four atoms, and picking one grants every gem it holds.
export type CardChoice =
  | { kind: 'extension'; weaponKey: WeaponKey; extKind: string; nextLevel: 1 | 2 | 3 }
  | { kind: 'gem'; key: GemKey }
  | { kind: 'coreGem'; key: CoreGemKey }
  | { kind: 'bundle'; bundle: GemBundle }
  | { kind: 'heal' };

function findExtension(state: GameState, weaponKey: WeaponKey, extKind: string): ExtensionSlot | undefined {
  return state.weaponSockets[weaponKey]?.extensions.find((e) => e.kind === extKind);
}

// Extension and gem candidates, both gated on free weapon sockets so a
// dead card (nowhere to put the pick) is never offered — no weapon ever
// appears here (S4 above), every key in state.weapons was fixed by the
// pre-run select screen and stays fixed for the run's duration.
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

  for (const key of ALL_GEM_KEYS) {
    if (gemHasLegalHome(state, key)) pool.push({ kind: 'gem', key });
  }

  return pool;
}

export function buildCoreGemPool(state: GameState): CardChoice[] {
  if (!state.coreGems.includes(null)) return []; // exhausted — every socket full, never offer a dead card
  return CORE_GEM_KEYS.filter((key) => !state.coreGems.includes(key)).map((key) => ({ kind: 'coreGem', key }));
}

// A bundle is offerable only if every gem it holds has somewhere legal to
// go — arsenal plan S11's no-dead-card rule applied at package
// granularity, not just per-atom.
export function buildBundlePool(state: GameState): CardChoice[] {
  return GEM_BUNDLES.filter((bundle) => bundle.gems.every((g) => gemHasLegalHome(state, g))).map((bundle) => ({
    kind: 'bundle',
    bundle,
  }));
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

export const BUNDLES_PER_DRAW = 3;

// Core gems get one guaranteed slot every second level-up rather than a
// separate draw or a slot in every draw (docs/plans/phase-5b-framework.md
// S4, settled 2026-08-08) — a separate draw goes dead once the 3 sockets
// fill, and a slot in every draw permanently spends a quarter of the pool
// on defence.
//
// Phase 6A-2: a bundle level (docs/plans/phase-6a2-behaviour-gems.md S8)
// pre-empts both the core-gem cadence and the normal weapon-side draw for
// that level-up — one special beat, not stacked on top of the ordinary
// one. Falls through to the ordinary draw if no bundle is currently
// legal (e.g. very early, before enough sockets exist for a whole
// package), so a bundle level is never a guaranteed dead draw.
export function pickCards(state: GameState): CardChoice[] {
  if (state.tower.level % BUNDLE_INTERVAL === 0) {
    const bundles = shuffled(buildBundlePool(state)).slice(0, BUNDLES_PER_DRAW);
    if (bundles.length > 0) return bundles;
  }

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
//
// 'gem' grants an instance into inventory only — it does NOT auto-socket
// (docs/plans/phase-6a1-gem-foundation.md S10 Q1: the *caller* opens the
// socket picker immediately afterward, reading the just-created instance
// off the end of state.gemInventory, so a pick is never invisible without
// this function needing to know about UI at all).
export function applyCardChoice(state: GameState, choice: CardChoice): void {
  if (choice.kind === 'extension') {
    const sockets = (state.weaponSockets[choice.weaponKey] ??= { extensions: [], gems: [] });
    const existing = sockets.extensions.find((e) => e.kind === choice.extKind);
    if (existing) existing.level = choice.nextLevel;
    else sockets.extensions.push({ kind: choice.extKind, level: choice.nextLevel });
  } else if (choice.kind === 'gem') {
    state.gemInventory.push({ id: state.nextGemId++, kind: choice.key });
  } else if (choice.kind === 'bundle') {
    for (const key of choice.bundle.gems) {
      state.gemInventory.push({ id: state.nextGemId++, kind: key });
    }
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
  } else {
    state.tower.hp = state.tower.maxHp;
  }
}
