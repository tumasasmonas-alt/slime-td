import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { BUNDLE_INTERVAL, GEM_BUNDLES } from '../tuning/bundles';
import { applyCardChoice, buildBundlePool, buildCoreGemPool, buildWeaponSidePool, pickCards, shuffled, type CardChoice } from './cards';

describe('shuffled', () => {
  it('returns a permutation — same elements, same length', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(arr);
    expect(out).toHaveLength(arr.length);
    expect([...out].sort()).toEqual(arr);
  });

  it('does not mutate the input', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffled(arr);
    expect(arr).toEqual(copy);
  });
});

describe('buildWeaponSidePool — weapon level cards are gone (Decision 40)', () => {
  it('never offers a weapon-level card kind — only extension/gem/coreGem/heal', () => {
    const state = freshState();
    state.weapons.bolt = 5;
    const pool = buildWeaponSidePool(state);
    for (const c of pool) {
      expect(c.kind).not.toBe('weapon');
    }
  });

  // Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S4): the pool never
  // offers a weapon at all, by the project owner's 2026-08-09 rule — the
  // deck is chosen once, on the pre-run select screen, and is fixed for
  // the run. Written as an invariant over CardChoice['kind'] rather than
  // checking for the absence of a deleted variant, so it stays meaningful
  // if a future card kind is ever added.
  it('never offers a card that would change which weapons are equipped', () => {
    const state = freshState();
    state.weaponSlots = 3;
    state.weapons.bolt = 1;

    const pool = buildWeaponSidePool(state);
    const allowedKinds: CardChoice['kind'][] = ['extension', 'gem', 'coreGem', 'heal'];
    for (const c of pool) {
      expect(allowedKinds).toContain(c.kind);
    }
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): supersedes the
  // pre-6A-3 "never offers an extension with no free socket" rule — an
  // extension now banks into extensionInventory instead of requiring
  // somewhere to go immediately, per the owner's "shouldn't matter if I
  // have open sockets" call.
  it('offers an extension for a weapon even with no free socket — it banks instead', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] }; // socket full

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(true);
  });

  it("a maxed extension (level 3) is never offered again — the owner's rule", () => {
    const state = freshState();
    state.weapons.bolt = 24; // plenty of sockets
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 3 }], gems: [] };

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(false);
  });

  it('a maxed extension sitting unplaced in inventory is also never offered again', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.extensionInventory = [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 3 }];

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(false);
  });

  it('offers the extension at its next level, not always level 1, when socketed', () => {
    const state = freshState();
    state.weapons.bolt = 24;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] };

    const pool = buildWeaponSidePool(state);
    const ext = pool.find((c) => c.kind === 'extension' && c.weaponKey === 'bolt');
    expect(ext).toBeDefined();
    if (ext?.kind === 'extension') expect(ext.nextLevel).toBe(2);
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3a): ownership is
  // read wherever the instance lives, not just when socketed — the same
  // lookup findOwnedExtension() does for applyCardChoice's leveling.
  it('offers the extension at its next level when it is sitting unplaced in inventory too', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.extensionInventory = [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 1 }];

    const pool = buildWeaponSidePool(state);
    const ext = pool.find((c) => c.kind === 'extension' && c.weaponKey === 'bolt');
    expect(ext).toBeDefined();
    if (ext?.kind === 'extension') expect(ext.nextLevel).toBe(2);
  });

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S6a): gems replace
  // the legacy damage/atkSpeed passive cards entirely.
  it('offers gem cards for an equipped weapon with a free socket', () => {
    const state = freshState();
    state.weapons.bolt = 1; // socketCount(1) = 1, free
    const pool = buildWeaponSidePool(state);
    const gemKeys = pool.filter((c) => c.kind === 'gem').map((c) => (c.kind === 'gem' ? c.key : null));
    expect(gemKeys).toContain('amplifier'); // supports every archetype, bolt included
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): the exact case
  // that produced the "only Emergency Repair offered" playtest finding —
  // every socket everywhere full, gems must still be offered.
  it('offers a gem even with no free socket anywhere in the deck', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] }; // the one socket is full
    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'gem')).toBe(true);
  });

  it('offers a gem already socketed in every equipped weapon that could hold it — duplicates are fine now', () => {
    const state = freshState();
    state.weapons.bolt = 3; // socketCount(3) = 2, one free
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    const pool = buildWeaponSidePool(state);
    const amplifierOffered = pool.some((c) => c.kind === 'gem' && c.key === 'amplifier');
    expect(amplifierOffered).toBe(true);
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): the pool is
  // socket-blind AND ownership-blind for gems, per the plan as approved —
  // no archetype-legality gate survives either, since a gem with nowhere
  // to go now just banks and eventually converts to currency (Phase 7)
  // instead of being a "dead" card. Supersedes the pre-6A-3 test of the
  // same name that asserted the opposite.
  it('offers Extension and Velocity even for an archetype that refuses them — the pool no longer checks legality either', () => {
    const state = freshState();
    state.weapons.immolation = 1; // 'ring' — Extension and Velocity both refuse it
    const pool = buildWeaponSidePool(state);
    const gemKeys = pool.filter((c) => c.kind === 'gem').map((c) => (c.kind === 'gem' ? c.key : null));
    expect(gemKeys).toContain('extension');
    expect(gemKeys).toContain('velocity');
    expect(gemKeys).toContain('amplifier');
  });
});

