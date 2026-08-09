import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { investPoints, minPointsForSockets, occupiedSlots, freeSlots, withdrawPoints } from './sockets';

describe('occupiedSlots', () => {
  it('is 0 for an undefined WeaponSockets', () => {
    expect(occupiedSlots(undefined)).toBe(0);
  });

  it('sums extensions and gems — they share one pool', () => {
    expect(
      occupiedSlots({
        extensions: [{ kind: 'a', level: 1 }],
        gems: [{ id: 1, kind: 'amplifier' }, { id: 2, kind: 'overclock' }],
      }),
    ).toBe(3);
  });
});

describe('freeSlots', () => {
  it('equals socketCount(0) = 1 for a freshly-equipped weapon with nothing socketed', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    expect(freeSlots(state, 'bolt')).toBe(1);
  });

  it('drops as sockets fill, at the same point invested', () => {
    const state = freshState();
    state.weapons.bolt = 8; // socketCount(8) = 3
    state.weaponSockets.bolt = { extensions: [{ kind: 'a', level: 1 }], gems: [] };
    expect(freeSlots(state, 'bolt')).toBe(2);
  });
});

describe('withdrawPoints — no destructive respec (arsenal plan S5)', () => {
  it('evicts gems to inventory, most-recently-socketed first, when sockets close', () => {
    const state = freshState();
    state.weapons.bolt = 8; // socketCount(8) = 3
    state.weaponSockets.bolt = {
      extensions: [],
      gems: [
        { id: 1, kind: 'amplifier' },
        { id: 2, kind: 'overclock' },
        { id: 3, kind: 'multishot' },
      ],
    };

    const withdrawn = withdrawPoints(state, 'bolt', 8); // down to 0 points, socketCount(0) = 1

    expect(withdrawn).toBe(8);
    expect(state.weapons.bolt).toBe(0);
    // One socket remains (socketCount(0) = 1) — exactly one gem stays socketed.
    expect(state.weaponSockets.bolt!.gems).toHaveLength(1);
    expect(state.weaponSockets.bolt!.gems[0]!.id).toBe(1); // earliest-socketed kept
    expect(state.gemInventory).toHaveLength(2);
    expect(state.gemInventory.map((g) => g.id).sort()).toEqual([2, 3]);
  });

  it('never destroys a gem — conservation holds across any withdrawal', () => {
    const state = freshState();
    state.weapons.chain = 24; // socketCount(24) = 5
    state.weaponSockets.chain = {
      extensions: [],
      gems: [1, 2, 3, 4, 5].map((id) => ({ id, kind: 'amplifier' as const })),
    };
    const totalBefore = state.weaponSockets.chain!.gems.length + state.gemInventory.length;

    withdrawPoints(state, 'chain', 24);

    const totalAfter = state.weaponSockets.chain!.gems.length + state.gemInventory.length;
    expect(totalAfter).toBe(totalBefore);
  });

  it('clamps the withdrawal rather than ever destroying a committed extension', () => {
    const state = freshState();
    state.weapons.poison = 8; // socketCount(8) = 3
    state.weaponSockets.poison = {
      extensions: [
        { kind: 'a', level: 3 },
        { kind: 'b', level: 2 },
      ],
      gems: [],
    };
    // 2 extensions need socketCount >= 2, i.e. at least 3 points invested.

    const withdrawn = withdrawPoints(state, 'poison', 8);

    expect(withdrawn).toBe(5); // 8 -> 3, not 8 -> 0
    expect(state.weapons.poison).toBe(3);
    expect(state.weaponSockets.poison!.extensions).toHaveLength(2); // untouched
  });

  it('returns 0 and changes nothing when the weapon has no points to withdraw', () => {
    const state = freshState();
    state.weapons.missile = 0;
    const withdrawn = withdrawPoints(state, 'missile', 5);
    expect(withdrawn).toBe(0);
    expect(state.weapons.missile).toBe(0);
  });

  // Phase 5C: withdrawn points return to the bank rather than vanishing —
  // a transfer, mirroring investPoints() exactly.
  it('returns withdrawn points to enhancementPool', () => {
    const state = freshState();
    state.weapons.bolt = 8;
    state.enhancementPool = 2;

    const withdrawn = withdrawPoints(state, 'bolt', 5);

    expect(withdrawn).toBe(5);
    expect(state.enhancementPool).toBe(7);
  });

  it('respects the clamp when returning points — only the actual amount withdrawn is banked', () => {
    const state = freshState();
    state.weapons.poison = 8;
    state.weaponSockets.poison = { extensions: [{ kind: 'a', level: 1 }], gems: [] }; // needs >= 0 points, no real floor here
    state.enhancementPool = 0;

    withdrawPoints(state, 'poison', 8);

    // socketCount(0) = 1 >= 1 extension, so the full 8 can withdraw.
    expect(state.enhancementPool).toBe(8);
  });
});

