import type { GameState } from '../state';
import { clamp } from '../util/math';
import { hexAlpha } from './color';

// Full port of the prototype's drawTower(). Elements driven by state that
// doesn't exist yet (contact pressure, weapon count) degrade gracefully to
// no-ops rather than needing to be rewritten when those systems land.
export function drawTower(ctx: CanvasRenderingContext2D, state: GameState): void {
  const t = state.tower;
  const pulse = 1 + Math.sin(state.time * 3) * 0.03;
  const pressure = clamp(state.contactPressure * 2, 0, 1);

  if (pressure > 0.02) {
    ctx.beginPath();
    ctx.strokeStyle = hexAlpha('#ff3f68', pressure * 0.6);
    ctx.lineWidth = 3;
    ctx.arc(t.x, t.y, t.radius * pulse + 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(109,240,255,0.25)';
  ctx.lineWidth = 2;
  ctx.arc(t.x, t.y, t.radius * pulse + 10, 0, Math.PI * 2);
  ctx.stroke();

  const ringCount = Math.min(4, Object.keys(state.weapons).length);
  for (let i = 0; i < ringCount; i++) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(109,240,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.arc(t.x, t.y, t.radius + 16 + i * 8, state.time * 0.6 + i, state.time * 0.6 + i + 2.4);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = '#0e0a12';
  ctx.arc(t.x, t.y, t.radius * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#6df0ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#6df0ff';
  ctx.shadowBlur = 18;
  ctx.arc(t.x, t.y, t.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.fillStyle = '#eafcff';
  ctx.arc(t.x, t.y, t.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();
}
