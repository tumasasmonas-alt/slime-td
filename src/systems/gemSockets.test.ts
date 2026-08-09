import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { gemHasLegalHome, gemLegalFor, socketGem, unsocketGem } from './gemSockets';

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

describe('gemHasLegalHome', () => {
  it('is false with no weapons equipped', () => {
    const state = freshState();
    expect(gemHasLegalHome(state, 'amplifier')).toBe(false);
  });

  it('is true when some equipped weapon has a free, legal socket', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(gemHasLegalHome(state, 'amplifier')).toBe(true);
  });

  it('is false when the only equipped weapon has no free socket', () => {
    const state = freshState();
    state.weapons.bolt = 0; // socketCount(0) = 1
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(gemHasLegalHome(state, 'overclock')).toBe(false);
  });

  it('is false when every equipped weapon refuses the gem’s archetype', () => {
    const state = freshState();
    state.weapons.immolation = 1;
    expect(gemHasLegalHome(state, 'velocity')).toBe(false);
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
