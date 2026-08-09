import type { GameState } from '../state';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10a): a rolling
// smoothed rate rather than an instant per-frame value, so the number
// doesn't jump wildly between the frame a hit lands and the frames
// between. ~1.5s: fast enough to feel responsive to a build change,
// slow enough not to read as noise.
const DPS_TIME_CONSTANT = 1.5;

// Called once per frame from main.ts's update pass, after every weapon
// has had a chance to call clearAt this frame — never from a draw call,
// per Decisions 4/7. Drains state.dpsAccum (grid/clear.ts's per-frame
// mass-destroyed total) into an exponentially-smoothed state.dps.
export function updateDps(state: GameState, dt: number): void {
  if (dt <= 0) return;
  const instantRate = state.dpsAccum / dt;
  const smoothing = 1 - Math.exp(-dt / DPS_TIME_CONSTANT);
  state.dps += (instantRate - state.dps) * smoothing;
  state.dpsAccum = 0;
}
