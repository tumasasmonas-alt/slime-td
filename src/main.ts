// Phase 1: canvas + camera + core rendering only. Systems (grid, weapons,
// entities, sim tick, ui) land in Phase 2 — see docs/KNOWN_ISSUES.md and
// docs/PROTOTYPE_HANDOFF.md for the porting plan.
import { applyCameraTransform, applyScreenTransform, fitCamera, type Camera } from './core/camera';
import { drawAmbientGrid, drawArenaBounds } from './render/background';
import { resizeCanvasToWindow, setupCanvas } from './render/canvas';
import { drawTower } from './render/tower';
import { freshState, type GameState } from './state';

const canvasEl = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvasEl) throw new Error('#game-canvas not found');
const { canvas, ctx } = setupCanvas(canvasEl);

const state: GameState = freshState();
state.running = true;

let camera: Camera = fitCamera(window.innerWidth, window.innerHeight);
let dpr = 1;

function handleResize(): void {
  const viewport = resizeCanvasToWindow(canvas);
  dpr = viewport.dpr;
  camera = fitCamera(viewport.width, viewport.height);
}
window.addEventListener('resize', handleResize);
handleResize();

function update(dt: number): void {
  state.time += dt;
}

function render(): void {
  applyScreenTransform(ctx, dpr);
  ctx.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  drawAmbientGrid(ctx, camera.viewportWidth, camera.viewportHeight, state.time);

  applyCameraTransform(ctx, camera, dpr);
  drawArenaBounds(ctx);
  drawTower(ctx, state);
}

let lastTs = performance.now();
function loop(ts: number): void {
  const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
