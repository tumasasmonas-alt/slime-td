import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { IMMOLATION_TICK, WEAPON_DEFS, immolationDamage, immolationRadius } from '../tuning/weapons';
import { runWeaponPipeline, type WeaponPipeline } from './pipeline';

// Phase 5A (Decision 70): promoted from systems/ward.ts's Ward Pulse,
// which was a weapon misfiled as a passive since the port — a cooldown
// and a tower-centered radius, exactly Frost Nova's and Blades' shape,
// gated behind state.passives.ward instead of state.weapons like every
// other thing with those properties. That misclassification is also why
// it never got a visual (Decision 11's "a weapon's signature visual is
// part of the weapon" never applied to something classed as a passive)
// and why its clearAt call never passed coagulantMult. The visual stays
// deferred to Phase 6B (real content); this promotion is architecture
// only. See docs/plans/phase-5-6-arsenal.md S7.11 and S12.6.

// Self-centered — no ACQUIRE stage, the target is always the tower.
// READY is deliberately NOT built on the shared cooldownReady() helper:
// Ward Pulse's tick never divided by atkSpeedMult (Overclock never sped
// it up), and 5A preserves that exactly rather than silently granting a
// weapon a passive interaction it never had.
const immolationPipeline: WeaponPipeline = {
  ready: (state, dt) => {
    state.weaponTimers.immolation -= dt;
    if (state.weaponTimers.immolation > 0) return false;
    state.weaponTimers.immolation = IMMOLATION_TICK;
    return true;
  },
  deliver: (state, lvl) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const radius = immolationRadius(lvl, grid.perimeter);
    clearAt(state, t.x, t.y, immolationDamage(lvl), {
      radiusPx: radius,
      coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
    });
  },
};

export function updateImmolationWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.immolation;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, immolationPipeline);
}