describe('minPointsForSockets', () => {
  it('is 0 with no extensions', () => {
    expect(minPointsForSockets(undefined)).toBe(0);
    expect(minPointsForSockets({ extensions: [], gems: [] })).toBe(0);
  });

  it('is the smallest points value whose socketCount covers the extension count', () => {
    // socketCount(0)=1, socketCount(3)=2, socketCount(8)=3
    expect(minPointsForSockets({ extensions: [{ kind: 'a', level: 1 }], gems: [] })).toBe(0);
    expect(
      minPointsForSockets({
        extensions: [
          { kind: 'a', level: 1 },
          { kind: 'b', level: 1 },
        ],
        gems: [],
      }),
    ).toBe(3);
    expect(
      minPointsForSockets({
        extensions: [
          { kind: 'a', level: 1 },
          { kind: 'b', level: 1 },
          { kind: 'c', level: 1 },
        ],
        gems: [],
      }),
    ).toBe(8);
  });
});

describe('investPoints', () => {
  it('transfers points from the bank to the weapon', () => {
    const state = freshState();
    state.enhancementPool = 5;
    state.weapons.bolt = 2;

    const invested = investPoints(state, 'bolt', 3);

    expect(invested).toBe(3);
    expect(state.weapons.bolt).toBe(5);
    expect(state.enhancementPool).toBe(2);
  });

  it('equips an unequipped weapon starting from 0', () => {
    const state = freshState();
    state.enhancementPool = 1;

    investPoints(state, 'frost', 1);

    expect(state.weapons.frost).toBe(1);
  });

  it('caps at what is actually banked, never overdrawing the pool', () => {
    const state = freshState();
    state.enhancementPool = 2;
    state.weapons.bolt = 0;

    const invested = investPoints(state, 'bolt', 5);

    expect(invested).toBe(2);
    expect(state.weapons.bolt).toBe(2);
    expect(state.enhancementPool).toBe(0);
  });

  it('returns 0 and changes nothing when the pool is empty', () => {
    const state = freshState();
    state.enhancementPool = 0;
    state.weapons.bolt = 4;

    const invested = investPoints(state, 'bolt', 3);

    expect(invested).toBe(0);
    expect(state.weapons.bolt).toBe(4);
  });

  // Conservation: investing then withdrawing the same amount is a no-op
  // on the total (pool + weapon), matching withdrawPoints' own guarantee.
  it('round-trips with withdrawPoints without gaining or losing points', () => {
    const state = freshState();
    state.enhancementPool = 10;
    state.weapons.bolt = 0;
    const total = () => state.enhancementPool + (state.weapons.bolt ?? 0);
    const before = total();

    investPoints(state, 'bolt', 4);
    expect(total()).toBe(before);

    withdrawPoints(state, 'bolt', 4);
    expect(total()).toBe(before);
    expect(state.weapons.bolt).toBe(0);
  });
});
