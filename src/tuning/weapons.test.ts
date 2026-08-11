import { describe, expect, it } from 'vitest';
import { IDENTITY_MODS } from './gems';
import { WEAPON_DEFS, bladeRadius } from './weapons';

// Phase 6A-1: stats() used to be pure lvl -> string, so a socketed gem's
// effect was invisible on the inventory screen's live readout — exactly
// the 2026-08-05 "cards appear to do nothing" failure mode. This guards
// the fix: every weapon's stats() must actually move when mods change,
// not just accept the parameter and ignore it.
describe('WeaponDef.stats — responds to live weaponMods', () => {
  it('defaults to identity mods when none are passed (Phase 6-0 pre-run screen)', () => {
    for (const def of Object.values(WEAPON_DEFS)) {
      expect(def!.stats(1)).toBe(def!.stats(1, IDENTITY_MODS));
    }
  });

  it('every weapon’s stats() output changes under a doubled damage mod', () => {
    const doubled = { damage: 2, rate: 1, area: 1, duration: 1, velocity: 1 };
    for (const def of Object.values(WEAPON_DEFS)) {
      expect(def!.stats(1, doubled)).not.toBe(def!.stats(1, IDENTITY_MODS));
    }
  });

  it('every cooldown-based weapon’s stats() output changes under a doubled rate mod', () => {
    const fasterRate = { damage: 1, rate: 2, area: 1, duration: 1, velocity: 1 };
    for (const key of ['bolt', 'chain', 'frost', 'poison', 'missile', 'immolation'] as const) {
      const def = WEAPON_DEFS[key]!;
      expect(def.stats(1, fasterRate)).not.toBe(def.stats(1, IDENTITY_MODS));
    }
  });
});

// 6D-0 (docs/plans/phase-6d0-balance-shape.md S4, S7 test 5): a regression
// guard for the dead `perLevel` term this batch fixed — pre-fix, Blades'
// radius was identical at level 1, 8, and 12 alike, because `base` alone
// always exceeded the perimeter floor and `perLevel` never once closed
// the gap. This pins that reach now actually responds to level.
describe('bladeRadius — responds to level (Phase 6D-0)', () => {
  it('grows from level 1 to level 8, for any reasonable perimeter', () => {
    for (const perimeter of [90, 100, 130]) {
      expect(bladeRadius(8, perimeter)).toBeGreaterThan(bladeRadius(1, perimeter));
    }
  });
});
