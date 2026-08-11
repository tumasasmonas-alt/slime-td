import type { GameState } from '../state';
import { extensionLevel } from '../systems/extensions';
import { emissionPlan, projectileFlags, resolveOpts } from '../systems/resolveOpts';
import { targetingAcquire } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { missileCooldown, missileDamage, missileRadius } from '../tuning/weapons';
import { cooldownReady, frontierAcquire, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const MISSILE_SPEED = 300;

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Missile's
// four extensions. Bunker Buster is a pure resolve field (armorScaled,
// grid/clear.ts). Proximity Fuse/Cluster Warhead are consumed in
// systems/projectiles.ts's updateMissile. Salvo reuses 6A-2's
// deferred-emissions queue rather than a new mechanism.
const BUNKER_BUSTER_SCALE: readonly [number, number, number] = [0.08, 0.12, 0.16];
const PROXIMITY_FUSE_DIST: readonly [number, number, number] = [35, 50, 65];
const CLUSTER_COUNT: readonly [number, number, number] = [3, 4, 5];
const SALVO_BONUS: readonly [number, number, number] = [1, 1, 2];
const SALVO_SPACING = 0.13;

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
//
// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S2): Fork/Chaining/
// Bounce/Ricochet were never merged in here at all, so a missile carrying
// one of these gems silently ignored it regardless of what
// systems/projectiles.ts's own branch did with the field — the field
// never reached the projectile in the first place. Merged in like Bolt's
// now; systems/projectiles.ts grafts their resolution onto detonation.
export const missilePipeline: WeaponPipeline = {
  ready: cooldownReady('missile', missileCooldown),
  acquire: targetingAcquire('missile', (s) => s.grid?.maxRange ?? 0, frontierAcquire),
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const mods = weaponMods(state, 'missile');
    const plan = emissionPlan(state, 'missile');
    const opts = { ...projectileFlags(state, 'missile'), ...resolveOpts(state, 'missile') };
    const dmg = (missileDamage(lvl) * mods.damage * powerMult) / plan.count;

    const bunkerLvl = extensionLevel(state, 'missile', 'bunkerBuster');
    const fullOpts = bunkerLvl > 0 ? { ...opts, armorScaled: BUNKER_BUSTER_SCALE[bunkerLvl - 1] } : opts;

    const proximityLvl = extensionLevel(state, 'missile', 'proximityFuse');
    const proximityFuseDist = proximityLvl > 0 ? PROXIMITY_FUSE_DIST[proximityLvl - 1] : undefined;
    const clusterLvl = extensionLevel(state, 'missile', 'clusterWarhead');
    const clusterCount = clusterLvl > 0 ? CLUSTER_COUNT[clusterLvl - 1] : undefined;

    for (let i = 0; i < plan.count; i++) {
      fireMissile(state, target.x, target.y, dmg, missileRadius(lvl) * mods.area, mods.velocity, fullOpts, proximityFuseDist, clusterCount, 0);
    }

    // Salvo: extra missiles sequenced over SALVO_SPACING rather than
    // simultaneous. Deliberately NOT the deferred-emissions queue
    // (systems/emissions.ts) — that re-invokes this same `deliver`
    // function, which would re-trigger Salvo's own scheduling on every
    // deferred call and recurse forever. Instead each bonus missile spawns
    // immediately but carries its own `armAt` — updateMissile
    // (systems/projectiles.ts) holds it inert at the tower until then.
    const salvoLvl = extensionLevel(state, 'missile', 'salvo');
    if (salvoLvl > 0) {
      const bonus = SALVO_BONUS[salvoLvl - 1]!;
      for (let i = 1; i <= bonus; i++) {
        fireMissile(state, target.x, target.y, dmg, missileRadius(lvl) * mods.area, mods.velocity, fullOpts, proximityFuseDist, clusterCount, state.time + SALVO_SPACING * i);
      }
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
  opts: ReturnType<typeof projectileFlags> & ReturnType<typeof resolveOpts>,
  proximityFuseDist: number | undefined,
  clusterCount: number | undefined,
  armAt: number,
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
    life: 5, // armAt is at most a couple SALVO_SPACING beats away — well inside this window
    targetPoint: { x: targetX, y: targetY },
    src: 'missile',
    proximityFuseDist,
    clusterCount,
    armAt,
    ...opts,
  });
}
