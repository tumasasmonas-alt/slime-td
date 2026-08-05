import { clamp, lerp } from '../util/math';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';

const GRID_SIZE = 64;
const GRID_SPEED = 4;
const GRID_COLOR = 'rgba(109,240,255,0.035)';
const ARENA_BOUNDS_COLOR = 'rgba(109,240,255,0.08)';

// Cyan "sanctuary" framing at rest, danger red at full breach — Confirmed
// docs/DECISIONS.md #19. The ring deliberately keeps reading
// as "yours to defend" rather than looking hazardous by default; the
// tension comes from that framing being violated as contactPressure
// rises, not from the ring looking dangerous from the start.
const SAFE_ZONE_COLOR = { r: 109, g: 240, b: 255 };
const BREACH_COLOR = { r: 255, g: 63, b: 104 }; // matches the tower's own danger-pulse ring (render/tower.ts)

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

// Dashed ring at the safe radius — the line the player must keep the
// infection from crossing. Shifts color, thickens, and brightens toward
// danger red as `pressure` (state.contactPressure, 0-1) rises, so it
// reads as a live "how badly is this being breached" signal rather than
// a static boundary. See docs/DECISIONS.md #18, 19.
export function drawSafeZone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  pressure: number,
): void {
  const p = clamp(pressure, 0, 1);
  const r = lerp(SAFE_ZONE_COLOR.r, BREACH_COLOR.r, p);
  const g = lerp(SAFE_ZONE_COLOR.g, BREACH_COLOR.g, p);
  const b = lerp(SAFE_ZONE_COLOR.b, BREACH_COLOR.b, p);
  const alpha = lerp(0.15, 0.75, p);
  const lineWidth = lerp(1, 2.5, p);
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = `rgba(${r.toFixed(0)},${g.toFixed(0)},${b.toFixed(0)},${alpha.toFixed(3)})`;
  ctx.lineWidth = lineWidth;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
