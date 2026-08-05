import type { GameState } from '../state';
import { clamp } from '../util/math';
import { hexAlpha } from './color';

export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.beginPath();
    ctx.fillStyle = hexAlpha(p.color, alpha);
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}
