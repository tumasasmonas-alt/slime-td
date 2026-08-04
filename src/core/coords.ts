// Branded point types so world-space and screen-space coordinates can't be
// silently mixed at module boundaries — that mixup is the single most
// likely recurring bug once the camera exists (see conversation history:
// the prototype had no such distinction because world units and screen
// pixels were always identical). Construct via worldPoint()/screenPoint(),
// never as bare object literals, so the brand can't be forged by accident.
//
// Hot inner loops (grid iteration, reaction-diffusion) should keep using
// raw numbers named worldX/worldY rather than paying the allocation cost
// of these — they're for boundaries between modules, not per-cell math.
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly space: 'world';
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly space: 'screen';
}

export function worldPoint(x: number, y: number): WorldPoint {
  return { x, y, space: 'world' };
}

export function screenPoint(x: number, y: number): ScreenPoint {
  return { x, y, space: 'screen' };
}
