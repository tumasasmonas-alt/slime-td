// Phase 2D: contact damage, growth nodes, and game over/restart — a
// complete run with a real win/lose arc. Remaining weapons/passive
// polish lands in 2E/2F. See docs/KNOWN_ISSUES.md and
// docs/PROTOTYPE_HANDOFF.md.
import { applyCameraTransform, applyScreenTransform, fitCamera, type Camera } from './core/camera';
import { buildGrid } from './grid/grid';
import { flushDirtyCells, initSlimeLayer } from './grid/slimeLayer';
import { drawAmbientGrid, drawArenaBounds, drawSafeZone } from './render/background';
import { resizeCanvasToWindow, setupCanvas } from './render/canvas';
import { drawGems } from './render/gems';
import { drawNodes } from './render/nodes';
import { drawParticles } from './render/particles';
import { drawProjectiles } from './render/projectiles';
import { drawTower } from './render/tower';
import { freshState, type GameState } from './state';
import { updateGems } from './systems/gems';
import { updateParticles } from './systems/particles';
import { updateProjectiles } from './systems/projectiles';
import { runSimulation } from './systems/tick';
import { updateTowerTick } from './systems/tower';
import { updateWardPulse } from './systems/ward';
import { initHud, updateAnnounceFade, updateHud } from './ui/hud';
import { hideOverlays, initOverlays, showGameOver } from './ui/overlays';
import { initUpgradeCards, syncUpgradeOverlay } from './ui/upgradeCards';
import { updateBoltWeapon } from './weapons/bolt';

const canvasEl = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvasEl) throw new Error('#game-canvas not found');
const { canvas, ctx } = setupCanvas(canvasEl);

// Reassigned wholesale on every startRun() — a run's state doesn't carry
// over into the next one. `update`/`render` below close over this
// variable, not a snapshot of it, so reassignment is visible to them.
let state: GameState = freshState();

const hudRefs = initHud();
const cardRefs = initUpgradeCards();
const overlayRefs = initOverlays(startRun);

let camera: Camera = fitCamera(window.innerWidth, window.innerHeight);
let dpr = 1;

function handleResize(): void {
  const viewport = resizeCanvasToWindow(canvas);
  dpr = viewport.dpr;
  camera = fitCamera(viewport.width, viewport.height);
}
window.addEventListener('resize', handleResize);
handleResize();

// Rebuilds the grid from scratch — the reaction-diffusion re-runs, so
// every run gets a different vein pattern (matches the prototype, and
// suits a roguelite better than a fixed maze). Costs a ~200ms startup
// hitch, accepted deliberately; see "Confirmed decisions" in
// docs/PROGRESS.md.
function startRun(): void {
  state = freshState();
  state.grid = buildGrid();
  state.slimeLayer = initSlimeLayer(state.grid);
  state.running = true;
  // Bolt Turret starts equipped — matches the prototype's run-start,
  // which sets this directly rather than via WEAPON_DEFS.bolt's (unused)
  // startLevel.
  state.weapons.bolt = 1;
  hideOverlays(overlayRefs);
  updateHud(hudRefs, state);
}

function update(dt: number): void {
  // Mirrors the prototype's `if(!state.paused)` guard around its whole
  // per-frame update block, extended to also gate on `running` — no
  // simulation happens before Start is pressed or after game over.
  // render() below still runs every frame so overlays stay visible over
  // a frozen (or blank, pre-run) scene.
  if (!state.running || state.paused) return;

  state.time += dt;
  runSimulation(state, dt); // includes node spawn/influence and contact damage
  updateBoltWeapon(state, dt);
  updateProjectiles(state, dt);
  updateGems(state, dt);
  updateParticles(state, dt);
  updateWardPulse(state, dt);
  updateTowerTick(state, dt); // regen + shake decay
  updateAnnounceFade(hudRefs, state, dt);
  if (state.grid && state.slimeLayer) {
    flushDirtyCells(state.grid, state.slimeLayer, state.dirty);
  }
  syncUpgradeOverlay(cardRefs, state);
  updateHud(hudRefs, state);

  if (state.tower.hp <= 0 && state.running) {
    state.running = false;
    showGameOver(overlayRefs, state);
  }
}

function render(): void {
  applyScreenTransform(ctx, dpr);
  ctx.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  drawAmbientGrid(ctx, camera.viewportWidth, camera.viewportHeight, state.time);

  applyCameraTransform(ctx, camera, dpr);
  drawArenaBounds(ctx);

  if (state.grid) {
    // Screen shake feeds off contact damage — see systems/tower.ts.
    // Scoped to just the gameplay layer, not the arena-bounds debug
    // overlay above, which represents the fixed world frame.
    const shakeX = (Math.random() - 0.5) * state.tower.shake;
    const shakeY = (Math.random() - 0.5) * state.tower.shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (state.slimeLayer) ctx.drawImage(state.slimeLayer.canvas, 0, 0);
    drawSafeZone(ctx, state.tower.x, state.tower.y, state.grid.safeRadius, state.contactPressure);
    drawNodes(ctx, state);
    drawGems(ctx, state);
    drawProjectiles(ctx, state);
    drawParticles(ctx, state);
    drawTower(ctx, state);

    ctx.restore();
  }
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
