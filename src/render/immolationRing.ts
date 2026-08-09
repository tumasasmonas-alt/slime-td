import type { GameState } from '../state';
import { weaponMods } from '../systems/weaponMods';
import { immolationRadius } from '../tuning/weapons';

export const IMMOLATION_RING_COLOR = '#39ff6a';

// Phase 6A-1: closes the standing BACKLOG item — Immolation Ring has had
// no visual since the Phase 2 port (misfiled as a passive; Decision 70's
// promotion only fixed the architecture half, and deliberately deferred
// the visual). A persistent ring at the weapon's actual burn radius, not
// just a flash on tick: arsenal plan S7.11 describes this weapon as "a
// burning ring [that] sits at the perimeter... always relevant, never
// bursty," so the visual has to be standing, not momentary — the flash
// weapons/immolation.ts separately pushes onto novaFx each time it
// actually ticks (matching every other pulse weapon's pattern) is the
// moment-to-moment confirmation; this is the always-on "here is where it
// lives."
export function drawImmolationRing(ctx: CanvasRenderingContext2D, state: GameState): void {
  const lvl = state.weapons.immolation;
  const grid = state.grid;
  if (!lvl || !grid) return;

  const mods = weaponMods(state, 'immolation');
  const radius = immolationRadius(lvl, grid.perimeter) * mods.area;
  const t = state.tower;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = IMMOLATION_RING_COLOR;
  ctx.lineWidth = 2;
  ctx.shadowColor = IMMOLATION_RING_COLOR;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.55;
  ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