describe('buildCoreGemPool', () => {
  it('offers all five core gems with every socket empty', () => {
    const state = freshState();
    expect(buildCoreGemPool(state)).toHaveLength(5);
  });

  it('excludes a kind already socketed — no duplicates', () => {
    const state = freshState();
    state.coreGems = ['maxHp', null, null];
    const kinds = buildCoreGemPool(state).map((c) => (c.kind === 'coreGem' ? c.key : null));
    expect(kinds).not.toContain('maxHp');
    expect(kinds).toHaveLength(4);
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): a kind already
  // sitting unplaced in coreGemInventory is owned too — core gems never
  // duplicate, socketed or not.
  it('excludes a kind already sitting unplaced in coreGemInventory', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'regen' }];
    const kinds = buildCoreGemPool(state).map((c) => (c.kind === 'coreGem' ? c.key : null));
    expect(kinds).not.toContain('regen');
    expect(kinds).toHaveLength(4);
  });

  // Phase 6A-3: supersedes the pre-6A-3 "empty once all three sockets are
  // full" rule — core gems bank now, so a full core row no longer stops
  // the other, still-unowned kinds from being offered. This is the exact
  // shape of the playtest-found bug for core gems specifically.
  it('still offers unowned kinds even once all three core sockets are full', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
    const kinds = buildCoreGemPool(state).map((c) => (c.kind === 'coreGem' ? c.key : null));
    expect(kinds).toEqual(expect.arrayContaining(['pickup', 'xpGain']));
  });

  it('is empty only once every kind is owned somewhere — socketed or banked', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
    state.coreGemInventory = [
      { id: 1, kind: 'pickup' },
      { id: 2, kind: 'xpGain' },
    ];
    expect(buildCoreGemPool(state)).toHaveLength(0);
  });
});

describe('pickCards — core-gem cadence (settled 2026-08-08: every second level-up)', () => {
  it('guarantees one core-gem card on an even level', () => {
    const state = freshState();
    state.tower.level = 2;
    const choices = pickCards(state);
    expect(choices.some((c) => c.kind === 'coreGem')).toBe(true);
  });

  it('offers no core-gem card on an odd level', () => {
    const state = freshState();
    state.tower.level = 3;
    const choices = pickCards(state);
    expect(choices.some((c) => c.kind === 'coreGem')).toBe(false);
  });

  it('falls back to a weapon-side card on an even level when the core pool is genuinely exhausted (every kind owned somewhere)', () => {
    const state = freshState();
    state.tower.level = 4;
    state.coreGems = ['maxHp', 'regen', 'armor'];
    state.coreGemInventory = [
      { id: 1, kind: 'pickup' },
      { id: 2, kind: 'xpGain' },
    ]; // every kind now owned somewhere — genuinely exhausted, not just socket-full
    state.weapons.bolt = 1;

    const choices = pickCards(state);
    expect(choices.some((c) => c.kind === 'coreGem')).toBe(false);
    expect(choices.length).toBeGreaterThan(0);
  });

  it('draws up to 4 cards total', () => {
    const state = freshState();
    state.tower.level = 2;
    state.weapons.bolt = 1;
    const choices = pickCards(state);
    expect(choices.length).toBeLessThanOrEqual(4);
  });
});

