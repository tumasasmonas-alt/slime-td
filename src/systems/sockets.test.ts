import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { investPoints, freeExtensionSlots, freeGemSlots, withdrawPoints } from './sockets';

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S2): extensions
// and gems used to share one combined socket count (arsenal plan S5) —
// the owner reversed that, restoring Decision 32's "per-weapon extension
// slots, universal support gems." occupiedSlots()/freeSlots() are gone;
// freeGemSlots()/freeExtensionSlots() replace them, one per line.
describe('freeGemSlots', () => {
  it('equals gemSocketCount(0) = 1 for a freshly-equipped weapon with nothing socketed', () => {
    const state = freshState();
    state.weapons.bolt = 0;
    expect(freeGemSlots(state, 'bolt')).toBe(1);
  });

  it('drops as gem sockets fill, at the same point invested', () => {
    const state = freshState();
    state.weapons.bolt = 8; // gemSocketCount(8) = 3
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(freeGemSlots(state, 'bolt')).toBe(2);
  });

  it('is unaffected by extensions filling the OTHER line', () => {
    const state = freshState();
    state.weapons.bolt = 8; // gemSocketCount(8) = 3, extensionSlotCount(8) = 1
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], gems: [] };
    expect(freeGemSlots(state, 'bolt')).toBe(3); // no gems socketed — full 3 still free
  });
});

describe('freeExtensionSlots', () => {
  it('is 0 below the first threshold (5 points)', () => {
    const state = freshState();
    state.weapons.bolt = 4;
    expect(freeExtensionSlots(state, 'bolt')).toBe(0);
  });

  it('is 1 at the first threshold', () => {
    const state = freshState();
    state.weapons.bolt = 5;
    expect(freeExtensionSlots(state, 'bolt')).toBe(1);
  });

  it('is 2 at the second threshold', () => {
    const state = freshState();
    state.weapons.bolt = 10;
    expect(freeExtensionSlots(state, 'bolt')).toBe(2);
  });

  it('drops as extension sockets fill', () => {
    const state = freshState();
    state.weapons.bolt = 10;
    state.weaponSockets.bolt = { extensions: [{ id: 1, weaponKey: 'bolt', kind: 'heavySlug', level: 1 }], gems: [] };
    expect(freeExtensionSlots(state, 'bolt')).toBe(1);
  });

  it('is unaffected by gems filling the OTHER line', () => {
    const state = freshState();
    state.weapons.bolt = 10; // extensionSlotCount(10) = 2
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'amplifier' }] };
    expect(freeExtensionSlots(state, 'bolt')).toBe(2); // no extensions socketed — full 2 still free
  });
});

