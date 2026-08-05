import type { GameState } from '../state';
import { clamp } from '../util/math';
import { hexAlpha } from './color';

const CHAIN_COLOR = '#e6c8ff';

export function drawChainFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const fx of state.chainFx) {
    const alpha = clamp(fx.life / fx.maxLife, 0, 1);
    ctx.beginPath();
    ctx.strokeStyle = hexAlpha(CHAIN_COLOR, alpha);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = CHAIN_COLOR;
    ctx.shadowBlur = 12;
    ctx.moveTo(fx.x1, fx.y1);
    ctx.lineTo(fx.mx, fx.my);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
