import type { ChainProjectile, GameState, Grid, MissileProjectile, Projectile } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { WEAPON_DEFS } from '../tuning/weapons';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { dist, lerp } from '../util/math';
import { spawnChainFx } from './chainFx';
import { findCoagulantHit } from './coagulants';
import { nearestFrontierPoint } from './frontier';
import { spawnParticles } from './particles';
import { findNearbyRevealedPoint } from './targeting';
import { spawnBubbleSeeds } from '../weapons/poison';

const OFFSCREEN_MARGIN = 60;
const BOLT_IMPACT_RADIUS = 30;
const CHAIN_IMPACT_RADIUS = 26;
const CHAIN_HOP_SEARCH_RADIUS = 150;
const CHAIN_HOP_SPEED = 760;
const CHAIN_DAMAGE_DECAY = 0.82;
const MISSILE_STEER = 0.15;
const MISSILE_REACH_DIST = 14;
// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S3): the generic
// behaviour-flag versions reuse Chain's own hop speed/decay/search radius
// rather than inventing separate constants — chains/bounces on a Bolt or
// Missile projectile are the same physical mechanic Chain already has,
// generalized off `p.type === 'chain'` onto any projectile carrying the
// flag.
const FORK_COUNT = 2;
const FORK_DAMAGE_SHARE = 0.5;
const FORK_SPREAD = 0.35; // radians either side of the original heading
const HOMING_STEER = 0.15; // matches missile's own MISSILE_STEER lerp factor

