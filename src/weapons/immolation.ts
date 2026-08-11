import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { IMMOLATION_RING_COLOR } from '../render/immolationRing';
import { scheduleEmission } from '../systems/emissions';
import { extensionLevel } from '../systems/extensions';
import { hasBounceGem, hasChainingGem, hasForkGem, hasRicochetGem, resolveOpts } from '../systems/resolveOpts';
import { auraTargetingReading } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { IMMOLATION_TICK, WEAPON_DEFS, immolationDamage, immolationRadius } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

// Phase 6A-1: a brief brighter flash on top of the persistent ring
// (render/immolationRing.ts) each time it actually ticks — matching
// Frost Nova's novaFx pattern, the confirmation-on-fire half of the
// weapon's now-complete visual.
const FLASH_LIFE = 0.35;

// Phase 5A (Decision 70): promoted from systems/ward.ts's Ward Pulse,
// which was a weapon misfiled as a passive since the port — a cooldown
// and a tower-centered radius, exactly Frost Nova's and Blades' shape,
// gated behind state.passives.ward instead of state.weapons like every
// other thing with those properties. That misclassification is also why
// it never got a visual (Decision 11's "a weapon's signature visual is
// part of the weapon" never applied to something classed as a passive)
// and why its clearAt call never passed coagulantMult. Phase 6B-1 closed
// the last balance gap (immolationDamage now carries WEAPON_DAMAGE_SCALE
// — tuning/weapons.ts).

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S5): Immolation's
// four extensions. Second Ring is a second concentric ring OUTWARD at
// 1.4x radius (S1 — every tower-centred radius floors at `perimeter`, so
// an inward second ring would sweep the safe zone and hit nothing) rather
// than being folded into the main clearAt call, so its own power fraction
// stays independently tunable. Radar Sweep is a periodic wedge-shaped
// bonus hit (redesigned post-6D-3 playtest from 'Flare', a full-circle
// pulse — see its own comment below), using Overcharge's own
// state.weaponShots counter (this weapon's own tick count, not a second
// one). Backdraft samples how much mass is currently crossing the ring
// before the main hit. Ash suppresses regrowth on whatever the ring just
// burned.
const SECOND_RING_MULT = 1.4;
const SECOND_RING_POWER: readonly [number, number, number] = [0.6, 0.75, 0.9];
// Radar Sweep (post-6D-3 playtest, 2026-08-11, owner's own suggestion) —
// renamed and redesigned from 'Flare', a periodic near-full-circle pulse
// found "way too op, clears almost entire screen" at 1.8x radius and up
// to 100% power. A full-circle hit can't help but nuke everything in
// range at once no matter how much its magnitude is cut — the fix isn't
// a smaller number, it's not hitting the full circle. Every RADAR_EVERY
// ticks, this fires a WEDGE instead of a ring: `grid/clear.ts`'s new
// `ClearOptions.sector` masks the hit to a RADAR_WEDGE_RAD-wide arc, and
// the wedge's centre angle advances by RADAR_WEDGE_RAD each firing —
// tiling the circle with no gaps or overlap, so it reads as one steady
// rotation sweeping around rather than several independent flashes.
// Derived from `ticks` alone (no new per-weapon state needed): at the
// moment this fires, `ticks` is always an exact multiple of RADAR_EVERY,
// so `ticks / RADAR_EVERY` is the 0-indexed sweep step.
const RADAR_EVERY = 5;
const RADAR_RADIUS_MULT = 1.3;
const RADAR_POWER: readonly [number, number, number] = [0.45, 0.55, 0.65];
const RADAR_WEDGE_RAD = (70 * Math.PI) / 180; // 70° wide, matches its own step (tiles cleanly)
const BACKDRAFT_SCALE: readonly [number, number, number] = [0.3, 0.45, 0.6];
const ASH_MULT: readonly [number, number, number] = [0.6, 0.45, 0.3];
const ASH_SECONDS = 2.0;

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Immolation's ring
// reading for Fork/Chaining/Bounce/Ricochet. Fork reuses Second Ring's
// exact machinery (the plan's own note: "Fork IS Second Ring") — a
// second concentric pulse, just at the gem's own multiplier instead of
// the extension's. Chaining and Ricochet both reuse the deferred-
// emission queue Echo/Barrage already established (systems/emissions.ts),
// guarded by `powerMult === 1` the same way Lance's own linger guards
// against re-scheduling itself — a re-invoked `deliver` always carries a
// powerMult != 1, so it can never schedule a second round of itself.
const FORK_RING_MULT = 1.5;
const FORK_RING_POWER = 0.7;
const CHAINING_DELAY = 0.6;
const CHAINING_RADIUS_MULT = 2.0;
const CHAINING_POWER_MULT = 0.6;
const RICOCHET_DELAY = 0.35;
const RICOCHET_POWER_MULT = 0.5;
// Bounce: alternates the ring's own radius between the normal size and
// this multiplier, every tick — read off the same running tick counter
// Radar Sweep already keeps (state.weaponShots.immolation), now
// incremented unconditionally rather than only when Radar Sweep is
// socketed, so the two gems/extensions read the same monotonic count
// without colliding (different moduli of the same number, not two
// different counters).
const BOUNCE_OUTER_MULT = 1.6;

