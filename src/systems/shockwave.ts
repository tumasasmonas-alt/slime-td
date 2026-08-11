import type { GameState } from '../state';
import { clearAt } from '../grid/clear';

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S2.1-S2.3): the
// travelling ring's own update, called from systems/tick.ts's
// simulateTick — a fixed-timestep pass, per CLAUDE.md's rule that growth/
// coagulant/frontier/contact-damage simulation never runs off render
// framerate. render/shockwave.ts draws a continuously-computed radius
// instead of reading `radius` directly, so the visual stays smooth even
// though damage only advances once per SIM_TICK (S2.2).
export function updateShockwaveRings(state: GameState, dt: number): void {
  const remaining: typeof state.shockwaveRings = [];
  for (const ring of state.shockwaveRings) {
    // Second Wave (6C-1 S5): a ring can be scheduled to start later than
    // the tick that created it — it simply sits at its own start radius,
    // undamaging, until state.time reaches bornAt.
    if (state.time < ring.bornAt) {
      remaining.push(ring);
      continue;
    }

    const prevRadius = ring.radius;
    const newRadius = ring.inward
      ? Math.max(ring.startRadius, prevRadius - ring.speed * dt)
      : Math.min(ring.maxRadius, prevRadius + ring.speed * dt);
    ring.radius = newRadius;

    // The band swept THIS tick — [damagedTo, radius] outward, or
    // [radius, damagedTo] inward. Damaging only this band, never a disc at
    // the current radius, is what makes a cell hit exactly once across the
    // ring's whole life (S2.1's core invariant) rather than re-hit every
    // tick as the ring keeps growing past it.
    //
    // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Vigilance's
    // reading — clamps the band's inner edge to at least vigilanceFloor,
    // never letting the ring damage anything closer to the tower than
    // that. Usually a no-op against the outward case (the ring's own
    // startRadius already floors at the perimeter), real once Implosion
    // sends bandInner traveling back down toward it.
    const bandInner = Math.max(ring.inward ? newRadius : ring.damagedTo, ring.vigilanceFloor ?? 0);
    const bandOuter = ring.inward ? ring.damagedTo : newRadius;
    if (bandOuter > bandInner) {
      clearAt(state, ring.x, ring.y, ring.power, {
        shape: { kind: 'annulus', inner: bandInner, outer: bandOuter },
        ignoreResistance: ring.ignoreResistance,
        flattenFalloff: ring.flattenFalloff,
        overflow: ring.overflow,
        kickback: ring.kickback,
        priming: ring.priming,
        chill: ring.chill,
        shatter: ring.shatter,
        armorShred: ring.armorShred,
        armorScaled: ring.armorScaled,
        densityScaled: ring.densityScaled,
        focusTarget: ring.focusTarget,
        focusBonus: ring.focusBonus,
        // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3,
        // Decision 91): the nine Conditional gems — same forwarding gap
        // as projectiles.ts/clouds.ts had, fixed the same way.
        armorIgnoreCap: ring.armorIgnoreCap,
        maturityScaled: ring.maturityScaled,
        saturationScaled: ring.saturationScaled,
        massScaledUp: ring.massScaledUp,
        massScaledDown: ring.massScaledDown,
        cullingFinishFraction: ring.cullingFinishFraction,
        desperationScaled: ring.desperationScaled,
        proximityScaled: ring.proximityScaled,
        momentumMult: ring.momentumMult,
        momentumKey: ring.momentumKey,
      });
    }
    ring.damagedTo = newRadius;

    const done = ring.inward ? newRadius <= ring.startRadius : newRadius >= ring.maxRadius;
    if (!done) remaining.push(ring);
  }
  state.shockwaveRings = remaining;
}
