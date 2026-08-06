import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { atkSpeedMult, damageMult } from '../systems/passives';
import { frostCooldown, frostDamage, frostRadius } from '../tuning/weapons';

const FREEZE_DURATION = 2.0;
const FX_LIFE = 0.4;

// Untargeted — pulses outward from the tower on a cooldown, damaging and
// freezing growth in radius. The freeze mechanic itself (clearAt's
// freezeDuration, respected by applyAmbientGrowth) already landed in 2D;
// this is what actually fires it. Radius floors at the safe radius
// (Confirmed decision 16).
export function updateFrostWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.frost;
  const grid = state.grid;
  if (!lvl || !grid) return;
  state.weaponTimers.frost -= dt;
  if (state.weaponTimers.frost > 0) return;
  state.weaponTimers.frost = frostCooldown(lvl) / atkSpeedMult(state);

  const t = state.tower;
  const radius = frostRadius(lvl, grid.perimeter);
  clearAt(state, t.x, t.y, frostDamage(lvl) * damageMult(state), {
    radiusPx: radius,
    freezeDuration: FREEZE_DURATION,
  });
  state.novaFx = { x: t.x, y: t.y, radius, life: FX_LIFE, maxLife: FX_LIFE };
}
