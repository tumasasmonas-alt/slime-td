import type { CausticCloud, GameState } from '../state';
import { clamp } from '../util/math';
import { hexAlpha } from './color';

const RIM_COLOR = '#c9ff8a';
const BUBBLE_COLOR = '#e4ffbf';

// A flat translucent disc read as nearly invisible against the busy
// background and "broken" even though it was ticking damage correctly
// — see archive/PROTOTYPE_HANDOFF.md. The bright rim and pulsing bubbles
// are what make it read as a toxic pool.
export function drawClouds(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const c of state.clouds) {
    drawCloud(ctx, state.time, c);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, time: number, c: CausticCloud): void {
  const lifeFrac = clamp(c.life / c.maxLife, 0, 1);

  ctx.beginPath();
  ctx.fillStyle = hexAlpha(c.color, lifeFrac * 0.55);
  ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = hexAlpha(RIM_COLOR, lifeFrac * 0.8);
  ctx.lineWidth = 2;
  ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
  ctx.stroke();

  for (const b of c.bubbleSeeds) {
    const bx = c.x + Math.cos(b.a) * c.radius * b.r;
    const by = c.y + Math.sin(b.a) * c.radius * b.r;
    const pulse = 0.5 + 0.5 * Math.sin(time * b.speed + b.phase);
    const br = (3 + pulse * 3.5) * lifeFrac;
    ctx.beginPath();
    ctx.fillStyle = hexAlpha(BUBBLE_COLOR, 0.6 * lifeFrac);
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}
