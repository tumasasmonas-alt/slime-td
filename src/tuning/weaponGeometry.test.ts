import { describe, expect, it } from 'vitest';
import { TIERS_LIST } from './tiers';
import { towerCenteredRadius, type TowerCenteredReach } from './weaponGeometry';

const spec: TowerCenteredReach = { margin: 18, base: 70, perLevel: 8 };

describe('towerCenteredRadius', () => {
  it('uses the safeRadius anchor when it is the larger term', () => {
    // safeRadius 100 + margin 18 = 118, vs base 70 at level 1.
    expect(towerCenteredRadius(spec, 1, 100)).toBe(118);
  });

  it('uses the level-scaled term once it overtakes the anchor', () => {
    // safeRadius 45 + 18 = 63, vs 70 + 8*7 = 126 at level 8.
    expect(towerCenteredRadius(spec, 8, 45)).toBe(126);
  });

  it('never returns a radius inside the safe zone, at any tier or level', () => {
    // The whole point of the helper: a tower-centered weapon must never
    // be aimed entirely at the guaranteed-empty space inside safeRadius,
    // which is what made the prototype's Orbiting Blades non-functional.
    for (const tier of TIERS_LIST) {
      for (let lvl = 1; lvl <= 8; lvl++) {
        expect(towerCenteredRadius(spec, lvl, tier.safeRadius)).toBeGreaterThan(tier.safeRadius);
      }
    }
  });

  it('never shrinks as level rises, holding tier constant', () => {
    for (const tier of TIERS_LIST) {
      let previous = 0;
      for (let lvl = 1; lvl <= 8; lvl++) {
        const r = towerCenteredRadius(spec, lvl, tier.safeRadius);
        expect(r).toBeGreaterThanOrEqual(previous);
        previous = r;
      }
    }
  });
});

describe('tier safe radii', () => {
  it('shrink monotonically and stay clear of the tower itself', () => {
    // Tower is 22px with a glow ring at +10; a safe radius at or inside
    // that would put the dashed boundary through the core's own visuals.
    let previous = Infinity;
    for (const tier of TIERS_LIST) {
      expect(tier.safeRadius).toBeLessThan(previous);
      expect(tier.safeRadius).toBeGreaterThan(32);
      previous = tier.safeRadius;
    }
  });
});
