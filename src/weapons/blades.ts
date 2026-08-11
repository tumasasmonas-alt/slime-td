import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { findCoagulantHit } from '../systems/coagulants';
import { extensionLevel } from '../systems/extensions';
import { nearestFrontierPoint } from '../systems/frontier';
import { emissionPlan, hasHomingGem, resolveOpts } from '../systems/resolveOpts';
import { auraTargetingReading, type AuraTargetingReading } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { WEAPON_DEFS, bladeCount, bladeDamage, bladeRadius } from '../tuning/weapons';
import { runWeaponPipeline, type WeaponPipeline } from './pipeline';

const SPIN_SPEED = 2.4;
// 6D-0 (docs/plans/phase-6d0-balance-shape.md S4): raised 16→26 — Blades
// is the one aura genuinely below Bolt on throughput even after the reach
// fix in tuning/weapons.ts, because its hit disc was the tightest in the
// roster.
const HIT_RADIUS = 26;
const HIT_COOLDOWN = 0.22;
const VISUAL_RADIUS = 10;
// Phase 5B-6: moved off render/orbitals.ts's old hardcoded constants,
// values unchanged (docs/DECISIONS.md #17 — ninja-star, not a plain dot).
const BLADE_COLOR = '#cfe8ff';
const BLADE_GLOW_COLOR = '#6df0ff';

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7, S1): Blades'
// four extensions. Counter-Rotation's second ring orbits OUTWARD at
// 1.25x radius — every tower-centred radius floors at `perimeter`
// (CLAUDE.md's own sharp-edge list), so an inward second ring would sweep
// the safe zone and hit nothing, the exact failure prototype bug #5 named.
const COUNTER_ROTATION_RADIUS_MULT = 1.25;
const COUNTER_ROTATION_COUNT: readonly [number, number, number] = [1, 1, 2];
const SERRATION_RAMP: readonly [number, number, number] = [0.12, 0.18, 0.25];
const SERRATION_CAP = 2;
const BLADESTORM_MULT: readonly [number, number, number] = [1.6, 1.9, 2.2];
const BLADESTORM_WINDOW = 2.0;
const WHIRL_RADIUS_MULT: readonly [number, number, number] = [1.25, 1.35, 1.45];
const WHIRL_DURATION = 0.3;