describe('withdrawPoints — no destructive respec (arsenal plan S5), per-line eviction (6B-1)', () => {
  it('evicts gems to inventory, most-recently-socketed first, when the gem line closes', () => {
    const state = freshState();
    state.weapons.bolt = 8; // gemSocketCount(8) = 3
    state.weaponSockets.bolt = {
      extensions: [],
      gems: [
        { id: 1, kind: 'amplifier' },
        { id: 2, kind: 'overclock' },
        { id: 3, kind: 'multishot' },
      ],
    };

    const withdrawn = withdrawPoints(state, 'bolt', 8); // down to 0 points, gemSocketCount(0) = 1

    expect(withdrawn).toBe(8);
    expect(state.weapons.bolt).toBe(0);
    // One socket remains (gemSocketCount(0) = 1) — exactly one gem stays socketed.
    expect(state.weaponSockets.bolt!.gems).toHaveLength(1);
    expect(state.weaponSockets.bolt!.gems[0]!.id).toBe(1); // earliest-socketed kept
    expect(state.gemInventory).toHaveLength(2);
    expect(state.gemInventory.map((g) => g.id).sort()).toEqual([2, 3]);
  });

  it('never destroys a gem — conservation holds across any withdrawal', () => {
    const state = freshState();
    state.weapons.chain = 24; // gemSocketCount(24) = 5
    state.weaponSockets.chain = {
      extensions: [],
      gems: [1, 2, 3, 4, 5].map((id) => ({ id, kind: 'amplifier' as const })),
    };
    const totalBefore = state.weaponSockets.chain!.gems.length + state.gemInventory.length;

    withdrawPoints(state, 'chain', 24);

    const totalAfter = state.weaponSockets.chain!.gems.length + state.gemInventory.length;
    expect(totalAfter).toBe(totalBefore);
  });

  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): extensions bank
  // into extensionInventory instead of clamping the withdrawal — 6B-1
  // keeps that behaviour, now against the extension line's own ladder.
  it('evicts extensions to inventory (not destroyed) once the extension line shrinks, rather than clamping the withdrawal', () => {
    const state = freshState();
    state.weapons.poison = 10; // extensionSlotCount(10) = 2
    state.weaponSockets.poison = {
      extensions: [
        { id: 1, weaponKey: 'poison', kind: 'corrosive', level: 3 },
        { id: 2, weaponKey: 'poison', kind: 'twinCanister', level: 2 },
      ],
      gems: [],
    };

    const withdrawn = withdrawPoints(state, 'poison', 10); // down to 0 — extensionSlotCount(0) = 0

    expect(withdrawn).toBe(10); // full amount — no clamp
    expect(state.weapons.poison).toBe(0);
    // extensionSlotCount(0) = 0 — both extensions evict.
    expect(state.weaponSockets.poison!.extensions).toHaveLength(0);
    expect(state.extensionInventory).toHaveLength(2);
    expect(state.extensionInventory.map((e) => e.id).sort()).toEqual([1, 2]);
  });

  // The edge case the two-line model gets right by construction: crossing
  // 10 -> 9 closes an extension slot (extensionSlotCount 2 -> 1) while
  // every gem socket stays open (gemSocketCount(9) === gemSocketCount(10)
  // === 3, both above the next threshold down at 8).
  it('closing an extension slot never touches the gem line, and vice versa', () => {
    const state = freshState();
    state.weapons.poison = 10;
    state.weaponSockets.poison = {
      extensions: [
        { id: 1, weaponKey: 'poison', kind: 'corrosive', level: 1 },
        { id: 2, weaponKey: 'poison', kind: 'twinCanister', level: 1 },
      ],
      gems: [
        { id: 3, kind: 'amplifier' },
        { id: 4, kind: 'overclock' },
        { id: 5, kind: 'expansion' },
      ],
    };

    withdrawPoints(state, 'poison', 1); // 10 -> 9: extensionSlotCount 2 -> 1, gemSocketCount unchanged at 3

    expect(state.weaponSockets.poison!.extensions).toHaveLength(1);
    expect(state.extensionInventory).toHaveLength(1);
    expect(state.weaponSockets.poison!.gems).toHaveLength(3); // untouched
    expect(state.gemInventory).toHaveLength(0);
  });

  it('an extension and a gem evicting in the same withdrawal never cross lines', () => {
    const state = freshState();
    state.weapons.poison = 10;
    state.weaponSockets.poison = {
      extensions: [
        { id: 1, weaponKey: 'poison', kind: 'corrosive', level: 1 },
        { id: 2, weaponKey: 'poison', kind: 'twinCanister', level: 1 },
      ],
      gems: [{ id: 3, kind: 'amplifier' }],
    };

    withdrawPoints(state, 'poison', 10); // 10 -> 0: extensionSlotCount 2 -> 0, gemSocketCount 3 -> 1

    expect(state.weaponSockets.poison!.extensions).toHaveLength(0);
    expect(state.extensionInventory).toHaveLength(2);
    expect(state.weaponSockets.poison!.gems).toHaveLength(1); // gemSocketCount(0) = 1 — the one gem stays
    expect(state.gemInventory).toHaveLength(0);
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

  it('banks the full withdrawn amount even when an extension has to evict to make room', () => {
    const state = freshState();
    state.weapons.poison = 10;
    state.weaponSockets.poison = { extensions: [{ id: 1, weaponKey: 'poison', kind: 'corrosive', level: 1 }], gems: [] };
    state.enhancementPool = 0;

    withdrawPoints(state, 'poison', 10);

    expect(state.enhancementPool).toBe(10);
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
