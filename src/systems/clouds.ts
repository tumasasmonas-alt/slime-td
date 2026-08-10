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

    // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Lingering
    // Spores — drifts at a fixed speed, independent of Homing's
    // toward-the-threat drift above. 2026-08-10 bug fix: `driftAngle` is
    // chosen once at spawn (weapons/poison.ts), not recomputed from the
    // cloud's own position each tick — the old atan2(c.y - originY,
    // c.x - originX) was always atan2(0, 0) = 0 at spawn, so every cloud
    // drifted due east regardless of the extension's own "outward" claim.
    if (c.driftOutward && c.driftAngle !== undefined) {
      c.x += Math.cos(c.driftAngle) * c.driftOutward * dt;
      c.y += Math.sin(c.driftAngle) * c.driftOutward * dt;
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
        armorShred: c.armorShred,
      });
    }
    if (c.life > 0) remaining.push(c);
  }
  state.clouds = remaining;
}