// Self-centered — no ACQUIRE stage, the target is always the tower.
// Phase 6A-1: now built on the shared cooldownReady() helper like every
// other cooldown weapon — see tuning/weapons.ts's IMMOLATION_TICK comment
// for why this closes 2 of the weapon's 3 open balance gaps.
//
// Phase 6A-2: RESOLVE options (Splash/Overflow/Kickback/Priming/Pierce)
// are wired — they only affect the damage math, not where or how large
// the ring is. Homing and Multishot/Formation are deliberately NOT wired
// here: both would move or multiply the ring's centre, which would
// desync render/immolationRing.ts's persistent visual (drawn once, at
// the tower, from state.weapons/state.grid directly) from where the
// damage actually lands — a correctness risk against a visual this
// session specifically shipped to fix a standing BACKLOG item. Left as a
// real, disclosed gap rather than risking that regression; revisit once
// the ring's render reads a shared origin instead of assuming the tower.
// Backdraft: a cheap proxy for "how much mass is currently crossing the
// ring" — average grid density sampled at points around the ring's own
// circumference, rather than a real flux measurement (which would need
// tracking cells crossing between ticks). Good enough to reward firing
// into a busy ring without adding a new per-cell tracked quantity.
const BACKDRAFT_SAMPLES = 8;
function sampleRingDensity(grid: NonNullable<GameState['grid']>, cx: number, cy: number, radius: number): number {
  let total = 0;
  for (let k = 0; k < BACKDRAFT_SAMPLES; k++) {
    const a = (k / BACKDRAFT_SAMPLES) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    const gx = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cellSize)));
    const gy = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellSize)));
    total += grid.growth[gy * grid.cols + gx] ?? 0;
  }
  return total / BACKDRAFT_SAMPLES;
}

