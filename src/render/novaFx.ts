import type { GameState } from '../state';
import { hexAlpha } from './color';

const NOVA_COLOR = '#bfe9ff';

// An expanding, fading ring — the only visible sign Frost Nova is an
// untargeted pulse rather than nothing happening at all. Draw-only;
// its lifetime is decayed in systems/novaFx.ts, not here.
export function drawNovaFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  const fx = state.novaFx;
  if (!fx || fx.life <= 0) return;
  const progress = 1 - fx.life / fx.maxLife;
  ctx.beginPath();
  ctx.strokeStyle = hexAlpha(NOVA_COLOR, 1 - progress);
  ctx.lineWidth = 3;
  ctx.arc(fx.x, fx.y, fx.radius * progress, 0, Math.PI * 2);
  ctx.stroke();
}
