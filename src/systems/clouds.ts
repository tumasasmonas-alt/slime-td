import type { CausticCloud, GameState } from '../state';
import { clearAt } from '../grid/clear';
import { WEAPON_DEFS } from '../tuning/weapons';
import { rand } from '../util/math';
import { nearestFrontierPoint } from './frontier';
import { bestCoagulant } from './targeting';

const CLOUD_TICK = 0.4;
// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): Homing's cloud
// reading — drifts toward the nearest threat each tick instead of
// sitting where it was dropped.
const CLOUD_DRIFT_SPEED = 24;

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Fork/Bounce/
// Ricochet's own values.
const FORK_CHILD_COUNT = 2;
const FORK_RADIUS_MULT = 0.55;
const FORK_LIFE_MULT = 0.6;
const FORK_DMG_MULT = 0.6;
const BOUNCE_SEARCH_RADIUS = 200;
const RICOCHET_DRIFT_SPEED = 16; // its own drift, independent of Lingering Spores
const RICOCHET_FLIP_FRACTION = 0.5; // reverses once past this fraction of the cloud's own life

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

    // Phase 6D-3: Ricochet — its own drift, independent of Lingering
    // Spores (a cloud with Ricochet but no driftOutward set would
    // otherwise never move, making the gem silently dead without another
    // extension also socketed). Flips direction once, partway through
    // the cloud's own life.
    if (c.ricochetDrift && c.driftAngle !== undefined) {
      if (!c.ricochetFlipped && c.life <= c.maxLife * RICOCHET_FLIP_FRACTION) {
        c.driftAngle += Math.PI;
        c.ricochetFlipped = true;
      }
      c.x += Math.cos(c.driftAngle) * RICOCHET_DRIFT_SPEED * dt;
      c.y += Math.sin(c.driftAngle) * RICOCHET_DRIFT_SPEED * dt;
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
        // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3,
        // Decision 91): the nine Conditional gems — same forwarding gap
        // projectiles.ts had, fixed the same way, for Poison (the only
        // cloud weapon).
        armorIgnoreCap: c.armorIgnoreCap,
        maturityScaled: c.maturityScaled,
        saturationScaled: c.saturationScaled,
        massScaledUp: c.massScaledUp,
        massScaledDown: c.massScaledDown,
        cullingFinishFraction: c.cullingFinishFraction,
        desperationScaled: c.desperationScaled,
        proximityScaled: c.proximityScaled,
        momentumMult: c.momentumMult,
        momentumKey: c.momentumKey,
      });
    }
    if (c.life > 0) {
      remaining.push(c);
      continue;
    }

    // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Fork/Bounce —
    // both trigger here, at the moment of natural expiry, since a cloud
    // has no single "impact" the way a projectile or beam does. Checked
    // in this order (Fork first) so a cloud can't carry both flags at
    // once and do both — resolveOpts.ts's shared "at most one Behaviour
    // outcome per hit" ordering (6A-2), applied to expiry instead of
    // impact.
    if (c.forkOnExpiry) {
      remaining.push(...spawnCloudForks(c));
    } else if (c.bounceOnExpiry && (c.bouncesLeft ?? 0) > 0) {
      const next = bestCoagulant(state, c.x, c.y, BOUNCE_SEARCH_RADIUS, (a, b) => {
        const da = Math.hypot(a.x - c.x, a.y - c.y);
        const db = Math.hypot(b.x - c.x, b.y - c.y);
        return da < db;
      });
      if (next) {
        c.x = next.x;
        c.y = next.y;
        c.life = c.maxLife;
        c.bouncesLeft = (c.bouncesLeft ?? 1) - 1;
        remaining.push(c);
      }
    }
  }
  state.clouds = remaining;
}

// Fork: splits an expiring cloud into FORK_CHILD_COUNT smaller, weaker,
// shorter-lived clouds scattered around its own last position — never
// re-forking (no `forkOnExpiry` on the children), so this terminates by
// construction rather than by a visited set.
function spawnCloudForks(c: CausticCloud): CausticCloud[] {
  const children: CausticCloud[] = [];
  for (let k = 0; k < FORK_CHILD_COUNT; k++) {
    const angle = (k / FORK_CHILD_COUNT) * Math.PI * 2 + rand(0, 0.5);
    const dist = c.radius * 0.4;
    const life = c.maxLife * FORK_LIFE_MULT;
    children.push({
      ...c,
      x: c.x + Math.cos(angle) * dist,
      y: c.y + Math.sin(angle) * dist,
      radius: c.radius * FORK_RADIUS_MULT,
      dmgPerSec: c.dmgPerSec * FORK_DMG_MULT,
      life,
      maxLife: life,
      tickTimer: 0,
      bubbleSeeds: c.bubbleSeeds,
      forkOnExpiry: false,
      bounceOnExpiry: false,
    });
  }
  return children;
}
