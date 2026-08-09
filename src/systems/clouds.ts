import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { WEAPON_DEFS } from '../tuning/weapons';
import { nearestFrontierPoint } from './frontier';

const CLOUD_TICK = 0.4;
// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): Homing's cloud
// reading — drifts toward the nearest threat each tick instead of
// sitting where it was dropped.
const CLOUD_DRIFT_SPEED = 24;

export function updateClouds(state: GameState, dt: number): void {
  const coagulantMult = WEAPON_DEFS.poison?.coagulantMult ?? 1; // clouds only ever come from Caustic Cloud
  const remaining: typeof state.clouds = [];
  for (const c of state.clouds) {
    c.life -= dt;

    if (c.homing) {
      const threat = nearestFrontierPoint(state);
      if (threat) {
        const a = Math.atan2(threat.y - c.y, threat.x - c.x);
        c.x += Math.cos(a) * CLOUD_DRIFT_SPEED * dt;
        c.y += Math.sin(a) * CLOUD_DRIFT_SPEED * dt;
      }
    }

    c.tickTimer -= dt;
    if (c.tickTimer <= 0) {
      c.tickTimer = CLOUD_TICK;
      clearAt(state, c.x, c.y, c.dmgPerSec * CLOUD_TICK, {
        radiusPx: c.radius,
        coagulantMult,
        ignoreResistance: c.ignoreResistance,
        flattenFalloff: c.flattenFalloff,
        overflow: c.overflow,
        kickback: c.kickback,
        priming: c.priming,
      });
    }
    if (c.life > 0) remaining.push(c);
  }
  state.clouds = remaining;
}
