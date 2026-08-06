import { describe, expect, it } from 'vitest';
import { PERIMETER } from './world';
import { towerCenteredRadius, type TowerCenteredReach } from './weaponGeometry';

const spec: TowerCenteredReach = { margin: 18, base: 70, perLevel: 8 };

// Representative perimeter values rather than TIERS_LIST (Decision 33/38:
// the perimeter is fixed now, not tier-driven — see PERIMETER in
// tuning/world.ts). Kept as a spread of plausible values, including the
// live constant, so the invariant below stays meaningful rather than
// collapsing to a single trivially-true case, and so it still protects
// against a future retuning of PERIMETER or a reintroduced per-tier
// driver.
const TEST_PERIMETERS = [40, 60, PERIMETER, 100, 140];

describe('towerCenteredRadius', () => {
  it('uses the perimeter anchor when it is the larger term', () => {
    // perimeter 100 + margin 18 = 118, vs base 70 at level 1.
    expect(towerCenteredRadius(spec, 1, 100)).toBe(118);
  });

  it('uses the level-scaled term once it overtakes the anchor', () => {
    // perimeter 45 + 18 = 63, vs 70 + 8*7 = 126 at level 8.
    expect(towerCenteredRadius(spec, 8, 45)).toBe(126);
  });

  it('never returns a radius inside the safe zone, at any plausible perimeter or level', () => {
    // The whole point of the helper: a tower-centered weapon must never
    // be aimed entirely at the guaranteed-empty space inside the
    // perimeter, which is what made the prototype's Orbiting Blades
    // non-functional.
    for (const perimeter of TEST_PERIMETERS) {
      for (let lvl = 1; lvl <= 8; lvl++) {
        expect(towerCenteredRadius(spec, lvl, perimeter)).toBeGreaterThan(perimeter);
      }
    }
  });

  it('never shrinks as level rises, holding the perimeter constant', () => {
    for (const perimeter of TEST_PERIMETERS) {
      let previous = 0;
      for (let lvl = 1; lvl <= 8; lvl++) {
        const r = towerCenteredRadius(spec, lvl, perimeter);
        expect(r).toBeGreaterThanOrEqual(previous);
        previous = r;
      }
    }
  });
});
