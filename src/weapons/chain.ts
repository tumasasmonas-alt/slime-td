import type { GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { chainCooldown, chainCount, chainDamage } from '../tuning/weapons';
import { cooldownReady, emissionAngles, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const CHAIN_SPEED = 760;
const MULTISHOT_SPREAD = 0.3;

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Chain's four
// extensions, all per-projectile fields consumed inside
// systems/projectiles.ts's existing `chain` branch — see state.ts's
// ChainProjectile comment for what each field does.
const STATIC_BUILDUP_GROWTH: readonly [number, number, number] = [1.15, 1.25, 1.35];
const BACKLASH_MULT: readonly [number, number, number] = [2, 2.5, 3];
const CONDUCTIVE_BIAS: readonly [number, number, number] = [1.5, 2, 2.5];
const SPLIT_ARC_POWER: readonly [number, number, number] = [0.5, 0.65, 0.8];

// Chain's own hopsLeft/visited/legStart machinery is its identity
// (systems/projectiles.ts's `p.type === 'chain'` branch) — the generic
// projectile flags (Fork/Chaining/Bounce/Ricochet/Pierce's pass-through)
// aren't wired onto it here, since a Chain projectile already hops
// natively and those flags would either be redundant or silently
// ignored by its own branch. RESOLVE options (Splash/Overflow/Kickback/
// Priming/Pierce's resistance bypass) and Multishot/Formation still
// compose cleanly, so those are wired.
export const chainPipeline: WeaponPipeline = {
  ready: cooldownReady('chain', chainCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'chain');
    const plan = emissionPlan(state, 'chain');
    const opts = resolveOpts(state, 'chain');
    const dmg = (chainDamage(lvl) * mods.damage * powerMult) / plan.count;
    const t = state.tower;
    const baseAngle = Math.atan2(target.y - t.y, target.x - t.x);
    for (const a of emissionAngles(plan.count, baseAngle, plan.formation, MULTISHOT_SPREAD)) {
      fireChain(state, a, chainCount(lvl), dmg, mods, opts);
    }
  },
};

export function updateChainWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.chain;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, chainPipeline, 'chain');
}

function fireChain(
  state: GameState,
  angle: number,
  hops: number,
  dmg: number,
  mods: { area: number; velocity: number },
  opts: ReturnType<typeof resolveOpts>,
): void {
  const t = state.tower;
  const speed = CHAIN_SPEED * mods.velocity;

  const staticLvl = extensionLevel(state, 'chain', 'staticBuildup');
  const backlashLvl = extensionLevel(state, 'chain', 'backlash');
  const conductiveLvl = extensionLevel(state, 'chain', 'conductive');
  const splitArcLvl = extensionLevel(state, 'chain', 'splitArc');

  state.projectiles.push({
    type: 'chain',
    x: t.x,
    y: t.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dmg,
    radius: 5,
    color: '#e6c8ff',
    life: 1.4,
    hopsLeft: hops,
    visited: new Set(),
    legStart: { x: t.x, y: t.y },
    src: 'chain',
    impactAreaMult: mods.area,
    hopGrowth: staticLvl > 0 ? STATIC_BUILDUP_GROWTH[staticLvl - 1] : undefined,
    finalHopMult: backlashLvl > 0 ? BACKLASH_MULT[backlashLvl - 1] : undefined,
    densityBias: conductiveLvl > 0 ? CONDUCTIVE_BIAS[conductiveLvl - 1] : undefined,
    splitArcPower: splitArcLvl > 0 ? SPLIT_ARC_POWER[splitArcLvl - 1] : undefined,
    ...opts,
  });
}
