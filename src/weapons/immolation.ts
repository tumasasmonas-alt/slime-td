import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { IMMOLATION_RING_COLOR } from '../render/immolationRing';
import { resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { IMMOLATION_TICK, WEAPON_DEFS, immolationDamage, immolationRadius } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

// Phase 6A-1: a brief brighter flash on top of the persistent ring
// (render/immolationRing.ts) each time it actually ticks — matching
// Frost Nova's novaFx pattern, the confirmation-on-fire half of the
// weapon's now-complete visual.
const FLASH_LIFE = 0.35;

// Phase 5A (Decision 70): promoted from systems/ward.ts's Ward Pulse,
// which was a weapon misfiled as a passive since the port — a cooldown
// and a tower-centered radius, exactly Frost Nova's and Blades' shape,
// gated behind state.passives.ward instead of state.weapons like every
// other thing with those properties. That misclassification is also why
// it never got a visual (Decision 11's "a weapon's signature visual is
// part of the weapon" never applied to something classed as a passive)
// and why its clearAt call never passed coagulantMult. The visual and its
// remaining balance gap (WEAPON_DAMAGE_SCALE) stay deferred to Phase 6B.

// Self-centered — no ACQUIRE stage, the target is always the tower.
// Phase 6A-1: now built on the shared cooldownReady() helper like every
// other cooldown weapon — see tuning/weapons.ts's IMMOLATION_TICK comment
// for why this closes 2 of the weapon's 3 open balance gaps.
//
// Phase 6A-2: RESOLVE options (Splash/Overflow/Kickback/Priming/Pierce)
// are wired — they only affect the damage math, not where or how large
// the ring is. Homing and Multishot/Formation are deliberately NOT wired
// here: both would move or multiply the ring's centre, which would
// desync render/immolationRing.ts's persistent visual (drawn once, at
// the tower, from state.weapons/state.grid directly) from where the
// damage actually lands — a correctness risk against a visual this
// session specifically shipped to fix a standing BACKLOG item. Left as a
// real, disclosed gap rather than risking that regression; revisit once
// the ring's render reads a shared origin instead of assuming the tower.
export const immolationPipeline: WeaponPipeline = {
  ready: cooldownReady('immolation', () => IMMOLATION_TICK),
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'immolation');
    const radius = immolationRadius(lvl, grid.perimeter) * mods.area;
    const opts = resolveOpts(state, 'immolation');
    clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult, {
      radiusPx: radius,
      coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
      ...opts,
    });
    state.novaFx.push({ x: t.x, y: t.y, radius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });
  },
};

export function updateImmolationWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.immolation;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, immolationPipeline, 'immolation');
}
