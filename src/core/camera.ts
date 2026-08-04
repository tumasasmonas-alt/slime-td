import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { screenPoint, worldPoint, type ScreenPoint, type WorldPoint } from './coords';

// Fits the fixed world (see tuning/world.ts) into whatever viewport it's
// given, uniformly scaled (never stretched) and centered — the remainder
// is a letterbox/pillarbox bar, not extra visible world. Every player sees
// the identical arena; only how large it is on screen changes.
export interface Camera {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export function fitCamera(viewportWidth: number, viewportHeight: number): Camera {
  const scale = Math.min(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT);
  return {
    scale,
    offsetX: (viewportWidth - WORLD_WIDTH * scale) / 2,
    offsetY: (viewportHeight - WORLD_HEIGHT * scale) / 2,
    viewportWidth,
    viewportHeight,
  };
}

export function worldToScreen(camera: Camera, p: WorldPoint): ScreenPoint {
  return screenPoint(p.x * camera.scale + camera.offsetX, p.y * camera.scale + camera.offsetY);
}

export function screenToWorld(camera: Camera, p: ScreenPoint): WorldPoint {
  return worldPoint((p.x - camera.offsetX) / camera.scale, (p.y - camera.offsetY) / camera.scale);
}

// Composes the camera fit with device-pixel-ratio backing-store scaling
// into a single canvas transform. Everything drawn after calling this can
// use raw world-unit coordinates directly — no per-draw-call conversion.
export function applyCameraTransform(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
  ctx.setTransform(camera.scale * dpr, 0, 0, camera.scale * dpr, camera.offsetX * dpr, camera.offsetY * dpr);
}

// Resets to a plain DPR-scaled transform, i.e. raw CSS-pixel coordinates —
// for screen-space passes (background, letterbox fill) drawn before the
// camera transform applies.
export function applyScreenTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