describe('Phase 6A-3 — the pool never goes dead on socket exhaustion (the playtest finding)', () => {
  it('still offers gem cards with zero free sockets anywhere', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(buildWeaponSidePool(state).some((c) => c.kind === 'gem')).toBe(true);
  });

  it('still offers an extension card with zero free sockets', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] };
    expect(buildWeaponSidePool(state).some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(true);
  });

  it('still offers bundles with zero free sockets anywhere', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(buildBundlePool(state).length).toBeGreaterThan(0);
  });

  it('still offers core gem cards once all 3 sockets are full, as long as a kind is unowned', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
    expect(buildCoreGemPool(state).length).toBeGreaterThan(0);
  });

  // The regression test for the reported symptom — the heal fallback is
  // "a genuine last resort" (systems/cards.ts's own comment) that should
  // become unreachable in practice now that gems alone (ALL_GEM_KEYS,
  // unconditionally offered) keep the pool from ever emptying.
  it('never degrades to the heal fallback while any gem exists — even in the most exhausted synthetic state', () => {
    const state = freshState();
    state.tower.level = 3; // odd — no core-gem cadence slot this level
    state.coreGems = ['maxHp', 'regen', 'armor'];
    state.coreGemInventory = [
      { id: 1, kind: 'pickup' },
      { id: 2, kind: 'xpGain' },
    ]; // every core kind owned; no weapons equipped -> no extensions either
    const choices = pickCards(state);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.some((c) => c.kind === 'heal')).toBe(false);
  });

  // S3a's uniqueness invariant, exercised across a real sequence of rolls
  // rather than trusted by construction.
  it('S3a: at most one (weaponKey, kind) extension instance exists after any sequence of rolls', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 1 });
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 2 });
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 3 });

    const bankedCount = state.extensionInventory.filter((e) => e.weaponKey === 'bolt' && e.kind === 'placeholder').length;
    const socketedCount = state.weaponSockets.bolt?.extensions.filter((e) => e.kind === 'placeholder').length ?? 0;
    expect(bankedCount + socketedCount).toBe(1);
    expect(state.extensionInventory[0]!.level).toBe(3);
  });
});

