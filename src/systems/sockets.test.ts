import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { investPoints, occupiedSlots, freeSlots, withdrawPoints } from './sockets';

describe('occupiedSlots', () => {
  it('is 0 for an undefined WeaponSockets', () => {
    expect(occupiedSlots(undefined)).toBe(0);
  });

  it('sums extensions and gems — they share one pool', () => {
    expect(
      occupiedSlots({
        extensions: [{ id: 1, weaponKey: 'bolt', kind: 'a', level: 1 }],
        gems: [
          { id: 2, kind: 'amplifier' },
          { id: 3, kind: 'overclock' },
        ],
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
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'a', level: 1 }], gems: [] };
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

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): supersedes the
  // pre-6A-3 "clamps the withdrawal" test. Extensions now bank into
  // extensionInventory the moment their socket closes, the same as gems —
  // there is no more floor, so the full requested withdrawal always
  // succeeds, and nothing is ever destroyed.
  it('evicts extensions to inventory (not destroyed) once gems are exhausted, rather than clamping the withdrawal', () => {
    const state = freshState();
    state.weapons.poison = 8; // socketCount(8) = 3
    state.weaponSockets.poison = {
      extensions: [
        { id: 1, weaponKey: 'poison', kind: 'a', level: 3 },
        { id: 2, weaponKey: 'poison', kind: 'b', level: 2 },
      ],
      gems: [],
    };

    const withdrawn = withdrawPoints(state, 'poison', 8);

    expect(withdrawn).toBe(8); // full amount — no clamp any more
    expect(state.weapons.poison).toBe(0);
    // socketCount(0) = 1 socket remains, so exactly one extension stays
    // socketed and the other is evicted to inventory — nothing destroyed.
    expect(state.weaponSockets.poison!.extensions).toHaveLength(1);
    expect(state.weaponSockets.poison!.extensions[0]!.id).toBe(1); // earliest-socketed kept, same rule as gems
    expect(state.extensionInventory).toHaveLength(1);
    expect(state.extensionInventory[0]!.id).toBe(2);
  });

  it('evicts gems before extensions when both are present and sockets close', () => {
    const state = freshState();
    state.weapons.poison = 8; // socketCount(8) = 3
    state.weaponSockets.poison = {
      extensions: [{ id: 1, weaponKey: 'poison', kind: 'a', level: 1 }],
      gems: [{ id: 2, kind: 'amplifier' }],
    };
    // 2 occupied, needs to drop to socketCount(0) = 1 — one eviction only.

    withdrawPoints(state, 'poison', 8);

    // The gem evicts, not the extension.
    expect(state.weaponSockets.poison!.extensions).toHaveLength(1);
    expect(state.weaponSockets.poison!.gems).toHaveLength(0);
    expect(state.gemInventory).toHaveLength(1);
    expect(state.extensionInventory).toHaveLength(0);
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

  // Phase 6A-3: supersedes the pre-6A-3 "respects the clamp" test — there
  // is no clamp any more, so the full amount always banks, regardless of
  // what was socketed.
  it('banks the full withdrawn amount even when an extension has to evict to make room', () => {
    const state = freshState();
    state.weapons.poison = 8;
    state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'a', level: 1 }], gems: [] };
    state.enhancementPool = 0;

    withdrawPoints(state, 'poison', 8);

    expect(state.enhancementPool).toBe(8);
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
