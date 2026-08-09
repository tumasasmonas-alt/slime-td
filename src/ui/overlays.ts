import type { GameState } from '../state';
import { fmtTime } from '../util/math';
import { renderDeckLine } from './weaponSelect';

export interface OverlayRefs {
  startOverlay: HTMLElement;
  gameOverOverlay: HTMLElement;
  goTime: HTMLElement;
  goLevel: HTMLElement;
  goKills: HTMLElement;
  startDeckLine: HTMLElement;
  gameOverDeckLine: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Both Start and Try Again trigger the same onStart callback — matches
// the prototype's startRun() being wired to both buttons identically.
// Phase 6-0 (docs/plans/phase-6-0-weapon-select.md S3): "Choose Weapons"
// and "Change Loadout" are the two entry points into the weapon-select
// overlay, both wired to the same onChooseWeapons callback for the same
// reason — this module owns the start and game-over screens those
// buttons live on, so it owns wiring them, even though the overlay they
// open belongs to ui/weaponSelect.ts.
export function initOverlays(onStart: () => void, onChooseWeapons: () => void): OverlayRefs {
  const refs: OverlayRefs = {
    startOverlay: requireEl('start-overlay'),
    gameOverOverlay: requireEl('gameover-overlay'),
    goTime: requireEl('go-time'),
    goLevel: requireEl('go-level'),
    goKills: requireEl('go-kills'),
    startDeckLine: requireEl('start-deck-line'),
    gameOverDeckLine: requireEl('gameover-deck-line'),
  };
  const startBtn = requireEl('start-btn');
  const restartBtn = requireEl('restart-btn');
  startBtn.addEventListener('click', onStart);
  restartBtn.addEventListener('click', onStart);
  requireEl('choose-weapons-btn').addEventListener('click', onChooseWeapons);
  requireEl('change-loadout-btn').addEventListener('click', onChooseWeapons);
  renderDeckLine(refs.startDeckLine);
  renderDeckLine(refs.gameOverDeckLine);
  return refs;
}

export function hideOverlays(refs: OverlayRefs): void {
  refs.startOverlay.classList.add('hidden');
  refs.gameOverOverlay.classList.add('hidden');
}

export function showGameOver(refs: OverlayRefs, state: GameState): void {
  refs.goTime.textContent = fmtTime(state.time);
  refs.goLevel.textContent = String(state.tower.level);
  refs.goKills.textContent = String(state.nodesPurged);
  refs.gameOverOverlay.classList.remove('hidden');
}

// Called after a run starts and after a weapon-select confirm — the deck
// can only change via the select screen's Start button, but both entry
// points are cheap to keep in sync rather than tracking which one moved.
export function refreshDeckLines(refs: OverlayRefs): void {
  renderDeckLine(refs.startDeckLine);
  renderDeckLine(refs.gameOverDeckLine);
}
