import type { GameState } from '../state';
import { hexAlpha } from './color';

// An expanding, fading ring — the only visible sign a pulse weapon fired
// rather than nothing happening at all. Draw-only; lifetime is decayed in
// systems/novaFx.ts, not here.
//
// Phase 5B-6: reads colour off the entity now, not a hardcoded constant —
// matching the pattern render/projectiles.ts and render/clouds.ts already
// use, so a second pulse weapon (Immolation Ring's visual, 6B) draws
// itself without this module knowing which weapon fired it. See
// docs/plans/phase-5b-framework.md S6a.
export function drawNovaFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const fx of state.novaFx) {
    if (fx.life <= 0) continue;
    const progress = 1 - fx.life / fx.maxLife;
    ctx.beginPath();
    ctx.strokeStyle = hexAlpha(fx.color, 1 - progress);
    ctx.lineWidth = 3;
    // Radar Sweep (Immolation, post-6D-3 playtest, 2026-08-11): a wedge
    // outline instead of a full ring when the entity carries an angular
    // mask — drawing a full ring here for a hit that only damaged a slice
    // of it would be exactly the kind of visual lying about the mechanic
    // this project has repeatedly caught and fixed elsewhere (gem copy,
    // Decision 92).
    if (fx.angle !== undefined && fx.halfWidth !== undefined) {
      const r = fx.radius * progress;
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x + Math.cos(fx.angle - fx.halfWidth) * r, fx.y + Math.sin(fx.angle - fx.halfWidth) * r);
      ctx.arc(fx.x, fx.y, r, fx.angle - fx.halfWidth, fx.angle + fx.halfWidth);
      ctx.lineTo(fx.x, fx.y);
    } else {
      ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
}
