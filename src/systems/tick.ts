import type { GameState } from '../state';
import { ambientInfectionMult, SIM_TICK } from '../tuning/growth';
import { computeTierIndex, TIERS_LIST } from '../tuning/tiers';
import { updateCoagulants } from './coagulants';
import { tickContactDamage } from './contact';
import { updateEvents, updateEventSpawn } from './events';
import { computeFrontier } from './frontier';
import { applyAmbientGrowth } from './growth';

// Tiers are flavour only (Decision 33) — this updates the name/color
// announcement, nothing mechanical. The perimeter no longer moves with it
// (Decision 38: fixed, see tuning/world.ts's PERIMETER).
function updateTier(state: GameState): void {
  if (!state.grid) return;
  const newIdx = computeTierIndex(state.time);
  if (newIdx !== state.tierIndex) {
    state.tierIndex = newIdx;
    const tier = TIERS_LIST[newIdx];
    if (tier) {
      state.pendingAnnouncements.push(`OUTBREAK ESCALATING: ${tier.name}`);
    }
  }
}

function simulateTick(state: GameState, dt: number): void {
  if (!state.grid) return;
  updateTier(state);
  updateEventSpawn(state, dt);
  updateEvents(state, dt);
  updateCoagulants(state, dt);
  applyAmbientGrowth(state.grid, state.tower, ambientInfectionMult(state.time), dt, state.dirty);
  computeFrontier(state);
  tickContactDamage(state, dt);
}

// Fixed-timestep simulation via an accumulator, decoupled from render
// framerate (CLAUDE.md convention) — growth always advances in identical
// SIM_TICK steps regardless of actual frame rate. Direct port of the
// prototype's simAcc while-loop in its main loop().
export function runSimulation(state: GameState, dt: number): void {
  state.simAcc += dt;
  while (state.simAcc >= SIM_TICK) {
    simulateTick(state, SIM_TICK);
    state.simAcc -= SIM_TICK;
  }
}