export const immolationPipeline: WeaponPipeline = {
  ready: cooldownReady('immolation', () => IMMOLATION_TICK),
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'immolation');
    const opts = resolveOpts(state, 'immolation');

    // Phase 6D-3: the running tick count, now incremented unconditionally
    // (it used to increment only when Radar Sweep — then 'Flare' — was
    // socketed) so Bounce below can read the same monotonic count Radar
    // Sweep does — different moduli of one number, not two counters that
    // could collide.
    const ticks = (state.weaponShots.immolation ?? 0) + 1;
    state.weaponShots.immolation = ticks;

    // Bounce: alternates the ring's OWN radius between the normal size
    // and BOUNCE_OUTER_MULT every tick.
    const bounceActive = hasBounceGem(state, 'immolation') && ticks % 2 === 0;
    const baseRadius = immolationRadius(lvl, grid.perimeter) * mods.area;
    // Chaining: the deferred re-fire (scheduled below) carries this ring
    // out to CHAINING_RADIUS_MULT instead of its normal size — detected
    // by `powerMult !== 1`, which is only ever true for a re-invoked
    // deliver (Echo/Barrage/this weapon's own scheduled replay).
    const chainingReplay = hasChainingGem(state, 'immolation') && powerMult !== 1;
    const radius = chainingReplay ? baseRadius * CHAINING_RADIUS_MULT : bounceActive ? baseRadius * BOUNCE_OUTER_MULT : baseRadius;

    const backdraftLvl = extensionLevel(state, 'immolation', 'backdraft');
    const backdraftMult = backdraftLvl > 0 ? 1 + BACKDRAFT_SCALE[backdraftLvl - 1]! * sampleRingDensity(grid, t.x, t.y, radius) : 1;
    const ashLvl = extensionLevel(state, 'immolation', 'ash');

    // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): same reading
    // as Frost's — Immolation has no ACQUIRE stage either. Scoped to the
    // primary ring only, not Second Ring/Radar Sweep below (both are
    // extension-layered bonus hits, not the weapon's own base identity).
    const auraReading = auraTargetingReading(state, 'immolation', t.x, t.y, radius);

    clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * backdraftMult, {
      radiusPx: radius,
      coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
      suppressRegrowth: ashLvl > 0 ? { mult: ASH_MULT[ashLvl - 1]!, seconds: ASH_SECONDS } : undefined,
      shape: auraReading.shape,
      focusTarget: auraReading.focusTarget,
      focusBonus: auraReading.focusBonus,
      ...opts,
    });
    state.novaFx.push({ x: t.x, y: t.y, radius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });

    // Second Ring: a second concentric ring OUTWARD at SECOND_RING_MULT —
    // see S1's outward-only rule; an inward ring sits inside the safe
    // zone and hits nothing.
    const secondRingLvl = extensionLevel(state, 'immolation', 'secondRing');
    if (secondRingLvl > 0) {
      const outerRadius = radius * SECOND_RING_MULT;
      clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * SECOND_RING_POWER[secondRingLvl - 1]!, {
        radiusPx: outerRadius,
        coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
        suppressRegrowth: ashLvl > 0 ? { mult: ASH_MULT[ashLvl - 1]!, seconds: ASH_SECONDS } : undefined,
        ...opts,
      });
      state.novaFx.push({ x: t.x, y: t.y, radius: outerRadius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });
    }

    // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Fork — the
    // plan's own note, "Fork IS Second Ring's machinery," just at the
    // gem's own multiplier rather than the extension's, and additive with
    // Second Ring if both happen to be present (no reason for one to
    // exclude the other).
    if (hasForkGem(state, 'immolation')) {
      const forkRadius = radius * FORK_RING_MULT;
      clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * FORK_RING_POWER, {
        radiusPx: forkRadius,
        coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
        suppressRegrowth: ashLvl > 0 ? { mult: ASH_MULT[ashLvl - 1]!, seconds: ASH_SECONDS } : undefined,
        ...opts,
      });
      state.novaFx.push({ x: t.x, y: t.y, radius: forkRadius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });
    }

    // Chaining/Ricochet: both reuse the deferred-emission queue Echo/
    // Barrage already established, guarded by `powerMult === 1` the same
    // way Lance's own linger guards against re-scheduling itself — only
    // an ORIGINAL fire schedules a follow-up; the follow-up itself never
    // does, so this terminates by construction rather than by a visited
    // set. Ricochet's reading ("a second tick at reduced power shortly
    // after") is textually close to Echo's own — a known soft overlap,
    // accepted rather than invented away, the same call the project
    // already made for Momentum vs Blades' Serration (6D-2).
    if (powerMult === 1) {
      if (hasChainingGem(state, 'immolation')) {
        scheduleEmission(state, 'immolation', CHAINING_DELAY, lvl, null, CHAINING_POWER_MULT);
      }
      if (hasRicochetGem(state, 'immolation')) {
        scheduleEmission(state, 'immolation', RICOCHET_DELAY, lvl, null, RICOCHET_POWER_MULT);
      }
    }

    // Radar Sweep: every RADAR_EVERY ticks, a wedge — not a ring — fires
    // at RADAR_RADIUS_MULT, its angle stepping RADAR_WEDGE_RAD further
    // around each time. `ticks` is this weapon's own emission counter,
    // the same one Overcharge (Bolt) reads for its own every-5th-shot
    // bonus, keyed by weapon so the two never collide; at a firing tick
    // it's always an exact multiple of RADAR_EVERY, so dividing gives the
    // sweep step — minus 1 since `ticks` itself starts at 1, not 0, so the
    // very first firing (ticks === RADAR_EVERY) is step 0, angle 0, rather
    // than already one step around.
    const radarLvl = extensionLevel(state, 'immolation', 'radarSweep');
    if (radarLvl > 0) {
      if (ticks % RADAR_EVERY === 0) {
        const radarRadius = radius * RADAR_RADIUS_MULT;
        const sweepStep = ticks / RADAR_EVERY - 1;
        const angle = sweepStep * RADAR_WEDGE_RAD;
        const halfWidth = RADAR_WEDGE_RAD / 2;
        clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * RADAR_POWER[radarLvl - 1]!, {
          radiusPx: radarRadius,
          coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
          sector: { angle, halfWidth },
          ...opts,
        });
        state.novaFx.push({ x: t.x, y: t.y, radius: radarRadius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR, angle, halfWidth });
      }
    }
  },
};

export function updateImmolationWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.immolation;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, immolationPipeline, 'immolation');
}
