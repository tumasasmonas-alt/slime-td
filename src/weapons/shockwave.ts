import type { GameState, ShockwaveRing } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, resolveOpts } from '../systems/resolveOpts';
import { auraTargetingReading } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { shockwaveCooldown, shockwaveDamage, shockwaveReach, shockwaveStartRadius, SHOCKWAVE_SPEED } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const SHOCKWAVE_COLOR = '#7fd8ff';
// Multishot/Formation (6C-1 S2.5): extra rings read as concentric waves
// rather than needing a time-delay mechanism — each ring's own start
// radius is offset outward from the last, so several fire at once without
// visually stacking into one thicker ring.
const MULTISHOT_RADIUS_OFFSET = 14;

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S5): Shockwave's
// four extensions. Second Wave and Implosion change WHICH ring(s) get
// pushed; Knockback and Resonant Ring are RESOLVE-shaped fields baked
// straight onto the ring, read every damage pass by systems/shockwave.ts.
const SECOND_WAVE_DELAY: readonly [number, number, number] = [0.35, 0.3, 0.25];
const SECOND_WAVE_POWER: readonly [number, number, number] = [0.55, 0.7, 0.85];
const KNOCKBACK_PX: readonly [number, number, number] = [20, 32, 46];
const RESONANT_RING_BONUS: readonly [number, number, number] = [0.4, 0.65, 0.9];
const IMPLOSION_POWER: readonly [number, number, number] = [1.1, 1.25, 1.4];

// Untargeted — expands outward from the tower on a cooldown. No ACQUIRE
// stage; the ring's damage is applied per-sim-tick in
// systems/shockwave.ts, not here — deliver only creates the entity.
// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S2).
export const shockwavePipeline: WeaponPipeline = {
  ready: cooldownReady('shockwave', shockwaveCooldown),
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'shockwave');
    const opts = resolveOpts(state, 'shockwave');
    const plan = emissionPlan(state, 'shockwave');
    const maxRadius = shockwaveReach(lvl, grid.perimeter) * mods.area;
    const startRadius = shockwaveStartRadius(grid.perimeter);
    const dmg = (shockwaveDamage(lvl) * mods.damage * powerMult) / plan.count;

    const knockbackLvl = extensionLevel(state, 'shockwave', 'knockback');
    const resonantLvl = extensionLevel(state, 'shockwave', 'resonantRing');
    const implosionLvl = extensionLevel(state, 'shockwave', 'implosion');
    const secondWaveLvl = extensionLevel(state, 'shockwave', 'secondWave');

    // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Shockwave has
    // no ACQUIRE stage either. Committed once here, at ring creation, and
    // carried on the entity — the ring's own band geometry is recomputed
    // every tick in systems/shockwave.ts, which has no other place to read
    // a per-shot setting from. Vigilance reads as a floor on the band's
    // inner edge (usually redundant with the ring's own perimeter-floored
    // start, real once Implosion sends it travelling back inward); the
    // other four read as the same focus-bonus every other aura uses.
    const auraReading = auraTargetingReading(state, 'shockwave', t.x, t.y, maxRadius);

    const ringOpts = {
      ...opts,
      kickback: knockbackLvl > 0 ? KNOCKBACK_PX[knockbackLvl - 1] : opts.kickback,
      densityScaled: resonantLvl > 0 ? RESONANT_RING_BONUS[resonantLvl - 1] : undefined,
      vigilanceFloor: auraReading.shape ? grid.perimeter : undefined,
      focusTarget: auraReading.focusTarget,
      focusBonus: auraReading.focusBonus,
    };

    for (let i = 0; i < plan.count; i++) {
      // Implosion replaces the ring's whole travel direction rather than
      // adding a second one — a ring can't sensibly expand and collapse
      // at once, so this is a mode switch, not an additive effect.
      const ring: ShockwaveRing =
        implosionLvl > 0
          ? {
              x: t.x,
              y: t.y,
              bornAt: state.time,
              damagedTo: maxRadius,
              radius: maxRadius,
              startRadius: startRadius + i * MULTISHOT_RADIUS_OFFSET,
              maxRadius,
              speed: SHOCKWAVE_SPEED,
              power: dmg * IMPLOSION_POWER[implosionLvl - 1]!,
              color: SHOCKWAVE_COLOR,
              inward: true,
              ...ringOpts,
            }
          : {
              x: t.x,
              y: t.y,
              bornAt: state.time,
              damagedTo: startRadius + i * MULTISHOT_RADIUS_OFFSET,
              radius: startRadius + i * MULTISHOT_RADIUS_OFFSET,
              startRadius: startRadius + i * MULTISHOT_RADIUS_OFFSET,
              maxRadius,
              speed: SHOCKWAVE_SPEED,
              power: dmg,
              color: SHOCKWAVE_COLOR,
              ...ringOpts,
            };
      state.shockwaveRings.push(ring);

      // Second Wave: a genuine follow-up ring, not a stronger first one —
      // scheduled via `bornAt` in the future, which systems/shockwave.ts's
      // update already gates on (built for exactly this from S2.1).
      if (secondWaveLvl > 0) {
        state.shockwaveRings.push({
          ...ring,
          bornAt: state.time + SECOND_WAVE_DELAY[secondWaveLvl - 1]!,
          power: dmg * SECOND_WAVE_POWER[secondWaveLvl - 1]!,
        });
      }
    }
  },
};

export function updateShockwaveWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.shockwave;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, shockwavePipeline, 'shockwave');
}