// Bolt and chain share the same straight-line travel and reveal-hit
// detection; missile homes toward its target instead and detonates on
// arrival or on touching the wall early, so it gets its own branch.
export function updateProjectiles(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const remaining: Projectile[] = [];
  for (const p of state.projectiles) {
    p.life -= dt;
    if (p.life <= 0) continue;

    if (p.type === 'missile' || p.type === 'fission') {
      // Phase 6B-2: Cluster Warhead — checked BEFORE calling updateMissile
      // since a `false` return means it just detonated and cleared its
      // own fields; the submunitions still need p.clusterCount and the
      // final x/y updateMissile leaves it at, so they're built from the
      // pre-call snapshot's clusterCount but read x/y after the call.
      //
      // Phase 6C-1 (S4.1): 'fission' rides this exact branch — Fission
      // Charge always carries a clusterCount, so every shot bursts, not
      // just ones with an extension socketed.
      const hadCluster = p.clusterCount;
      if (updateMissile(state, grid, p, dt)) {
        remaining.push(p);
      } else if (hadCluster) {
        remaining.push(...spawnClusterSubmunitions(p));
      }
      continue;
    }

    // Phase 6A-2: the Homing gem's projectile reading. Missile already
    // homes natively (its own branch above); this is the same lerp-
    // toward-target steering for a Bolt or Chain that gained Homing.
    if (p.homing && p.homingTarget) {
      const a = Math.atan2(p.homingTarget.y - p.y, p.homingTarget.x - p.x);
      const speed = Math.hypot(p.vx, p.vy);
      p.vx = lerp(p.vx, Math.cos(a) * speed, HOMING_STEER);
      p.vy = lerp(p.vy, Math.sin(a) * speed, HOMING_STEER);
    }

    // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Bolt's
    // Tracking Rounds — unlike Homing (one target, captured at spawn),
    // this re-runs nearestFrontierPoint every tick and turns toward
    // whatever it finds at a fixed rate, so a bolt can retarget mid-flight
    // if its original target dies first.
    if (p.reacquireRate) {
      const retarget = nearestFrontierPoint(state);
      if (retarget) {
        const a = Math.atan2(retarget.y - p.y, retarget.x - p.x);
        const speed = Math.hypot(p.vx, p.vy);
        const heading = Math.atan2(p.vy, p.vx);
        const maxTurn = p.reacquireRate * dt;
        let diff = a - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        const newHeading = heading + turn;
        p.vx = Math.cos(newHeading) * speed;
        p.vy = Math.sin(newHeading) * speed;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (
      p.x < -OFFSCREEN_MARGIN ||
      p.x > WORLD_WIDTH + OFFSCREEN_MARGIN ||
      p.y < -OFFSCREEN_MARGIN ||
      p.y > WORLD_HEIGHT + OFFSCREEN_MARGIN
    ) {
      continue;
    }

    const { cx, cy } = worldToCell(grid, p.x, p.y);
    const i = gIdx(grid, cx, cy);
    const revealed = isRevealedIdx(grid, i);
    // Coagulants are entities, not grid cells — a blob sitting in an
    // already-cleared area would never register on the isRevealedIdx
    // check above, so it needs its own collision test alongside it.
    const hitCoagulant = findCoagulantHit(state, p.x, p.y, p.radius);
    if (revealed || hitCoagulant) {
      spawnParticles(state, p.x, p.y, p.color, 5, 60);
      const coagulantMult = WEAPON_DEFS[p.type]?.coagulantMult ?? 1;
      // Phase 6A-1: Expansion's area scaling on impact radius, baked in
      // at spawn time (weapons/bolt.ts, weapons/chain.ts) rather than
      // looked up here — a projectile's impact radius is fixed the
      // instant it fires, same as its damage.
      const areaMult = p.impactAreaMult ?? 1;
      // Phase 6A-2: RESOLVE options (Pierce/Splash/Overflow/Kickback/
      // Priming), also baked in at spawn — see state.ts's ProjectileBase
      // comment for why these are individual fields rather than one
      // nested ClearOptions.
      const resolveOpts = {
        ignoreResistance: p.ignoreResistance,
        flattenFalloff: p.flattenFalloff,
        overflow: p.overflow,
        kickback: p.kickback,
        priming: p.priming,
      };

      if (p.type === 'chain') {
        // Chain's own identity — untouched by 6A-2. This IS what the
        // generic `chains` flag below generalizes; kept as its own branch
        // rather than folded in so Chain's 23 pre-existing tests, and its
        // visual trail (spawnChainFx), stay exactly as they were.
        spawnChainFx(state, p.legStart.x, p.legStart.y, p.x, p.y);

        // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7):
        // Backlash — the hop that's about to be the LAST one (hopsLeft
        // reaching 0 after this impact) deals a bonus multiplier. Checked
        // before the decrement below so "final" means "this landing".
        const willBeFinalHop = p.hopsLeft - 1 <= 0;
        const hitDmg = willBeFinalHop && p.finalHopMult ? p.dmg * p.finalHopMult : p.dmg;
        clearAt(state, p.x, p.y, hitDmg, { radiusPx: CHAIN_IMPACT_RADIUS * areaMult, coagulantMult, ...resolveOpts });
        p.visited.add(i);
        p.hopsLeft -= 1;
        if (p.hopsLeft > 0) {
          const next = findNextChainHop(state, grid, p.x, p.y, p.visited, p.densityBias);
          if (next) {
            const a = Math.atan2(next.y - p.y, next.x - p.x);
            p.legStart = { x: p.x, y: p.y };
            p.vx = Math.cos(a) * CHAIN_HOP_SPEED;
            p.vy = Math.sin(a) * CHAIN_HOP_SPEED;
            // Static Buildup: grows per-hop damage instead of decaying it.
            p.dmg *= p.hopGrowth ?? CHAIN_DAMAGE_DECAY;
            remaining.push(p);

            // Split Arc: the first hop transition (matching the card's
            // "the 2nd hop also spawns a branch" — one branch per flight,
            // never re-triggered on later hops via `splitArcUsed`) spawns
            // a child continuing the remaining hops on its own path.
            // Return-children shape, same reason spawnForks() doesn't push
            // onto state.projectiles directly (this loop is mid-iteration
            // over it).
            if (p.splitArcPower && !p.splitArcUsed) {
              p.splitArcUsed = true;
              remaining.push(...spawnChainSplitArc(state, grid, p));
            }
          }
        }
        continue;
      }

      clearAt(state, p.x, p.y, p.dmg, { radiusPx: BOLT_IMPACT_RADIUS * areaMult, coagulantMult, ...resolveOpts });

      // Phase 6A-2: the generic behaviour flags, in priority order —
      // at most one outcome per hit rather than composing all five, which
      // is a deliberate simplification (docs/plans/phase-6a2-behaviour-
      // gems.md), not an oversight. Most builds carry one Behaviour gem
      // per weapon anyway; this ordering just guarantees sane behaviour
      // for any combination rather than crashing or double-resolving.
      if (p.forks && p.forks > 0 && !p.forked) {
        // Pushed onto `remaining`, not `state.projectiles` — this loop is
        // mid-iteration over state.projectiles, and it's overwritten
        // wholesale by `remaining` at the end. Pushing onto the array
        // currently being iterated would silently vanish the moment that
        // overwrite happens.
        remaining.push(...spawnForks(p));
        continue; // the parent itself is consumed — only the children survive
      }
      if (p.chains && p.chains > 0) {
        p.visited ??= new Set();
        if (advanceHop(state, grid, p, p.visited, i, findNextChainHop, CHAIN_DAMAGE_DECAY, 'chains')) {
          remaining.push(p);
        }
        continue;
      }
      if (p.bounces && p.bounces > 0 && hitCoagulant) {
        p.bounceVisited ??= new Set();
        if (advanceHop(state, grid, p, p.bounceVisited, null, findNextBounceHop, CHAIN_DAMAGE_DECAY, 'bounces')) {
          remaining.push(p);
        }
        continue;
      }
      if (p.ricochet && !p.ricocheted) {
        p.ricocheted = true;
        p.vx = -p.vx;
        p.vy = -p.vy;
        remaining.push(p);
        continue;
      }
      if (p.pierce && p.pierce > 0) {
        p.pierce -= 1;
        remaining.push(p);
        continue;
      }
      continue; // no behaviour flag applies — despawn on impact, same as before 6A-2
    }
    remaining.push(p);
  }
  state.projectiles = remaining;
}

// Shared by the generic `chains` and `bounces` flags — advances a
// projectile to its next hop target using the given search function,
// decaying damage the same way Chain's own native hop does. Returns
// whether the projectile should keep flying (a next target was found and
// the hop budget isn't exhausted).
function advanceHop(
  state: GameState,
  grid: Grid,
  p: Projectile,
  visited: Set<number>,
  cellIdx: number | null,
  findNext: (state: GameState, grid: Grid, x: number, y: number, visited: Set<number>) => { x: number; y: number } | null,
  decay: number,
  countField: 'chains' | 'bounces',
): boolean {
  // Grid-cell-index marking only makes sense for the `chains` path
  // (findNextChainHop reads it via findNearbyRevealedPoint) — the
  // `bounces` path's visited set is keyed by coagulant array index
  // instead, and findNextBounceHop manages that itself, so `cellIdx` is
  // null there rather than polluting a different index space.
  if (cellIdx !== null) visited.add(cellIdx);
  const remaining = (p[countField] ?? 0) - 1;
  p[countField] = remaining;
  if (remaining <= 0) return false;
  const next = findNext(state, grid, p.x, p.y, visited);
  if (!next) return false;
  const a = Math.atan2(next.y - p.y, next.x - p.x);
  p.vx = Math.cos(a) * CHAIN_HOP_SPEED;
  p.vy = Math.sin(a) * CHAIN_HOP_SPEED;
  p.dmg *= decay;
  return true;
}

// Splits a projectile into FORK_COUNT children on first impact — half
// damage each (a deliberate balance choice, not exact conservation:
// forking creates more hit opportunities, which is the point), spread a
// few degrees either side of the original heading, marked `forked` so
// they can never fork again. Returns the children for the caller to add
// to `remaining` — see the call site for why it can't push onto
// state.projectiles directly.
function spawnForks(p: Projectile): Projectile[] {
  const baseAngle = Math.atan2(p.vy, p.vx);
  const speed = Math.hypot(p.vx, p.vy);
  const children: Projectile[] = [];
  for (let k = 0; k < FORK_COUNT; k++) {
    const spread = (k - (FORK_COUNT - 1) / 2) * FORK_SPREAD;
    const a = baseAngle + spread;
    children.push({
      ...p,
      dmg: p.dmg * FORK_DAMAGE_SHARE,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      forks: 0,
      forked: true,
    });
  }
  return children;
}

// Chain's next hop can land on either a nearby revealed grid cluster or a
// nearby coagulant — whichever is closer, same "just another close thing"
// rule targeting already applies (Decision 45). Also used by the generic
// `chains` flag (docs/plans/phase-6a2-behaviour-gems.md S3).
//
// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Conductive's
// `densityBias` discounts the grid candidate's distance (findNearbyRevealedPoint
// already always picks the densest cell in range, so a flat multiplier on
// its score wouldn't change anything within the grid choice alone) — it
// makes the grid candidate look closer than it is when comparing against a
// coagulant, so Chain leans toward dense terrain over the nearest blob.
function findNextChainHop(
  state: GameState,
  grid: Grid,
  x: number,
  y: number,
  visited: Set<number>,
  densityBias?: number,
): { x: number; y: number } | null {
  const gridPoint = findNearbyRevealedPoint(grid, x, y, CHAIN_HOP_SEARCH_RADIUS, visited);
  const blob = findCoagulantHit(state, x, y, CHAIN_HOP_SEARCH_RADIUS);
  if (!blob) return gridPoint;
  if (!gridPoint) return { x: blob.x, y: blob.y };
  const blobDist = dist(x, y, blob.x, blob.y);
  const gridDist = dist(x, y, gridPoint.x, gridPoint.y) / (densityBias ?? 1);
  return blobDist < gridDist ? { x: blob.x, y: blob.y } : gridPoint;
}

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Split Arc —
// one branch, spawned once per flight, carrying the remaining hops on its
// own independent path at reduced power. Reuses findNextChainHop for its
// own first target rather than duplicating the search.
function spawnChainSplitArc(state: GameState, grid: Grid, p: ChainProjectile): Projectile[] {
  if (p.hopsLeft <= 0) return [];
  const branchVisited = new Set(p.visited);
  const next = findNextChainHop(state, grid, p.x, p.y, branchVisited);
  if (!next) return [];
  const a = Math.atan2(next.y - p.y, next.x - p.x);
  return [
    {
      ...p,
      dmg: p.dmg * p.splitArcPower!,
      vx: Math.cos(a) * CHAIN_HOP_SPEED,
      vy: Math.sin(a) * CHAIN_HOP_SPEED,
      legStart: { x: p.x, y: p.y },
      visited: branchVisited,
      splitArcPower: undefined,
      splitArcUsed: true,
    },
  ];
}

// Phase 6A-2: Bounce's distinct reading from Chaining (docs/plans/
// phase-6a2-behaviour-gems.md S6) — coagulant-only, never a grid cluster.
// `visited` here tracks coagulants by a synthetic id (their object
// identity via a WeakMap would be cleaner, but state.coagulants entries
// are plain objects reused across a hop chain within one flight, so a
// simple re-scan excluding the immediately-previous target is sufficient
// and avoids adding an id field to Coagulant just for this).
function findNextBounceHop(state: GameState, _grid: Grid, x: number, y: number, visited: Set<number>): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  let bestKey = -1;
  for (let idx = 0; idx < state.coagulants.length; idx++) {
    const c = state.coagulants[idx]!;
    if (c.mass <= 0 || c.phase === 'forming') continue;
    if (visited.has(idx)) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestDist && d <= CHAIN_HOP_SEARCH_RADIUS) {
      bestDist = d;
      best = { x: c.x, y: c.y };
      bestKey = idx;
    }
  }
  if (best) visited.add(bestKey);
  return best;
}

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S7): Cluster
// Warhead's submunitions — smaller, weaker missiles fired outward from
// the detonation point at spawn (not homing onto a new target, since the
// detonation itself already resolved the primary target). Reuses the
// existing missile-collision path (updateMissile itself) by giving each
// submunition a targetPoint a short distance from where it spawned.
const CLUSTER_POWER_SHARE = 0.25;
const CLUSTER_SPREAD_DIST = 70;

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S5): Fission's
// Chain Fission — how many children a split grants, and at what power
// share, keyed by the extension's own level (matching its desc string:
// "1/2/2 child(ren) ... at 50% power").
const CHAIN_FISSION_CHILD_COUNT: readonly [number, number, number] = [1, 2, 2];
const CHAIN_FISSION_POWER_SHARE = 0.5;

