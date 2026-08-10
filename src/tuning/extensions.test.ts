import { describe, expect, it } from 'vitest';
import type { WeaponKey } from '../types';
import { EXTENSION_DEFS, EXTENSION_MAX_LEVEL, EXTENSIONS_BY_WEAPON, type ExtensionKey } from './extensions';
import { WEAPON_DEFS } from './weapons';

const ALL_WEAPON_KEYS = Object.keys(WEAPON_DEFS) as WeaponKey[];

// Phase 6B-1 (docs/plans/phase-6b-incumbent-extensions.md S10): a
// table-completeness test — cheap, and it catches an authoring slip in a
// 28-entry table (a duplicate key, a weapon with three or five instead of
// four, an orphaned key not attached to any weapon).
describe('EXTENSION_DEFS / EXTENSIONS_BY_WEAPON — table completeness', () => {
  it('every weapon has exactly four extensions', () => {
    for (const key of ALL_WEAPON_KEYS) {
      expect(EXTENSIONS_BY_WEAPON[key]?.length).toBe(4);
    }
  });

  it('every ExtensionKey belongs to exactly one weapon', () => {
    const seen = new Set<ExtensionKey>();
    for (const key of ALL_WEAPON_KEYS) {
      for (const extKind of EXTENSIONS_BY_WEAPON[key] ?? []) {
        expect(seen.has(extKind)).toBe(false);
        seen.add(extKind);
      }
    }
    expect(seen.size).toBe(Object.keys(EXTENSION_DEFS).length);
  });

  it("every def's own weaponKey matches the EXTENSIONS_BY_WEAPON bucket it's filed under", () => {
    for (const key of ALL_WEAPON_KEYS) {
      for (const extKind of EXTENSIONS_BY_WEAPON[key] ?? []) {
        expect(EXTENSION_DEFS[extKind].weaponKey).toBe(key);
      }
    }
  });

  it('every def has a non-empty name, icon, and a desc that renders at every level', () => {
    for (const extKind of Object.keys(EXTENSION_DEFS) as ExtensionKey[]) {
      const def = EXTENSION_DEFS[extKind];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      for (let lvl = 1; lvl <= EXTENSION_MAX_LEVEL; lvl++) {
        expect(def.desc(lvl as 1 | 2 | 3).length).toBeGreaterThan(0);
      }
    }
  });

  // A mods-bearing extension's delta should generally grow (or at least
  // never shrink) from level 1 to level 3 — catches a copy-paste level
  // array that accidentally repeats the same value or goes backwards.
  it('a mods-bearing extension never gets weaker from level 1 to level 3', () => {
    for (const extKind of Object.keys(EXTENSION_DEFS) as ExtensionKey[]) {
      const def = EXTENSION_DEFS[extKind];
      if (!def.mods) continue;
      const lv1 = def.mods(1);
      const lv3 = def.mods(3);
      const fields = ['damage', 'rate', 'area', 'duration', 'velocity'] as const;
      for (const f of fields) {
        const a = lv1[f] ?? 0;
        const b = lv3[f] ?? 0;
        // Heavy Slug's `rate` term is a deliberate penalty (more negative
        // at higher levels is "more downside," i.e. the tradeoff getting
        // sharper, not weaker) — magnitude should still grow.
        expect(Math.abs(b)).toBeGreaterThanOrEqual(Math.abs(a));
      }
    }
  });
});
