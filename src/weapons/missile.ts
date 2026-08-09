import type { GameState } from '../state';
import { emissionPlan, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { missileCooldown, missileDamage, missileRadius } from '../tuning/weapons';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const MISSILE_SPEED = 300;

// Homes toward a fixed target point rather than a live entity — the
// homing behaviour has nothing to chase until Phase 3C's coagulants land
// (Decision 43/BACKLOG Phase 3A). Reverting to the frontier point once a
// coagulant target exists is a small follow-up, not a rewrite: the
// projectile's steering already tracks whatever targetPoint holds.
//
// Phase 6A-2: the Homing gem is a no-op here on purpose — every missile
// already homes onto a fixed point unconditionally, so the gem would
// have nothing to add. Multishot/Formation fire a salvo instead
// (converging on the same target point rather than spreading, which
// reads as "more missiles," not "worse aim").
export const missilePipeline: WeaponPipeline = {
  ready: cooldownReady('missile', missileCooldown),
  acquire: frontierAcquire,
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'missile');
    const plan = emissionPlan(state, 'missile');
    const opts = resolveOpts(state, 'missile');
    const dmg = (missileDamage(lvl) * mods.damage * powerMult) / plan.count;
    for (let i = 0; i < plan.count; i++) {
      fireMissile(state, target.x, target.y, dmg, missileRadius(lvl) * mods.area, mods.velocity, opts);
    }
  },
};

export function updateMissileWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.missile;
  if (!lvl) return;
  runWeaponPipeline(state, dt, lvl, missilePipeline, 'missile');
}

function fireMissile(
  state: GameState,
  targetX: number,
  targetY: number,
  dmg: number,
  splashRadius: number,
  velocityMult: number,
  opts: ReturnType<typeof resolveOpts>,
): void {
  const t = state.tower;
  state.projectiles.push({
    type: 'missile',
    x: t.x,
    y: t.y,
    vx: 0,
    vy: 0,
    speed: MISSILE_SPEED * velocityMult,
    dmg,
    splashRadius,
    radius: 5,
    color: '#ff9d6b',
    life: 5,
    targetPoint: { x: targetX, y: targetY },
    src: 'missile',
    ...opts,
  });
}
