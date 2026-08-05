import type { GameState } from '../state';
import { SIM_TICK } from '../tuning/growth';
import { computeTierIndex, TIERS_LIST } from '../tuning/tiers';
import { tickContactDamage } from './contact';
import { computeFrontier } from './frontier';
import { applyAmbientGrowth } from './growth';
import { applyNodeInfluence, updateNodeSpawn } from './nodes';

function updateTier(state: GameState): void {
  if (!state.grid) return;
  const newIdx = computeTierIndex(state.time);
  if (newIdx !== state.tierIndex) {
    state.tierIndex = newIdx;
    const tier = TIERS_LIST[newIdx];
    if (tier) {
      state.grid.safeRadius = tier.safeRadius;
      state.pendingAnnouncements.push(`OUTBREAK ESCALATING: ${tier.name}`);
    }
  }
}

function simulateTick(state: GameState, dt: number): void {
  if (!state.grid) return;
  updateTier(state);
  const tier = TIERS_LIST[state.tierIndex];
  if (!tier) return;
  updateNodeSpawn(state, dt);
  applyNodeInfluence(state, dt);
  applyAmbientGrowth(state.grid, state.tower, tier, dt, state.dirty);
  computeFrontier(state);
  tickContactDamage(state, dt);
  if (state.nodes.some((n) => n.dead)) state.nodes = state.nodes.filter((n) => !n.dead);
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
