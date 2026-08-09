import { describe, expect, it } from 'vitest';
import type { WeaponKey } from '../types';
import { getDeck, resolveDeck, setDeck } from './weaponSelect';

// Only the DOM-free half of this module is unit-tested here, matching
// the project's existing split between systems/ (pure, tested) and ui/
// (thin DOM wrapper, verified live) — see docs/plans/phase-6-0-weapon-
// select.md S7. The overlay's rendering (every weapon selectable, the
// exact-count enforcement, the capacity refusal) is confirmed by direct
// browser interaction, the same way 5C verified ui/inventory.ts.

describe('weaponSelect — deck storage (docs/plans/phase-6-0-weapon-select.md S5)', () => {
  it('getDeck returns a copy, not a live reference', () => {
    setDeck(['bolt', 'chain', 'poison']);
    const deck = getDeck();
    deck.push('frost');
    expect(getDeck()).toEqual(['bolt', 'chain', 'poison']);
  });

  it('setDeck / getDeck round-trip', () => {
    const deck: WeaponKey[] = ['blades', 'missile', 'frost'];
    setDeck(deck);
    expect(getDeck()).toEqual(deck);
  });

  it('does not alias the array passed to setDeck', () => {
    const deck: WeaponKey[] = ['bolt', 'chain', 'poison'];
    setDeck(deck);
    deck.push('frost');
    expect(getDeck()).toEqual(['bolt', 'chain', 'poison']);
  });
});

describe('resolveDeck — the stale-deck guard (S5)', () => {
  it('returns the stored deck when its length matches weaponSlots', () => {
    setDeck(['blades', 'missile', 'frost']);
    expect(resolveDeck(3)).toEqual(['blades', 'missile', 'frost']);
  });

  it('falls back to the default kit when the stored deck length disagrees with weaponSlots', () => {
    setDeck(['bolt', 'chain']); // stale — 2 weapons against a 3-slot request
    expect(resolveDeck(3)).toEqual(['bolt', 'chain', 'poison']);
  });

  it('the default kit is the settled starting kit (arsenal plan S12.4)', () => {
    setDeck([]);
    expect(resolveDeck(3)).toEqual(['bolt', 'chain', 'poison']);
  });
});
