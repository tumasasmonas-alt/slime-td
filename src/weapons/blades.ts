import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { damageMult } from '../systems/passives';
import { bladeCount, bladeDamage, bladeRadius } from '../tuning/weapons';

const SPIN_SPEED = 2.4;
const HIT_RADIUS = 16;
const HIT_COOLDOWN = 0.22;
const VISUAL_RADIUS = 10;

// No targeting at all — blades circle the tower and damage whatever
// revealed tissue they sweep through, each on its own per-slot cooldown
// (state.bladeNextHit) so a blade can't hit the same patch every single
// frame. orbitRadius comes from bladeRadius(), which floors at the safe
// radius (Confirmed decision 16 in docs/PROGRESS.md) so blades can never
// end up smaller than the zone they're meant to defend — see
// "documented prototype bugs" #5.
//
// Takes `_dt` only to match the (state, dt) signature every other
// weapon update function uses — blades have no cooldown timer of their
// own, driven purely by state.time and the per-slot hit cooldown.
export function updateBladesWeapon(state: GameState, _dt: number): void {
  const lvl = state.weapons.blades;
  const grid = state.grid;
  if (!lvl || !grid) {
    state.orbitals = [];
    return;
  }

  const t = state.tower;
  const count = bladeCount(lvl);
  const dmg = bladeDamage(lvl) * damageMult(state);
  const spin = state.time * SPIN_SPEED;
  const radius = bladeRadius(lvl, grid.safeRadius);

  state.orbitals = [];
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    const bx = t.x + Math.cos(a) * radius;
    const by = t.y + Math.sin(a) * radius;
    state.orbitals.push({ x: bx, y: by, radius: VISUAL_RADIUS });

    const { cx, cy } = worldToCell(grid, bx, by);
    const ci = gIdx(grid, cx, cy);
    const nextAllowed = state.bladeNextHit[i] ?? 0;
    if (isRevealedIdx(grid, ci) && state.time >= nextAllowed) {
      clearAt(state, bx, by, dmg, { radiusPx: HIT_RADIUS });
      state.bladeNextHit[i] = state.time + HIT_COOLDOWN;
    }
  }
}
