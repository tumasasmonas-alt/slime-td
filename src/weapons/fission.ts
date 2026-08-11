import type { GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, projectileFlags, resolveOpts } from '../systems/resolveOpts';
import { targetingAcquire } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { fissionBlastRadius, fissionCooldown, fissionCount, fissionDamage, fissionScatter } from '../tuning/weapons';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const FISSION_SPEED = 220;
// 2026-08-10: the owner's call — blue, distinct from Shockwave's lighter
// cyan (#7fd8ff) so the two don't read as the same weapon on screen.
const FISSION_COLOR = '#4d94ff';
// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S5): Sticky's
// burning patch — small and short, so it reads as a lingering ember, not
// a second Caustic Cloud.
const STICKY_DPS: readonly [number, number, number] = [6, 9, 12];
const STICKY_LIFE = 2.0;
const STICKY_RADIUS = 26;

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S4): Fission
// Charge is the Cluster Warhead pattern (systems/projectiles.ts's
// spawnClusterSubmunitions) promoted from an extension to a whole
// weapon's identity — its projectile rides the exact same type: 'missile'
// | 'fission' update branch, homing/detonating/clustering identically.
//
// `clusterCount` is fissionCount(lvl) - 1: the PARENT projectile's own
// detonation on arrival counts as the first submunition, and the
// remaining N-1 scatter around it at `childPowerShare: 1` (full power,
// not Missile's own 0.25 share) — so a level with fissionCount 5 lands
// exactly 5 roughly-equal hits, not one big hit plus four small ones.
export const fissionPipeline: WeaponPipeline = {
  ready: cooldownReady('fission', fissionCooldown),
  acquire: targetingAcquire('fission', (s) => s.grid?.maxRange ?? 0, frontierAcquire),
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'fission');
    const plan = emissionPlan(state, 'fission');
    // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S2): Fork/Chaining/
    // Bounce/Ricochet merged in like Bolt's — Fission Charge rides the
    // exact same 'missile' | 'fission' branch in systems/projectiles.ts,
    // and that branch's own `continue` used to skip the generic flag
    // resolution entirely, same defect as Missile's.
    const opts = { ...projectileFlags(state, 'fission'), ...resolveOpts(state, 'fission') };
    const dmg = (fissionDamage(lvl) * mods.damage * powerMult) / plan.count;
    const splashRadius = fissionBlastRadius(lvl) * mods.area;
    const count = fissionCount(lvl);
    const scatterDist = fissionScatter(lvl) * mods.area;

    const chainFissionLvl = extensionLevel(state, 'fission', 'chainFission');
    const stickyLvl = extensionLevel(state, 'fission', 'sticky');
    const stickyBurn = stickyLvl > 0 ? { dmgPerSec: STICKY_DPS[stickyLvl - 1]!, life: STICKY_LIFE, radius: STICKY_RADIUS } : undefined;

    for (let i = 0; i < plan.count; i++) {
      const t = state.tower;
      state.projectiles.push({
        type: 'fission',
        x: t.x,
        y: t.y,
        vx: 0,
        vy: 0,
        speed: FISSION_SPEED * mods.velocity,
        dmg,
        splashRadius,
        radius: 6,
        color: FISSION_COLOR,
        life: 5,
        targetPoint: { x: target.x, y: target.y },
        src: 'fission',
        clusterCount: Math.max(0, count - 1),
        scatterDist,
        childPowerShare: 1,
        fissionGen: 0,
        chainFissionLvl: chainFissionLvl > 0 ? (chainFissionLvl as 1 | 2 | 3) : undefined,
        stickyBurn,
        armAt: 0,
        ...opts,
      });
    }
  },
};

export function updateFissionWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.fission;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, fissionPipeline, 'fission');
}