// No targeting at all — blades circle the tower and damage whatever
// revealed tissue they sweep through, each on its own per-slot cooldown
// (state.bladeNextHit) so a blade can't hit the same patch every single
// frame. orbitRadius comes from bladeRadius(), which floors at the safe
// radius (docs/DECISIONS.md #16) so blades can never
// end up smaller than the zone they're meant to defend — see
// "documented prototype bugs" #5.
//
// Continuous rather than cooldown-gated — READY is always true when
// equipped; the per-slot hit cooldown that would elsewhere live in READY
// or ACQUIRE is intrinsic to DELIVER here, since it's per-blade, not
// per-weapon. Self-centered — no ACQUIRE stage.
// Phase 6B-2: one ring's worth of blade rendering + hit resolution,
// extracted so Counter-Rotation's second ring can call it a second time
// rather than duplicating the loop. `slotBase` gives the second ring a
// disjoint range of bladeNextHit/bladeStreak/bladeWhirlUntil keys — both
// rings share GameState's sparse per-slot maps, so without an offset a
// slot index from one ring would collide with the other's.
function runBladeRing(
  state: GameState,
  grid: NonNullable<GameState['grid']>,
  t: GameState['tower'],
  count: number,
  spin: number,
  radius: number,
  dmg: number,
  hitCooldown: number,
  opts: ReturnType<typeof resolveOpts>,
  serrationLvl: number,
  whirlLvl: number,
  slotBase: number,
  arcStart: number | null,
  arcSpan: number,
  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Threat
  // Priority/Triage/Breach Priority/Fixation's focus-bonus reading — the
  // only aura reading Blades gets. Vigilance is refused on `orbital`
  // (tuning/gems.ts): the orbit already floors outside the perimeter by
  // construction, so its `shape` field, even if somehow present, is
  // deliberately never read here — an annulus centred on a per-blade hit
  // point wouldn't mean "avoid the near field" the way it does on a
  // tower-centred disc anyway.
  auraReading: AuraTargetingReading,
): void {
  for (let i = 0; i < count; i++) {
    const a = arcStart !== null
      ? arcStart + (count <= 1 ? arcSpan / 2 : (i / (count - 1)) * arcSpan) + spin * 0.15
      : spin + (i / count) * Math.PI * 2;
    const bx = t.x + Math.cos(a) * radius;
    const by = t.y + Math.sin(a) * radius;
    state.orbitals.push({
      x: bx,
      y: by,
      radius: VISUAL_RADIUS,
      shape: 'shuriken',
      color: BLADE_COLOR,
      glowColor: BLADE_GLOW_COLOR,
    });

    const slot = slotBase + i;
    const { cx, cy } = worldToCell(grid, bx, by);
    const ci = gIdx(grid, cx, cy);
    const nextAllowed = state.bladeNextHit[slot] ?? 0;
    // Whirl: a blade that recently landed a hit flares its own reach —
    // read before this hit, so the flare from the PREVIOUS hit is what
    // widens this one, not itself.
    const flareActive = whirlLvl > 0 && (state.bladeWhirlUntil[slot] ?? 0) > state.time;
    const hitRadius = flareActive ? HIT_RADIUS * WHIRL_RADIUS_MULT[whirlLvl - 1]! : HIT_RADIUS;
    // Coagulants are entities, not grid cells — a blade sweeping
    // through already-cleared space still needs to connect with a
    // blob sitting there, which isRevealedIdx alone can't see.
    const onTarget = isRevealedIdx(grid, ci) || findCoagulantHit(state, bx, by, hitRadius) !== null;
    if (onTarget && state.time >= nextAllowed) {
      const streak = serrationLvl > 0 ? (state.bladeStreak[slot] ?? 0) : 0;
      const serrationMult = serrationLvl > 0 ? Math.min(SERRATION_CAP, 1 + streak * SERRATION_RAMP[serrationLvl - 1]!) : 1;
      clearAt(state, bx, by, dmg * serrationMult, {
        radiusPx: hitRadius,
        coagulantMult: WEAPON_DEFS.blades?.coagulantMult ?? 1,
        focusTarget: auraReading.focusTarget,
        focusBonus: auraReading.focusBonus,
        ...opts,
      });
      state.bladeNextHit[slot] = state.time + hitCooldown;
      if (serrationLvl > 0) state.bladeStreak[slot] = streak + 1;
      if (whirlLvl > 0) state.bladeWhirlUntil[slot] = state.time + WHIRL_DURATION;
    } else if (serrationLvl > 0 && state.time >= nextAllowed) {
      // Cooldown elapsed but nothing was here to hit — a miss, which
      // resets the streak rather than leaving it stale until the next
      // real connection.
      state.bladeStreak[slot] = 0;
    }
  }
}

