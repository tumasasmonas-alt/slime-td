import type { GameState } from '../state';

const GEM_COLOR = '#b6ffd1';
const GEM_HIGHLIGHT = 'rgba(255,255,255,0.55)';

// Deliberately pastel-green diamonds, not circles — round cyan gems were
// once mistaken for Bolt Turret projectiles "bouncing back" to the core,
// since both were circular and both drift/travel through the same space.
// See archive/PROTOTYPE_HANDOFF.md "Visual/style decisions to preserve".
export function drawGems(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const gem of state.gems) {
    drawGemDiamond(ctx, gem.x, gem.y, gem.radius);
  }
}

function drawGemDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const r = Math.max(3, radius * 0.85);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.fillStyle = GEM_COLOR;
  ctx.shadowColor = GEM_COLOR;
  ctx.shadowBlur = 7;
  ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = GEM_HIGHLIGHT;
  ctx.fillRect(-r * 0.62, -r * 0.62, r * 0.5, r * 0.5);
  ctx.restore();
}
