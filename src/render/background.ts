import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';

const GRID_SIZE = 64;
const GRID_SPEED = 4;
const GRID_COLOR = 'rgba(109,240,255,0.035)';
const ARENA_BOUNDS_COLOR = 'rgba(109,240,255,0.08)';

// Faint drifting grid, drawn in raw screen space before the camera
// transform applies — it fills the letterbox bars too, so they read as
// ambient framing rather than dead space.
export function drawAmbientGrid(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  time: number,
): void {
  ctx.save();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  const offset = (time * GRID_SPEED) % GRID_SIZE;
  for (let x = offset; x < viewportWidth; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewportHeight);
    ctx.stroke();
  }
  for (let y = offset; y < viewportHeight; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Dev-visible outline of the fixed world arena, drawn in world space —
// makes the camera/letterbox math visually verifiable at any window size.
// Cheap enough to leave in as a permanent debug aid.
export function drawArenaBounds(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = ARENA_BOUNDS_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.restore();
}
