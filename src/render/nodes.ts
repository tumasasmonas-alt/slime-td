import type { GameState, GrowthNode } from '../state';
import { clamp } from '../util/math';

const NODE_COLOR = '#ffcf4d';
const HP_BAR_WIDTH = 54;
const HP_BAR_HEIGHT = 5;
const HP_BAR_OFFSET_Y = 30;

// Nodes are the priority target, so they're deliberately the most
// visually "important-looking" thing on screen: pulsing gold core, a
// faint influence-radius tint, and a red HP bar. Direct port of the
// prototype's drawNode().
export function drawNodes(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const node of state.nodes) {
    if (!node.dead) drawNode(ctx, state, node);
  }
}

function drawNode(ctx: CanvasRenderingContext2D, state: GameState, n: GrowthNode): void {
  const pulse = 1 + Math.sin(state.time * 4 + n.pulseSeed) * 0.15;

  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,207,77,0.12)';
  ctx.arc(n.x, n.y, n.radius * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = NODE_COLOR;
  ctx.shadowColor = NODE_COLOR;
  ctx.shadowBlur = 18;
  ctx.arc(n.x, n.y, 12 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#0008';
  ctx.fillRect(n.x - HP_BAR_WIDTH / 2, n.y - HP_BAR_OFFSET_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(
    n.x - HP_BAR_WIDTH / 2,
    n.y - HP_BAR_OFFSET_Y,
    HP_BAR_WIDTH * clamp(n.hp / n.maxHp, 0, 1),
    HP_BAR_HEIGHT,
  );
}
