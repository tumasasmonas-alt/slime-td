import { describe, expect, it } from 'vitest';
import type { DeliveryKind } from '../types';
import { AMPLIFIER_GEM_DEFS, CONDITIONAL_GEM_DEFS, gemSupportsDelivery, TARGETING_GEM_DEFS } from './gems';

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S2.1, S9): the two real
// legality calls the 'beam' archetype forces — settled by the owner
// against this plan's own first recommendation (which was to refuse
// Extension). Tested directly against the archetype, before Lance exists,
// since these are pure data-table facts and don't need a weapon to prove.
describe('beam archetype gem legality (6C-2)', () => {
  it('Velocity is refused on beam — a beam is instantaneous, nothing to raise the speed of', () => {
    expect(gemSupportsDelivery('velocity', 'beam')).toBe(false);
  });

  it('Extension is legal on beam', () => {
    expect(gemSupportsDelivery('extension', 'beam')).toBe(true);
  });

  // Not just "legal to socket" (which would pass even with an inert mod —
  // exactly the shape of 6B-2's Chill Field silent no-op bug) but that it
  // measurably does something: beam's own duration mod is non-zero, the
  // same delta every other archetype's Extension reading uses.
  it('Extension\'s delta is non-zero on beam, not a silent no-op', () => {
    const delta = AMPLIFIER_GEM_DEFS.extension.delta(1);
    expect(delta.duration).toBeGreaterThan(0);
    expect(AMPLIFIER_GEM_DEFS.extension.desc('beam')).toMatch(/linger/i);
  });

  it('Amplifier and Overclock remain legal on beam — the ALWAYS-supported gems', () => {
    expect(gemSupportsDelivery('amplifier', 'beam')).toBe(true);
    expect(gemSupportsDelivery('overclock', 'beam')).toBe(true);
  });
});

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S1, S4 test 1): the
// legality matrix — asserted per gem per archetype, exactly the guard the
// plan calls out as "the guard the 6C 'beam' work established," so a
// future eighth DeliveryKind can't silently inherit a legality nobody
// chose. Pinned against the design table this batch settled on:
// Field Priority and Opportunist are the two honest refusals (both would
// duplicate Homing or have no aim point to redirect); Vigilance adds a
// third, on 'orbital' only, found while implementing — Blades' orbit
// already floors outside the perimeter by construction, so "only outside
// the perimeter" would be a guaranteed no-op there.
describe('Targeting gem legality matrix (Phase 6D-1)', () => {
  const ALL_DELIVERIES: readonly DeliveryKind[] = ['projectile', 'orbital', 'pulse', 'cloud', 'ring', 'beam'];

  const EXPECTED: Record<keyof typeof TARGETING_GEM_DEFS, (d: DeliveryKind) => boolean> = {
    threatPriority: () => true,
    fieldPriority: (d) => d === 'projectile' || d === 'beam',
    breachPriority: () => true,
    vigilance: (d) => d !== 'orbital',
    fixation: () => true,
    triage: () => true,
    opportunist: (d) => d === 'projectile' || d === 'beam',
  };

  for (const kind of Object.keys(TARGETING_GEM_DEFS) as (keyof typeof TARGETING_GEM_DEFS)[]) {
    for (const delivery of ALL_DELIVERIES) {
      const expected = EXPECTED[kind](delivery);
      it(`${kind} is ${expected ? 'legal' : 'illegal'} on ${delivery}`, () => {
        expect(gemSupportsDelivery(kind, delivery)).toBe(expected);
      });
    }
  }
});

// Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md): unlike Targeting,
// Conditional gems have no refusal table at all — none of the nine reads
// anything archetype-specific (delivery shape, aim, orbit), only target
// or player state. Pinned per gem per archetype anyway, same guard as the
// Targeting matrix above, so a future gem in this class that DOES need a
// refusal can't silently inherit "always legal" by accident.
describe('Conditional gem legality — always legal, every archetype (Phase 6D-2)', () => {
  const ALL_DELIVERIES: readonly DeliveryKind[] = ['projectile', 'orbital', 'pulse', 'cloud', 'ring', 'beam'];

  for (const kind of Object.keys(CONDITIONAL_GEM_DEFS) as (keyof typeof CONDITIONAL_GEM_DEFS)[]) {
    for (const delivery of ALL_DELIVERIES) {
      it(`${kind} is legal on ${delivery}`, () => {
        expect(gemSupportsDelivery(kind, delivery)).toBe(true);
      });
    }
  }
});