describe('applyCardChoice', () => {
  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): extensions bank
  // now instead of auto-socketing — see ui/upgradeCards.ts for where the
  // "open the placement UI immediately" behaviour lives instead.
  it('extension: first pick creates a banked instance in extensionInventory, not a socket entry', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 1 });
    expect(state.extensionInventory).toHaveLength(1);
    expect(state.extensionInventory[0]).toMatchObject({ weaponKey: 'bolt', kind: 'placeholder', level: 1 });
    expect(state.weaponSockets.bolt).toBeUndefined();
  });

  it('extension: a repeat pick levels the same banked instance instead of duplicating it', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 1 });
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 2 });
    expect(state.extensionInventory).toHaveLength(1);
    expect(state.extensionInventory[0]!.level).toBe(2);
  });

  // The case the plan's own §8 flagged as the one a first draft could get
  // wrong: a card for an extension that's already SOCKETED must level it
  // in place, on the weapon — not bank a second, redundant instance.
  it('extension: a repeat pick levels an already-socketed instance in place, on the weapon', () => {
    const state = freshState();
    state.weaponSockets.bolt = { extensions: [{ id: 99, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] };
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 2 });
    expect(state.weaponSockets.bolt!.extensions).toHaveLength(1);
    expect(state.weaponSockets.bolt!.extensions[0]!.level).toBe(2);
    expect(state.extensionInventory).toHaveLength(0);
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S6): a core gem's
  // effect no longer applies at pick time — it grants a banked instance
  // only. See systems/gemSockets.test.ts for socketCoreGem/
  // unsocketCoreGem, which is where the effect (and the maxHp clamp) now
  // live.
  it('coreGem: grants a banked instance into coreGemInventory — does not fill a socket or apply the effect', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'coreGem', key: 'regen' });
    expect(state.coreGemInventory).toHaveLength(1);
    expect(state.coreGemInventory[0]!.kind).toBe('regen');
    expect(state.coreGems).not.toContain('regen');
    expect(state.passives.regen).toBeUndefined();
  });

  it('coreGem: does nothing (silently) if the kind is already owned somewhere — defensive, buildCoreGemPool already excludes it', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'pickup' }];
    applyCardChoice(state, { kind: 'coreGem', key: 'pickup' });
    expect(state.coreGemInventory).toHaveLength(1);
  });

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10 Q1): grants an
  // instance into inventory only — it does NOT auto-socket. The UI layer
  // (ui/upgradeCards.ts) is what opens the picker immediately afterward.
  it('gem: grants an unsocketed instance into gemInventory with a fresh id', () => {
    const state = freshState();
    const before = state.nextGemId;
    applyCardChoice(state, { kind: 'gem', key: 'amplifier' });
    expect(state.gemInventory).toEqual([{ id: before, kind: 'amplifier' }]);
    expect(state.nextGemId).toBe(before + 1);
  });

  it('gem: two picks grant two distinct instances, never merged into a stack', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'gem', key: 'amplifier' });
    applyCardChoice(state, { kind: 'gem', key: 'amplifier' });
    expect(state.gemInventory).toHaveLength(2);
    expect(state.gemInventory[0]!.id).not.toBe(state.gemInventory[1]!.id);
  });

  it('heal: restores hp to max', () => {
    const state = freshState();
    state.tower.hp = 10;
    applyCardChoice(state, { kind: 'heal' });
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S8): a bundle
  // grants every gem it holds in one pick.
  it('bundle: grants an instance of every gem in the package', () => {
    const state = freshState();
    const before = state.nextGemId;
    applyCardChoice(state, {
      kind: 'bundle',
      bundle: { name: 'Test Package', gems: ['multishot', 'pierce', 'velocity'] },
    });
    expect(state.gemInventory).toEqual([
      { id: before, kind: 'multishot' },
      { id: before + 1, kind: 'pierce' },
      { id: before + 2, kind: 'velocity' },
    ]);
  });
});

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S3): supersedes the
// pre-6A-3 legal-home filtering entirely — a bundle's gems bank the same
// way a standalone gem pick does now, so there's nothing left to gate on.
describe('buildBundlePool — Phase 6A-3: offered unconditionally, socket/ownership-blind', () => {
  it('offers every bundle in the catalogue regardless of equipped weapons', () => {
    const state = freshState();
    const names = buildBundlePool(state).map((c) => (c.kind === 'bundle' ? c.bundle.name : null));
    expect(names).toHaveLength(GEM_BUNDLES.length);
  });

  it('offers a bundle even when a gem it holds has nowhere legal to go', () => {
    const state = freshState();
    state.weapons.immolation = 1; // 'ring' — Velocity refuses it, and no other weapon is equipped
    const names = buildBundlePool(state).map((c) => (c.kind === 'bundle' ? c.bundle.name : null));
    expect(names).toContain('Ballistics Package'); // needs Velocity — offered anyway now
  });
});

describe('pickCards — bundle levels (Phase 6A-2, revised by 6A-3)', () => {
  it('draws bundles instead of the normal pool on a bundle-interval level', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL;
    state.weapons.bolt = 5;

    const choices = pickCards(state);

    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) expect(c.kind).toBe('bundle');
  });

  // Phase 6A-3: supersedes the pre-6A-3 "falls back when no bundle is
  // legal" test — bundles no longer check legality, so this scenario
  // (which used to force a fallback) now still draws bundles.
  it('draws bundles on a bundle level even with no weapons equipped at all', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL;
    const choices = pickCards(state);
    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) expect(c.kind).toBe('bundle');
  });

  it('draws the ordinary pool on a non-bundle level', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL + 1;
    state.weapons.bolt = 5;

    const choices = pickCards(state);

    expect(choices.some((c) => c.kind === 'bundle')).toBe(false);
  });
});
