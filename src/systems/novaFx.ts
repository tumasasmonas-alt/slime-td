import type { GameState } from '../state';

// dt-based decay in a real update pass — the prototype decremented
// novaFx.life by a hardcoded 1/60 *inside its render() call*, mutating
// state during a draw call and going wrong at any framerate but 60fps.
// Fixed at port time per Confirmed decision 4 in docs/PROGRESS.md.
export function updateNovaFx(state: GameState, dt: number): void {
  if (!state.novaFx) return;
  state.novaFx.life -= dt;
  if (state.novaFx.life <= 0) state.novaFx = null;
}
