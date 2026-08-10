import type { GameState } from '../state';

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S5.1): decays state.beamFx —
// the same dt-based-in-a-real-update-pass shape systems/novaFx.ts already
// established (never inside a draw call, Decision 4/7's bug class).
export function updateBeamFx(state: GameState, dt: number): void {
  if (state.beamFx.length === 0) return;
  for (const fx of state.beamFx) fx.life -= dt;
  state.beamFx = state.beamFx.filter((fx) => fx.life > 0);
}