// Phase 6C-1 (S4.1): `scatterDist`/`childPowerShare` default to Missile's
// original constants, so Cluster Warhead's own behaviour is byte-for-byte
// unchanged — its tests are the guard. Fission Charge sets both
// explicitly (weapons/fission.ts).
function spawnClusterSubmunitions(p: MissileProjectile): MissileProjectile[] {
  const count = p.clusterCount!;
  const scatterDist = p.scatterDist ?? CLUSTER_SPREAD_DIST;
  const powerShare = p.childPowerShare ?? CLUSTER_POWER_SHARE;
  const childGen = (p.fissionGen ?? 0) + 1;
  // Chain Fission (S9 risk 2 — terminates by construction, not by
  // observation): a child is only granted its own clusterCount when its
  // PARENT was itself a generation-0 (never-split) projectile. Since
  // childGen strictly increases every call and this check reads the
  // PARENT's generation, a generation-1 child's own children (generation
  // 2) always fail this check — there is no value of fissionGen that lets
  // a third split happen.
  const grantsAnotherSplit = p.chainFissionLvl !== undefined && (p.fissionGen ?? 0) === 0;
  const children: MissileProjectile[] = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    children.push({
      ...p,
      dmg: p.dmg * powerShare,
      splashRadius: p.splashRadius * 0.6,
      targetPoint: { x: p.x + Math.cos(a) * scatterDist, y: p.y + Math.sin(a) * scatterDist },
      vx: Math.cos(a) * p.speed,
      vy: Math.sin(a) * p.speed,
      clusterCount: grantsAnotherSplit ? CHAIN_FISSION_CHILD_COUNT[p.chainFissionLvl! - 1] : undefined,
      childPowerShare: grantsAnotherSplit ? CHAIN_FISSION_POWER_SHARE : undefined,
      fissionGen: childGen,
      proximityFuseDist: undefined,
      armAt: 0,
    });
  }
  return children;
}

