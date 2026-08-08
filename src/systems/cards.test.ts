import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { applyCardChoice, buildCoreGemPool, buildWeaponSidePool, pickCards, shuffled } from './cards';

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
  it('never offers a weapon-level card kind — only newWeapon/extension/passive', () => {
    const state = freshState();
    state.weapons.bolt = 5;
    const pool = buildWeaponSidePool(state);
    for (const c of pool) {
      expect(c.kind).not.toBe('weapon');
    }
  });

  it('gates new-weapon cards on free deck slots', () => {
    const state = freshState();
    state.weaponSlots = 1;
    state.weapons.bolt = 1; // fills the only slot

    const pool = buildWeaponSidePool(state);
    expect(pool.some((c) => c.kind === 'newWeapon')).toBe(false);
  });

  it('offers new-weapon cards for every unequipped weapon while a slot is free', () => {
    const state = freshState();
    state.weaponSlots = 3;
    state.weapons.bolt = 1;

    const pool = buildWeaponSidePool(state);
    const newWeaponKeys = pool.filter((c) => c.kind === 'newWeapon').map((c) => (c.kind === 'newWeapon' ? c.key : null));
    expect(newWeaponKeys).not.toContain('bolt'); // already equipped
    expect(newWeaponKeys).toContain('blades');
    expect(newWeaponKeys).toContain('immolation');
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

  it('only pools the legacy passives (damage, atkSpeed), never the five core-gem keys', () => {
    const state = freshState();
    const pool = buildWeaponSidePool(state);
    const passiveKeys = pool.filter((c) => c.kind === 'passive').map((c) => (c.kind === 'passive' ? c.key : null));
    expect(passiveKeys).toContain('damage');
    expect(passiveKeys).toContain('atkSpeed');
    expect(passiveKeys).not.toContain('maxHp');
    expect(passiveKeys).not.toContain('regen');
    expect(passiveKeys).not.toContain('armor');
    expect(passiveKeys).not.toContain('pickup');
    expect(passiveKeys).not.toContain('xpGain');
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
    state.weaponSlots = 0; // no new weapons
    state.coreGems = ['maxHp', 'regen', 'armor'];
    state.passives.damage = 8; // maxLevel, no more legacy passive cards
    state.passives.atkSpeed = 8;
    // no weapons equipped -> no extension candidates either
    const choices = pickCards(state);
    expect(choices).toEqual([{ kind: 'heal' }]);
  });
});

describe('applyCardChoice', () => {
  it('newWeapon starts a weapon at 1 point invested, matching the equipped-check truthy pattern', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'newWeapon', key: 'frost' });
    expect(state.weapons.frost).toBe(1);
  });

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

  it('passive: still works for the legacy damage/atkSpeed keys', () => {
    const state = freshState();
    applyCardChoice(state, { kind: 'passive', key: 'damage', nextLevel: 1, isNew: true });
    expect(state.passives.damage).toBe(1);
  });

  it('heal: restores hp to max', () => {
    const state = freshState();
    state.tower.hp = 10;
    applyCardChoice(state, { kind: 'heal' });
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });
});
