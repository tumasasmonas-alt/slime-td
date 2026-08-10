// Phase 3A: the horde-economy teardown — growth nodes removed, the
// perimeter fixed, tiers demoted to flavour. See docs/PROGRESS.md and
// docs/DECISIONS.md #38-46.
import { applyCameraTransform, applyScreenTransform, fitCamera, type Camera } from './core/camera';
import { buildGrid } from './grid/grid';
import { flushDirtyCells, initSlimeLayer } from './grid/slimeLayer';
import { drawAmbientGrid, drawArenaBounds, drawSafeZone } from './render/background';
import { drawBeamFx, drawLanceCharge } from './render/beam';
import { resizeCanvasToWindow, setupCanvas } from './render/canvas';
import { drawChainFx } from './render/chainFx';
import { drawClouds } from './render/clouds';
import { drawCoagulants } from './render/coagulants';
import { drawInfectionEvents } from './render/events';
import { drawGems } from './render/gems';
import { drawImmolationRing } from './render/immolationRing';
import { drawNovaFx } from './render/novaFx';
import { drawOrbitals } from './render/orbitals';
import { drawParticles } from './render/particles';
import { drawProjectiles } from './render/projectiles';
import { drawShockwaveRings } from './render/shockwave';
import { drawTower } from './render/tower';
import { freshState, type GameState } from './state';
import { updateBeamFx } from './systems/beam';
import { updateChainFx } from './systems/chainFx';
import { updateClouds } from './systems/clouds';
import { updateDps } from './systems/dps';
import { updateGems } from './systems/gems';
import { updateNovaFx } from './systems/novaFx';
import { updateParticles } from './systems/particles';
import { updateProjectiles } from './systems/projectiles';
import { runSimulation } from './systems/tick';
import { updateTowerTick } from './systems/tower';
import { initHud, updateAnnounceFade, updateHud } from './ui/hud';
import { closeInventory, initInventory, openInventory } from './ui/inventory';
import { hideOverlays, initOverlays, refreshDeckLines, showGameOver } from './ui/overlays';
import { initUpgradeCards, syncUpgradeOverlay } from './ui/upgradeCards';
import { closeWeaponSelect, initWeaponSelect, openWeaponSelect, resolveDeck } from './ui/weaponSelect';
import { drainPendingEmissions, updateAllWeapons } from './weapons/registry';

const canvasEl = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvasEl) throw new Error('#game-canvas not found');
const { canvas, ctx } = setupCanvas(canvasEl);

// Reassigned wholesale on every startRun() — a run's state doesn't carry
// over into the next one. `update`/`render` below close over this
// variable, not a snapshot of it, so reassignment is visible to them.
let state: GameState = freshState();

const hudRefs = initHud();
// Phase 5C (docs/plans/phase-5c-inventory-ui.md S5): forward references
// to functions declared later in this file — safe because `function`
// declarations hoist, and these callbacks only ever run from a click,
// long after the whole module has finished initializing. Same pattern
// `initOverlays(startRun)` below already relies on.
// Phase 6A-1: onGemPicked reuses the exact same "open inventory,
// remember we came from level-up" flow as Manage Loadout — a gem card's
// only extra behaviour is which callback fires when it's clicked.
const cardRefs = initUpgradeCards(handleOpenInventoryFromLevelUp, handleOpenInventoryFromLevelUp);
const overlayRefs = initOverlays(startRun, handleOpenWeaponSelect);
const inventoryRefs = initInventory('loadout-btn', 'inventory-close-btn', handleOpenInventoryFromHud, handleCloseInventory);
// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S3): the overlay's own
// Start button starts a run directly (same callback as Start Run/Try
// Again); Back just closes it, leaving whichever of the start/game-over
// screens opened it visible underneath — neither is ever hidden by
// opening this one on top of it.
const weaponSelectRefs = initWeaponSelect('weapon-select-start-btn', 'weapon-select-back-btn', startRun, handleCloseWeaponSelect);
// Tracks which of the two entry points opened the inventory, so closing
// it knows whether to resume the run or re-show the pending level-up
// cards rather than silently discarding them.
let openedInventoryFromLevelUp = false;

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
// hitch, accepted deliberately; see docs/DECISIONS.md.
function startRun(): void {
  state = freshState();
  state.grid = buildGrid();
  state.slimeLayer = initSlimeLayer(state.grid);
  state.running = true;
  // Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S1): the deck is
  // chosen on the pre-run select screen and immutable for the run's
  // duration — no mid-run weapon changes, ever, per the project owner's
  // 2026-08-09 call. resolveDeck() falls back to the default kit
  // (Bolt/Chain/Poison, arsenal plan S12.4) if the stored deck's size
  // ever disagrees with weaponSlots, which can't happen yet but will
  // once Phase 7 lets a player buy a slot mid-meta.
  for (const key of resolveDeck(state.weaponSlots)) {
    state.weapons[key] = 1;
  }
  hideOverlays(overlayRefs);
  closeInventory(inventoryRefs); // defensive — nothing reaches this mid-run today, but a fresh run should never inherit a stuck overlay
  closeWeaponSelect(weaponSelectRefs); // defensive, same reasoning — a run starting from the select screen's own Start button must not leave it open underneath
  refreshDeckLines(overlayRefs);
  updateHud(hudRefs, state);
}

// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S3): opened from either
// the start screen's "Choose Weapons" button or the game-over screen's
// "Change Loadout" button — both wired to this same handler by
// ui/overlays.ts, which owns those two screens.
function handleOpenWeaponSelect(): void {
  openWeaponSelect(weaponSelectRefs, state.weaponSlots);
}

function handleCloseWeaponSelect(): void {
  closeWeaponSelect(weaponSelectRefs);
}

// Phase 5C (docs/plans/phase-5c-inventory-ui.md S5): opened either from
// the HUD button during normal play, or from a "Manage Loadout" button
// inside the level-up card screen — see openedInventoryFromLevelUp above
// for why closing needs to remember which.
function handleOpenInventoryFromHud(): void {
  if (!state.running || state.paused) return;
  state.paused = true;
  openedInventoryFromLevelUp = false;
  openInventory(inventoryRefs, state);
}

function handleOpenInventoryFromLevelUp(): void {
  cardRefs.overlay.classList.add('hidden');
  openedInventoryFromLevelUp = true;
  openInventory(inventoryRefs, state);
}

function handleCloseInventory(): void {
  closeInventory(inventoryRefs);
  if (openedInventoryFromLevelUp && state.pendingLevelUps > 0) {
    syncUpgradeOverlay(cardRefs, state); // re-shows the pending cards; state.paused stays true throughout
  } else {
    state.paused = false;
  }
}

function update(dt: number): void {
  // Mirrors the prototype's `if(!state.paused)` guard around its whole
  // per-frame update block, extended to also gate on `running` — no
  // simulation happens before Start is pressed or after game over.
  // render() below still runs every frame so overlays stay visible over
  // a frozen (or blank, pre-run) scene.
  if (!state.running || state.paused) return;

  state.time += dt;
  runSimulation(state, dt); // includes ambient growth and contact damage
  updateAllWeapons(state, dt); // Phase 6A-2: one registry-driven loop, replacing seven hand-written calls
  drainPendingEmissions(state); // Echo/Barrage follow-ups due this frame
  updateProjectiles(state, dt);
  updateGems(state, dt);
  updateParticles(state, dt);
  updateChainFx(state, dt);
  updateNovaFx(state, dt);
  updateBeamFx(state, dt);
  updateClouds(state, dt);
  updateTowerTick(state, dt); // regen + shake decay
  updateAnnounceFade(hudRefs, state, dt);
  if (state.grid && state.slimeLayer) {
    flushDirtyCells(state.grid, state.slimeLayer, state.dirty);
  }
  updateDps(state, dt); // drains this frame's clearAt accumulation — after every weapon/cloud update, before the HUD reads it
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
    drawCoagulants(ctx, state);
    drawClouds(ctx, state);
    drawNovaFx(ctx, state);
    drawShockwaveRings(ctx, state);
    drawSafeZone(ctx, state.tower.x, state.tower.y, state.grid.perimeter, state.contactPressure);
    drawImmolationRing(ctx, state);
    drawLanceCharge(ctx, state);
    drawInfectionEvents(ctx, state);
    drawGems(ctx, state);
    drawOrbitals(ctx, state);
    drawProjectiles(ctx, state);
    drawBeamFx(ctx, state);
    drawChainFx(ctx, state);
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
