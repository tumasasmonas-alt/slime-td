import type { GameState } from '../state';
import { emissionPlan, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { chainCooldown, chainCount, chainDamage } from '../tuning/weapons';
import { cooldownReady, emissionAngles, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const CHAIN_SPEED = 760;
const MULTISHOT_SPREAD = 0.3;

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
    ...opts,
  });
}
