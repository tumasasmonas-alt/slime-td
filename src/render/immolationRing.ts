import type { GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { weaponMods } from '../systems/weaponMods';
import { immolationRadius } from '../tuning/weapons';

export const IMMOLATION_RING_COLOR = '#39ff6a';
// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S5): matches
// weapons/immolation.ts's own SECOND_RING_MULT — the render must not
// compute its own radius, or the visual and the damage drift apart, the
// same desync risk 6A-2 refused to take when it declined to wire Homing
// into this weapon.
const SECOND_RING_MULT = 1.4;

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
  ctx.strokeStyle = IMMOLATION_RING_COLOR;
  ctx.lineWidth = 2;
  ctx.shadowColor = IMMOLATION_RING_COLOR;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.55;

  ctx.beginPath();
  ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (extensionLevel(state, 'immolation', 'secondRing') > 0) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius * SECOND_RING_MULT, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
