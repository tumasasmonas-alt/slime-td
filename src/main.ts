// Phase 2B: grid + ambient growth + fixed-timestep sim tick wired into the
// real render loop. Remaining systems (weapons, entities, ui) land in later
// Phase 2 steps — see docs/KNOWN_ISSUES.md and docs/PROTOTYPE_HANDOFF.md.
import { applyCameraTransform, applyScreenTransform, fitCamera, type Camera } from './core/camera';
import { buildGrid } from './grid/grid';
import { flushDirtyCells, initSlimeLayer } from './grid/slimeLayer';
import { drawAmbientGrid, drawArenaBounds, drawSafeZone } from './render/background';
import { resizeCanvasToWindow, setupCanvas } from './render/canvas';
import { drawTower } from './render/tower';
import { freshState, type GameState } from './state';
import { runSimulation } from './systems/tick';

const canvasEl = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvasEl) throw new Error('#game-canvas not found');
const { canvas, ctx } = setupCanvas(canvasEl);

const state: GameState = freshState();
state.grid = buildGrid();
state.slimeLayer = initSlimeLayer(state.grid);
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
  runSimulation(state, dt);
  if (state.grid && state.slimeLayer) {
    flushDirtyCells(state.grid, state.slimeLayer, state.dirty);
  }
}

function render(): void {
  applyScreenTransform(ctx, dpr);
  ctx.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  drawAmbientGrid(ctx, camera.viewportWidth, camera.viewportHeight, state.time);

  applyCameraTransform(ctx, camera, dpr);
  drawArenaBounds(ctx);
  if (state.slimeLayer) ctx.drawImage(state.slimeLayer.canvas, 0, 0);
  if (state.grid) drawSafeZone(ctx, state.tower.x, state.tower.y, state.grid.safeRadius);
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
