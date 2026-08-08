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
    ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
    ctx.stroke();
  }
}
