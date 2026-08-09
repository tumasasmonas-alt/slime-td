import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import {
  extensionLegalFor,
  gemLegalFor,
  socketCoreGem,
  socketExtension,
  socketGem,
  unsocketCoreGem,
  unsocketExtension,
  unsocketGem,
} from './gemSockets';

describe('gemLegalFor', () => {
  it('is true for a universal gem on any weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(gemLegalFor(state, 'bolt', 'amplifier')).toBe(true);
  });

  it('is false for a gem that refuses this weapon’s archetype', () => {
    const state = freshState();
    state.weapons.immolation = 1; // 'ring' — Velocity refuses it
    expect(gemLegalFor(state, 'immolation', 'velocity')).toBe(false);
  });

  it('is true for Velocity on a projectile weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(gemLegalFor(state, 'bolt', 'velocity')).toBe(true);
  });

  it('is false once the same gem kind is already socketed in that weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(gemLegalFor(state, 'bolt', 'amplifier')).toBe(false);
  });

  it('is true for the same gem kind already socketed in a DIFFERENT weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weapons.chain = 1;
    state.weaponSockets.chain = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(gemLegalFor(state, 'bolt', 'amplifier')).toBe(true);
  });

  it('is false for an unequipped weapon', () => {
    const state = freshState();
    expect(gemLegalFor(state, 'bolt', 'amplifier')).toBe(false);
  });
});

describe('socketGem', () => {
  it('moves an instance from inventory into the weapon’s sockets', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.gemInventory = [{ id: 7, kind: 'amplifier' }];
    const ok = socketGem(state, 'bolt', state.gemInventory[0]!);
    expect(ok).toBe(true);
    expect(state.weaponSockets.bolt?.gems).toEqual([{ id: 7, kind: 'amplifier' }]);
    expect(state.gemInventory).toHaveLength(0);
  });

  it('refuses and leaves inventory untouched when there is no free socket', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'overclock' }] };
    state.gemInventory = [{ id: 7, kind: 'amplifier' }];
    const ok = socketGem(state, 'bolt', state.gemInventory[0]!);
    expect(ok).toBe(false);
    expect(state.gemInventory).toHaveLength(1);
  });

  it('refuses an illegal archetype combination', () => {
    const state = freshState();
    state.weapons.immolation = 1;
    state.gemInventory = [{ id: 7, kind: 'velocity' }];
    expect(socketGem(state, 'immolation', state.gemInventory[0]!)).toBe(false);
  });
});

describe('unsocketGem', () => {
  it('returns a gem from a weapon’s sockets to inventory — never destroyed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 7, kind: 'amplifier' }] };
    const ok = unsocketGem(state, 'bolt', 7);
    expect(ok).toBe(true);
    expect(state.weaponSockets.bolt?.gems).toHaveLength(0);
    expect(state.gemInventory).toEqual([{ id: 7, kind: 'amplifier' }]);
  });

  it('returns false for a gem id not present', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [] };
    expect(unsocketGem(state, 'bolt', 999)).toBe(false);
    expect(state.gemInventory).toHaveLength(0);
  });
});

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): extensionLegalFor/
// socketExtension/unsocketExtension mirror gemLegalFor/socketGem/
// unsocketGem exactly, with one addition — an extension is bound to the
// specific weapon it was rolled for, unlike a gem which can go into any
// archetype-legal weapon.
describe('extensionLegalFor', () => {
  it('is true for an instance rolled for this weapon, on an equipped weapon with room', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    const instance = { id: 1, weaponKey: 'bolt' as const, kind: 'placeholder', level: 1 as const };
    expect(extensionLegalFor(state, 'bolt', instance)).toBe(true);
  });

  it('is false for an instance rolled for a DIFFERENT weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weapons.chain = 1;
    const instance = { id: 1, weaponKey: 'chain' as const, kind: 'placeholder', level: 1 as const };
    expect(extensionLegalFor(state, 'bolt', instance)).toBe(false);
  });

  it('is false for an unequipped weapon', () => {
    const state = freshState();
    const instance = { id: 1, weaponKey: 'bolt' as const, kind: 'placeholder', level: 1 as const };
    expect(extensionLegalFor(state, 'bolt', instance)).toBe(false);
  });

  it('is false once this weapon already has an extension of the same kind socketed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [{ id: 2, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] };
    const instance = { id: 1, weaponKey: 'bolt' as const, kind: 'placeholder', level: 1 as const };
    expect(extensionLegalFor(state, 'bolt', instance)).toBe(false);
  });
});

describe('socketExtension', () => {
  it('moves an instance from inventory into the weapon’s sockets', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.extensionInventory = [{ id: 7, weaponKey: 'bolt', kind: 'placeholder', level: 1 }];
    const ok = socketExtension(state, 'bolt', state.extensionInventory[0]!);
    expect(ok).toBe(true);
    expect(state.weaponSockets.bolt?.extensions).toEqual([{ id: 7, weaponKey: 'bolt', kind: 'placeholder', level: 1 }]);
    expect(state.extensionInventory).toHaveLength(0);
  });

  it('refuses and leaves inventory untouched when there is no free socket', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'placeholder', level: 1 }], gems: [] };
    state.extensionInventory = [{ id: 7, weaponKey: 'bolt', kind: 'other', level: 1 }];
    const ok = socketExtension(state, 'bolt', state.extensionInventory[0]!);
    expect(ok).toBe(false);
    expect(state.extensionInventory).toHaveLength(1);
  });

  it('refuses an instance bound to a different weapon', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.extensionInventory = [{ id: 7, weaponKey: 'chain', kind: 'placeholder', level: 1 }];
    expect(socketExtension(state, 'bolt', state.extensionInventory[0]!)).toBe(false);
  });
});

