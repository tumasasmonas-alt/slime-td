import type { GameState } from '../state';

// dt-based decay in a real update pass — the prototype decremented
// novaFx.life by a hardcoded 1/60 *inside its render() call*, mutating
// state during a draw call and going wrong at any framerate but 60fps.
// Fixed at port time per docs/DECISIONS.md #4.
//
// Phase 5B-6: state.novaFx is a list now, not a single nullable slot —
// see docs/plans/phase-5b-framework.md S6a for why the single slot was a
// latent overwrite bug once a second pulse weapon existed.
export function updateNovaFx(state: GameState, dt: number): void {
  if (state.novaFx.length === 0) return;
  for (const fx of state.novaFx) fx.life -= dt;
  state.novaFx = state.novaFx.filter((fx) => fx.life > 0);
}
