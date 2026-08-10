import type { GameState } from '../state';
import { hexAlpha } from './color';

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S2.1-S2.2): draws
// a continuously-computed radius rather than the entity's own `radius`
// field — that field only advances once per SIM_TICK (systems/
// shockwave.ts), which would visibly stutter if drawn directly. Render
// and damage are deliberately decoupled: this is purely a fading stroked
// circle, the same visual vocabulary render/novaFx.ts already
// established (arsenal plan S9½'s claim survives for the render layer,
// even though it was wrong about the damage — umbrella plan finding 2).
export function drawShockwaveRings(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const ring of state.shockwaveRings) {
    if (state.time < ring.bornAt) continue;
    const elapsed = state.time - ring.bornAt;
    const r = ring.inward
      ? Math.max(ring.startRadius, ring.maxRadius - ring.speed * elapsed)
      : Math.min(ring.maxRadius, ring.startRadius + ring.speed * elapsed);
    const progress = ring.inward ? (ring.maxRadius - r) / (ring.maxRadius - ring.startRadius || 1) : (r - ring.startRadius) / (ring.maxRadius - ring.startRadius || 1);
    ctx.beginPath();
    ctx.strokeStyle = hexAlpha(ring.color, Math.max(0.15, 1 - progress * 0.6));
    ctx.lineWidth = 4;
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