describe('unsocketExtension', () => {
  it('returns an extension from a weapon’s sockets to inventory — never destroyed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [{ id: 7, weaponKey: 'bolt', kind: 'placeholder', level: 2 }], gems: [] };
    const ok = unsocketExtension(state, 'bolt', 7);
    expect(ok).toBe(true);
    expect(state.weaponSockets.bolt?.extensions).toHaveLength(0);
    expect(state.extensionInventory).toEqual([{ id: 7, weaponKey: 'bolt', kind: 'placeholder', level: 2 }]);
  });

  it('returns false for an extension id not present', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [] };
    expect(unsocketExtension(state, 'bolt', 999)).toBe(false);
    expect(state.extensionInventory).toHaveLength(0);
  });
});

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S6): a core gem's effect
// now applies only at socket time, not at card-pick time (see
// systems/cards.test.ts's applyCardChoice coverage for the pick-time
// half). The owner's rule: unsocketing removes exactly what socketing
// gave — including the maxHp clamp, which is the one part of this that
// actually matters to get right (see the heal-exploit test below).
describe('socketCoreGem / unsocketCoreGem', () => {
  it('socketCoreGem fills the first empty slot, removes the instance from inventory, and applies the effect', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'regen' }];
    const ok = socketCoreGem(state, state.coreGemInventory[0]!);
    expect(ok).toBe(true);
    expect(state.coreGems).toContain('regen');
    expect(state.coreGemInventory).toHaveLength(0);
    expect(state.passives.regen).toBe(1);
  });

  it('socketCoreGem maxHp: also raises maxHp and heals by the same amount', () => {
    const state = freshState();
    state.tower.hp = 50;
    const before = state.tower.maxHp;
    state.coreGemInventory = [{ id: 1, kind: 'maxHp' }];
    socketCoreGem(state, state.coreGemInventory[0]!);
    expect(state.tower.maxHp).toBe(before + 20);
    expect(state.tower.hp).toBe(70);
  });

  it('socketCoreGem refuses when all three core slots are full', () => {
    const state = freshState();
    state.coreGems = ['maxHp', 'regen', 'armor'];
    state.coreGemInventory = [{ id: 1, kind: 'pickup' }];
    const ok = socketCoreGem(state, state.coreGemInventory[0]!);
    expect(ok).toBe(false);
    expect(state.coreGemInventory).toHaveLength(1);
  });

  it('unsocketCoreGem returns the gem to inventory and removes the passive — round trip, never destroyed', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'regen' }];
    socketCoreGem(state, state.coreGemInventory[0]!);

    const ok = unsocketCoreGem(state, 'regen');
    expect(ok).toBe(true);
    expect(state.coreGems).not.toContain('regen');
    expect(state.passives.regen).toBeUndefined();
    expect(state.coreGemInventory).toHaveLength(1);
    expect(state.coreGemInventory[0]!.kind).toBe('regen');
  });

  it('unsocketCoreGem returns false for a kind not currently socketed', () => {
    const state = freshState();
    expect(unsocketCoreGem(state, 'armor')).toBe(false);
  });

  // The owner's rule, verbatim: "unsocketing the core gem should remove
  // what it gave, if it gives max hp - take it away when unsocketed." The
  // clamp is what stops this being a free-heal loop: without it, hp could
  // sit above the reduced maxHp after unsocketing, and re-socketing would
  // silently re-heal past where the player actually is.
  it('the heal exploit: socketing maxHp, taking damage, then unsocketing never leaves hp above the reduced maxHp, and heals nothing', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'maxHp' }];
    socketCoreGem(state, state.coreGemInventory[0]!); // maxHp 100 -> 120, hp -> 120

    state.tower.hp = 15; // took heavy damage, well below the ORIGINAL maxHp of 100

    unsocketCoreGem(state, 'maxHp'); // maxHp 120 -> 100

    expect(state.tower.maxHp).toBe(100);
    expect(state.tower.hp).toBe(15); // untouched — no healing occurred
    expect(state.tower.hp).toBeLessThanOrEqual(state.tower.maxHp);
  });

  it('the heal exploit, the other direction: hp above the reduced maxHp gets clamped down, not left floating above it', () => {
    const state = freshState();
    state.coreGemInventory = [{ id: 1, kind: 'maxHp' }];
    socketCoreGem(state, state.coreGemInventory[0]!); // maxHp 100 -> 120, hp -> 120 (full)

    // hp is still 120 (never damaged) when unsocketing removes 20 max —
    // without the clamp this would leave hp=120 > maxHp=100.
    unsocketCoreGem(state, 'maxHp');

    expect(state.tower.maxHp).toBe(100);
    expect(state.tower.hp).toBe(100);
  });
});
