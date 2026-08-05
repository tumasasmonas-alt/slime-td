import type { GameState } from '../state';
import { fmtTime } from '../util/math';

export interface OverlayRefs {
  startOverlay: HTMLElement;
  gameOverOverlay: HTMLElement;
  goTime: HTMLElement;
  goLevel: HTMLElement;
  goKills: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

// Both Start and Try Again trigger the same onStart callback — matches
// the prototype's startRun() being wired to both buttons identically.
export function initOverlays(onStart: () => void): OverlayRefs {
  const refs: OverlayRefs = {
    startOverlay: requireEl('start-overlay'),
    gameOverOverlay: requireEl('gameover-overlay'),
    goTime: requireEl('go-time'),
    goLevel: requireEl('go-level'),
    goKills: requireEl('go-kills'),
  };
  const startBtn = requireEl('start-btn');
  const restartBtn = requireEl('restart-btn');
  startBtn.addEventListener('click', onStart);
  restartBtn.addEventListener('click', onStart);
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
