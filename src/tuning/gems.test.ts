import { describe, expect, it } from 'vitest';
import { AMPLIFIER_GEM_DEFS, gemSupportsDelivery } from './gems';

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
