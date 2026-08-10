import type { GameState } from '../state';

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.projectiles) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.type === 'missile' || p.type === 'fission' ? 14 : 8;
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
