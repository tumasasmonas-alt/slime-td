export interface CanvasSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function setupCanvas(canvas: HTMLCanvasElement): CanvasSurface {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas rendering context is unavailable');
  return { canvas, ctx };
}

export interface ViewportSize {
  width: number;
  height: number;
  dpr: number;
}

const MAX_DPR = 2;

// Sizes the canvas backing store to windowSize * DPR (capped at 2, as the
// prototype did) while keeping its CSS size at the raw window size — this
// is what makes 4K screens render sharp instead of upscaled.
export function resizeCanvasToWindow(canvas: HTMLCanvasElement): ViewportSize {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return { width, height, dpr };
}
