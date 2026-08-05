// Phase 2C: first playable loop — Bolt Turret, projectiles, gems,
// XP/leveling, upgrade cards, HUD. Remaining weapons/passives land in
// Phase 2E; contact damage, growth nodes, and game over land in 2D. See
// docs/KNOWN_ISSUES.md and docs/PROTOTYPE_HANDOFF.md.
import { applyCameraTransform, applyScreenTransform, fitCamera, type Camera } from './core/camera';
import { buildGrid } from './grid/grid';
import { flushDirtyCells, initSlimeLayer } from './grid/slimeLayer';
import { drawAmbientGrid, drawArenaBounds, drawSafeZone } from './render/background';
import { resizeCanvasToWindow, setupCanvas } from './render/canvas';
import { drawGems } from './render/gems';
import { drawParticles } from './render/particles';
import { drawProjectiles } from './render/projectiles';
import { drawTower } from './render/tower';
import { freshState, type GameState } from './state';
import { updateGems } from './systems/gems';
import { updateParticles } from './systems/particles';
import { updateProjectiles } from './systems/projectiles';
import { runSimulation } from './systems/tick';
import { updateWardPulse } from './systems/ward';
import { initHud, updateAnnounceFade, updateHud } from './ui/hud';
import { initUpgradeCards, syncUpgradeOverlay } from './ui/upgradeCards';
import { updateBoltWeapon } from './weapons/bolt';

const canvasEl = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvasEl) throw new Error('#game-canvas not found');
const { canvas, ctx } = setupCanvas(canvasEl);

const state: GameState = freshState();
state.grid = buildGrid();
state.slimeLayer = initSlimeLayer(state.grid);
state.running = true;
// Bolt Turret starts equipped — matches the prototype's run-start, which
// sets this directly rather than via WEAPON_DEFS.bolt's (unused) startLevel.
state.weapons.bolt = 1;

const hudRefs = initHud();
const cardRefs = initUpgradeCards();

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
  // Mirrors the prototype's `if(!state.paused)` guard around its whole
  // per-frame update block — the upgrade overlay freezes gameplay but
  // render() below still runs every frame so the cards stay visible.
  if (state.paused) return;

  state.time += dt;
  runSimulation(state, dt);
  updateBoltWeapon(state, dt);
  updateProjectiles(state, dt);
  updateGems(state, dt);
  updateParticles(state, dt);
  updateWardPulse(state, dt);
  updateAnnounceFade(hudRefs, state, dt);
  if (state.grid && state.slimeLayer) {
    flushDirtyCells(state.grid, state.slimeLayer, state.dirty);
  }
  syncUpgradeOverlay(cardRefs, state);
  updateHud(hudRefs, state);
}

function render(): void {
  applyScreenTransform(ctx, dpr);
  ctx.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  drawAmbientGrid(ctx, camera.viewportWidth, camera.viewportHeight, state.time);

  applyCameraTransform(ctx, camera, dpr);
  drawArenaBounds(ctx);
  if (state.slimeLayer) ctx.drawImage(state.slimeLayer.canvas, 0, 0);
  if (state.grid) drawSafeZone(ctx, state.tower.x, state.tower.y, state.grid.safeRadius);
  drawGems(ctx, state);
  drawProjectiles(ctx, state);
  drawParticles(ctx, state);
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