export const bladesPipeline: WeaponPipeline = {
  ready: () => true,
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'blades');
    const opts = resolveOpts(state, 'blades');
    const plan = emissionPlan(state, 'blades');
    // Multishot's "+2 blades" reading — emissionPlan()'s count (1, or
    // 1+MULTISHOT_BONUS per Multishot/Formation gem socketed) minus its
    // own baseline of 1 gives how many *extra* blades to add on top of
    // bladeCount(lvl), rather than treating the whole ring as N separate
    // "shots."
    const extra = plan.count - 1;
    const count = bladeCount(lvl) + extra;
    const dmg = (bladeDamage(lvl) * mods.damage * powerMult) / (extra > 0 ? plan.count : 1);
    // Rate and Velocity read differently here than on every other
    // archetype (docs/plans/phase-6a1-gem-foundation.md's Overclock note):
    // orbital has no cooldown, so Overclock shrinks the per-blade re-hit
    // gate (attack frequency) instead, while Velocity — travel speed on
    // every other archetype — is genuinely the blade's own orbital speed.
    // Two gems both meaning "spin faster" would be a duplicate; keeping
    // them on separate axes is what avoids that.
    //
    // Bladestorm: orbit speed spikes for BLADESTORM_WINDOW seconds after
    // any coagulant dies (state.lastCoagulantDeathAt — attributing the
    // kill to THIS weapon specifically would need the clearAt return
    // channel the BACKLOG already defers).
    const bladestormLvl = extensionLevel(state, 'blades', 'bladestorm');
    const bladestormActive = bladestormLvl > 0 && state.time - state.lastCoagulantDeathAt < BLADESTORM_WINDOW;
    const spinVelocity = mods.velocity * (bladestormActive ? BLADESTORM_MULT[bladestormLvl - 1]! : 1);
    const spin = state.time * SPIN_SPEED * spinVelocity;
    const radius = bladeRadius(lvl, grid.perimeter) * mods.area;
    // Pierce: no per-blade hit cooldown — never stopped by what it cuts.
    // Reusing ignoreResistance as the signal (only Pierce ever sets it)
    // rather than adding a dedicated field just for this one archetype.
    const hitCooldown = opts.ignoreResistance ? 0 : HIT_COOLDOWN / mods.rate;

    // Homing: blades bias toward the threatened side of the arena.
    // Formation: instead of spreading evenly around the full circle,
    // blades lock into a narrow arc — centred on the threat if Homing is
    // also socketed, otherwise a fixed forward arc.
    let baseAngle = 0;
    if (hasHomingGem(state, 'blades') || plan.formation) {
      const threat = nearestFrontierPoint(state);
      if (threat) baseAngle = Math.atan2(threat.y - t.y, threat.x - t.x);
    }
    const arcSpan = plan.formation ? Math.PI * 0.6 : Math.PI * 2;
    const arcStart = plan.formation ? baseAngle - arcSpan / 2 : baseAngle;
    // Homing without Formation nudges the evenly-spread ring's phase
    // toward the threat rather than narrowing it into an arc — a lighter
    // touch than Formation's hard lock, matching the card's own
    // "biases toward" language rather than "locks to."
    const homingPhase = !plan.formation && hasHomingGem(state, 'blades') ? baseAngle : 0;

    const serrationLvl = extensionLevel(state, 'blades', 'serration');
    const whirlLvl = extensionLevel(state, 'blades', 'whirl');
    // Phase 6D-1: computed once against the ring's own tower-centred
    // radius, reused by both the main and Counter-Rotation rings — a
    // shared focus target across both, same reasoning as Frost's Multishot
    // copies.
    const auraReading = auraTargetingReading(state, 'blades', t.x, t.y, radius);

    state.orbitals = [];
    runBladeRing(
      state,
      grid,
      t,
      count,
      spin + homingPhase,
      radius,
      dmg,
      hitCooldown,
      opts,
      serrationLvl,
      whirlLvl,
      0,
      plan.formation ? arcStart : null,
      arcSpan,
      auraReading,
    );

    // Counter-Rotation: a second ring, spinning the OTHER way, orbiting
    // OUTWARD at COUNTER_ROTATION_RADIUS_MULT — every tower-centred radius
    // floors at `perimeter`, so an inward second ring would sweep the
    // safe zone and hit nothing (docs/plans/phase-6b2-extension-content.md
    // S1). Disjoint slot range (1000+) so its hit-cooldown/streak/whirl
    // state never collides with the main ring's.
    const counterLvl = extensionLevel(state, 'blades', 'counterRotation');
    if (counterLvl > 0) {
      const counterCount = COUNTER_ROTATION_COUNT[counterLvl - 1]!;
      runBladeRing(
        state,
        grid,
        t,
        counterCount,
        -spin + homingPhase,
        radius * COUNTER_ROTATION_RADIUS_MULT,
        dmg,
        hitCooldown,
        opts,
        serrationLvl,
        whirlLvl,
        1000,
        plan.formation ? arcStart : null,
        arcSpan,
        auraReading,
      );
    }
  },
  // Phase 6A-2: declared on the pipeline itself so
  // weapons/registry.ts's generic updateAllWeapons() loop preserves this
  // without needing to know Blades is special.
  cleanup: (state) => {
    state.orbitals = [];
  },
};

// Takes `_dt` only to match the (state, dt) signature every other
// weapon update function uses — blades have no cooldown timer of their
// own, driven purely by state.time and the per-slot hit cooldown.
export function updateBladesWeapon(state: GameState, _dt: number): void {
  const lvl = state.weapons.blades;
  if (!lvl || !state.grid) {
    bladesPipeline.cleanup?.(state);
    return;
  }
  runWeaponPipeline(state, _dt, lvl, bladesPipeline, 'blades');
}
