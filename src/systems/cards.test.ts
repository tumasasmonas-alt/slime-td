import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { BUNDLE_INTERVAL } from '../tuning/bundles';
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

  it('never offers an extension for a weapon with no free socket', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [{ kind: 'placeholder', level: 1 }], gems: [] }; // socket full

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(false);
  });

  it('a maxed extension (level 3) is never offered again — the owner\'s rule', () => {
    const state = freshState();
    state.weapons.bolt = 24; // plenty of sockets
    state.weaponSockets.bolt = { extensions: [{ kind: 'placeholder', level: 3 }], gems: [] };

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'extension' && c.weaponKey === 'bolt')).toBe(false);
  });

  it('offers the extension at its next level, not always level 1', () => {
    const state = freshState();
    state.weapons.bolt = 24;
    state.weaponSockets.bolt = { extensions: [{ kind: 'placeholder', level: 1 }], gems: [] };

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

  it('never offers a gem with no free socket anywhere in the deck', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] }; // the one socket is full
    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'gem')).toBe(false);
  });

  it('never offers a gem already socketed in every equipped weapon that could hold it', () => {
    const state = freshState();
    state.weapons.bolt = 3; // socketCount(3) = 2, one free
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    const pool = buildWeaponSidePool(state);
    // amplifier is already IN bolt, but bolt still has a free socket — the
    // gem is legal there for a DIFFERENT kind, but not a second amplifier.
    const amplifierOffered = pool.some((c) => c.kind === 'gem' && c.key === 'amplifier');
    expect(amplifierOffered).toBe(false);
  });

  it('never offers Extension or Velocity for an archetype that refuses them', () => {
    const state = freshState();
    state.weapons.immolation = 1; // 'ring' — Extension and Velocity both refuse it
    const pool = buildWeaponSidePool(state);
    const gemKeys = pool.filter((c) => c.kind === 'gem').map((c) => (c.kind === 'gem' ? c.key : null));
    expect(gemKeys).not.toContain('extension');
    expect(gemKeys).not.toContain('velocity');
    expect(gemKeys).toContain('amplifier'); // still legal — universal
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

  it('is empty once all three sockets are full — never a dead card', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
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

  it('falls back to a weapon-side card on an even level when the core pool is exhausted', () => {
    const state = freshState();
    state.tower.level = 4;
    state.coreGems = ['maxHp', 'regen', 'armor']; // all 3 sockets full
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

  it('falls back to heal when nothing at all is offerable', () => {
    const state = freshState();
    state.tower.level = 3; // odd, no core slot
    state.coreGems = ['maxHp', 'regen', 'armor'];
    // no weapons equipped -> no extension or gem candidates either
    const choices = pickCards(state);
    expect(choices).toEqual([{ kind: 'heal' }]);
  });
});

describe('applyCardChoice', () => {
  it('extension: first pick creates the socket entry at level 1', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 1 });
    expect(state.weaponSockets.bolt?.extensions).toEqual([{ kind: 'placeholder', level: 1 }]);
  });

  it('extension: a repeat pick raises the existing entry rather than duplicating it', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 1 });
    applyCardChoice(state, { kind: 'extension', weaponKey: 'bolt', extKind: 'placeholder', nextLevel: 2 });
    expect(state.weaponSockets.bolt?.extensions).toEqual([{ kind: 'placeholder', level: 2 }]);
  });

  it('coreGem: fills the first empty socket and increments state.passives', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'coreGem', key: 'regen' });
    expect(state.coreGems).toContain('regen');
    expect(state.passives.regen).toBe(1);
  });

  it('coreGem maxHp: also raises maxHp and heals by the same amount', () => {
    const state = freshState();
    state.tower.hp = 50;
    const before = state.tower.maxHp;
    applyCardChoice(state, { kind: 'coreGem', key: 'maxHp' });
    expect(state.tower.maxHp).toBe(before + 20);
    expect(state.tower.hp).toBe(70);
  });

  it('coreGem: does nothing (silently) if somehow called with no free socket', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
    applyCardChoice(state, { kind: 'coreGem', key: 'pickup' });
    expect(state.coreGems).not.toContain('pickup');
    expect(state.passives.pickup).toBeUndefined();
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

describe('buildBundlePool — Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S8)', () => {
  it('is empty with no weapons equipped — nothing is legal anywhere', () => {
    const state = freshState();
    expect(buildBundlePool(state)).toHaveLength(0);
  });

  it('offers a bundle once every gem it holds has a legal home', () => {
    const state = freshState();
    state.weapons.bolt = 5; // socketCount(5) = 2, room for several gems on a projectile weapon
    const pool = buildBundlePool(state);
    const names = pool.map((c) => (c.kind === 'bundle' ? c.bundle.name : null));
    expect(names).toContain('Ballistics Package'); // multishot/pierce/velocity — all legal on a projectile weapon
  });

  it('never offers a bundle containing a gem with nowhere legal to go', () => {
    const state = freshState();
    state.weapons.immolation = 1; // 'ring' — Velocity refuses it, and no other weapon is equipped
    const pool = buildBundlePool(state);
    const names = pool.map((c) => (c.kind === 'bundle' ? c.bundle.name : null));
    expect(names).not.toContain('Ballistics Package'); // needs Velocity, which has nowhere to go
  });
});

describe('pickCards — bundle levels (Phase 6A-2)', () => {
  it('draws bundles instead of the normal pool on a bundle-interval level', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL;
    state.weapons.bolt = 5;

    const choices = pickCards(state);

    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) expect(c.kind).toBe('bundle');
  });

  it('falls back to the ordinary draw on a bundle level when no bundle is legal', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL;
    // No weapons equipped at all -> gemHasLegalHome is false for every
    // gem in every bundle, so none can be offered.

    const choices = pickCards(state);

    expect(choices.length).toBeGreaterThan(0);
    expect(choices.some((c) => c.kind === 'bundle')).toBe(false);
  });

  it('draws the ordinary pool on a non-bundle level', () => {
    const state = freshState();
    state.tower.level = BUNDLE_INTERVAL + 1;
    state.weapons.bolt = 5;

    const choices = pickCards(state);

    expect(choices.some((c) => c.kind === 'bundle')).toBe(false);
  });
});