// Returns whether the missile should keep flying this frame.
function updateMissile(state: GameState, grid: Grid, p: MissileProjectile, dt: number): boolean {
  // Salvo: an armed-later missile sits inert at its spawn point until its
  // arming time — no steering, no detonation checks, so it visibly waits
  // its turn rather than flying immediately alongside the first shot.
  if (p.armAt > state.time) return true;

  const tx = p.targetPoint.x;
  const ty = p.targetPoint.y;

  const a = Math.atan2(ty - p.y, tx - p.x);
  p.vx = lerp(p.vx, Math.cos(a) * p.speed, MISSILE_STEER);
  p.vy = lerp(p.vy, Math.sin(a) * p.speed, MISSILE_STEER);
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const reached = dist(p.x, p.y, tx, ty) < MISSILE_REACH_DIST;
  const { cx, cy } = worldToCell(grid, p.x, p.y);
  const hitWall = isRevealedIdx(grid, gIdx(grid, cx, cy));
  const hitCoagulant = findCoagulantHit(state, p.x, p.y, p.radius);
  // Proximity Fuse: an extra, earlier trigger — a coagulant within its
  // distance detonates the missile before it would otherwise reach,
  // touch a wall, or physically collide.
  const proximityHit = p.proximityFuseDist !== undefined && findCoagulantHit(state, p.x, p.y, p.proximityFuseDist) !== null;
  if (reached || hitWall || hitCoagulant || proximityHit) {
    spawnParticles(state, p.x, p.y, p.color, 18, 160);
    // Phase 6C-1 (S4.1): reads p.type now, not a hardcoded 'missile' —
    // this branch is shared with Fission Charge, and each weapon's own
    // WEAPON_DEFS.coagulantMult should apply to its own projectiles.
    const coagulantMult = WEAPON_DEFS[p.type]?.coagulantMult ?? 1;
    clearAt(state, p.x, p.y, p.dmg, {
      radiusPx: p.splashRadius,
      coagulantMult,
      // Phase 6A-2: RESOLVE options baked in at spawn (weapons/missile.ts).
      ignoreResistance: p.ignoreResistance,
      flattenFalloff: p.flattenFalloff,
      overflow: p.overflow,
      kickback: p.kickback,
      priming: p.priming,
      // Phase 6B-2: Bunker Buster.
      armorScaled: p.armorScaled,
    });
    // Phase 6C-1 (S5): Sticky — every submunition carrying this leaves a
    // small burning patch, reusing the CausticCloud entity/renderer wholesale
    // rather than a new persistent-effect type.
    if (p.stickyBurn) {
      state.clouds.push({
        x: p.x,
        y: p.y,
        radius: p.stickyBurn.radius,
        life: p.stickyBurn.life,
        maxLife: p.stickyBurn.life,
        dmgPerSec: p.stickyBurn.dmgPerSec,
        color: p.color,
        tickTimer: 0,
        bubbleSeeds: spawnBubbleSeeds(),
      });
    }
    return false;
  }
  return true;
}
