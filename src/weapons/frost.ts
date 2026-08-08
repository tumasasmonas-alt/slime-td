import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { damageMult } from '../systems/passives';
import { WEAPON_DEFS, frostCooldown, frostDamage, frostRadius } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const FREEZE_DURATION = 2.0;
const FX_LIFE = 0.4;

// Untargeted — pulses outward from the tower on a cooldown, damaging and
// freezing growth in radius. The freeze mechanic itself (clearAt's
// freezeDuration, respected by applyAmbientGrowth) already landed in 2D;
// this is what actually fires it. Radius floors at the safe radius
// (Confirmed decision 16). Self-centered — no ACQUIRE stage; the target
// is always the tower.
const frostPipeline: WeaponPipeline = {
  ready: cooldownReady('frost', frostCooldown),
  deliver: (state, lvl) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const radius = frostRadius(lvl, grid.perimeter);
    clearAt(state, t.x, t.y, frostDamage(lvl) * damageMult(state), {
      radiusPx: radius,
      freezeDuration: FREEZE_DURATION,
      coagulantMult: WEAPON_DEFS.frost?.coagulantMult ?? 1,
    });
    state.novaFx = { x: t.x, y: t.y, radius, life: FX_LIFE, maxLife: FX_LIFE };
  },
};

export function updateFrostWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.frost;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, frostPipeline);
}
