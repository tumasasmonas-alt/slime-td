import type { ExtensionInstance, GameState } from '../state';
import { BUNDLE_INTERVAL, GEM_BUNDLES, type GemBundle } from '../tuning/bundles';
import { CORE_GEM_KEYS, type CoreGemKey } from '../tuning/coreGems';
import { EXTENSION_MAX_LEVEL, EXTENSIONS_BY_WEAPON, type ExtensionKey } from '../tuning/extensions';
import { ALL_GEM_KEYS } from '../tuning/gems';
import type { GemKey, WeaponKey } from '../types';

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
//
// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): the pool stopped
// gating gems/core gems on socket availability or ownership at all, per
// the owner's rule — "it shouldn't matter if I have open sockets or
// not." This **supersedes** arsenal plan S11's no-dead-card rule: a
// gem/core-gem you can't currently place is no longer a dead card, since
// leftovers convert to currency (Phase 7) instead of being wasted.
// Extensions are the deliberate exception (S3a) — the only thing in the
// game with levels, so a re-roll of one you already own (socketed or
// banked) levels that instance in place instead of creating a new one,
// and still leaves the pool for good once maxed.
//
// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S1): "card
// pool" here means the level-up draw, never the two socket LINES a
// weapon holds them in (tuning/sockets.ts) — the two got conflated once
// mid-review and it cost a whole round trip; naming the distinction once,
// here, is cheaper than repeating it.
export type CardChoice =
  | { kind: 'extension'; weaponKey: WeaponKey; extKind: ExtensionKey; nextLevel: 1 | 2 | 3 }
  | { kind: 'gem'; key: GemKey }
  | { kind: 'coreGem'; key: CoreGemKey }
  | { kind: 'bundle'; bundle: GemBundle }
  | { kind: 'heal' };

// The extension instance for (weaponKey, extKind), wherever it currently
// lives — socketed on the weapon, or sitting unplaced in inventory. Never
// more than one exists at once (S3a's uniqueness invariant: a re-roll
// always levels this same instance rather than creating a second), so
// "find it anywhere" is a safe, unambiguous lookup, and the object this
// returns can be mutated in place regardless of which array holds it.
function findOwnedExtension(state: GameState, weaponKey: WeaponKey, extKind: ExtensionKey): ExtensionInstance | undefined {
  const socketed = state.weaponSockets[weaponKey]?.extensions.find((e) => e.kind === extKind);
  if (socketed) return socketed;
  return state.extensionInventory.find((e) => e.weaponKey === weaponKey && e.kind === extKind);
}

// Extension and gem candidates — neither gated on free weapon sockets any
// more (Phase 6A-3 S3/S3a): both bank rather than requiring somewhere to
// go immediately, so every weapon in the fixed deck is always a candidate
// for its own extension, and every gem key is always a candidate.
//
// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S6): the
// placeholder's single card-per-weapon becomes EXTENSIONS_BY_WEAPON's
// four real candidates — each independently offered, independently
// levelled, independently retired once maxed.
export function buildWeaponSidePool(state: GameState): CardChoice[] {
  const pool: CardChoice[] = [];

  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    for (const extKind of EXTENSIONS_BY_WEAPON[key] ?? []) {
      const existing = findOwnedExtension(state, key, extKind);
      const currentLevel = existing?.level ?? 0;
      if (currentLevel >= EXTENSION_MAX_LEVEL) continue; // owner's rule: maxed, gone for good
      pool.push({
        kind: 'extension',
        weaponKey: key,
        extKind,
        nextLevel: (currentLevel + 1) as 1 | 2 | 3,
      });
    }
  }

  for (const key of ALL_GEM_KEYS) {
    pool.push({ kind: 'gem', key });
  }

  return pool;
}

// Excludes a kind already owned anywhere — socketed OR banked in
// coreGemInventory. A core gem, unlike a weapon gem, is never archetype-
// specific, so there's no reason to ever hold two of the same kind; this
// mirrors the pre-6A-3 "no duplicates" rule, just checking both places a
// kind can now live instead of only the fixed 3-slot array.
export function buildCoreGemPool(state: GameState): CardChoice[] {
  const owned = new Set<CoreGemKey>([
    ...state.coreGems.filter((k): k is CoreGemKey => k !== null),
    ...state.coreGemInventory.map((c) => c.kind),
  ]);
  return CORE_GEM_KEYS.filter((key) => !owned.has(key)).map((key) => ({ kind: 'coreGem', key }));
}

// Offered unconditionally (Phase 6A-3 S3) — it used to require every gem
// a package holds to have a legal home; now a bundle's gems bank the same
// way a standalone gem pick does, so there's nothing left to gate on.
// `state` stays a parameter for symmetry with the other pool builders
// even though this one no longer reads it.
export function buildBundlePool(_state: GameState): CardChoice[] {
  return GEM_BUNDLES.map((bundle) => ({ kind: 'bundle' as const, bundle }));
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
//
// Phase 6A-3: the `{ kind: 'heal' }` fallback below stays as a genuine
// last resort, but is expected to become unreachable in practice now
// that the pool no longer goes dead on socket exhaustion — it only fires
// once literally everything (every extension maxed, every core gem
// owned) is exhausted, which needs no weapons equipped at all today
// since gems are always offered regardless.
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
// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4, S6): 'extension' and
// 'coreGem' no longer apply their effect immediately — they grant a
// banked instance, exactly like 'gem' and 'bundle' already did. The
// *caller* (ui/upgradeCards.ts) opens the inventory/socket picker
// immediately afterward for every kind that just banked something, same
// as it already did for gems — a pick is never invisible without this
// function needing to know about UI at all.
export function applyCardChoice(state: GameState, choice: CardChoice): void {
  if (choice.kind === 'extension') {
    const existing = findOwnedExtension(state, choice.weaponKey, choice.extKind);
    if (existing) {
      existing.level = choice.nextLevel; // owned already (socketed or banked) — levels this instance in place
    } else {
      state.extensionInventory.push({
        id: state.nextGemId++,
        weaponKey: choice.weaponKey,
        kind: choice.extKind,
        level: choice.nextLevel,
      });
    }
  } else if (choice.kind === 'gem') {
    state.gemInventory.push({ id: state.nextGemId++, kind: choice.key });
  } else if (choice.kind === 'bundle') {
    for (const key of choice.bundle.gems) {
      state.gemInventory.push({ id: state.nextGemId++, kind: key });
    }
  } else if (choice.kind === 'coreGem') {
    const owned = state.coreGems.includes(choice.key) || state.coreGemInventory.some((c) => c.kind === choice.key);
    if (!owned) state.coreGemInventory.push({ id: state.nextGemId++, kind: choice.key }); // defensive — buildCoreGemPool already excludes owned kinds
  } else {
    state.tower.hp = state.tower.maxHp;
  }
}
