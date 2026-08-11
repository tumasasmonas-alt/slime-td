import type { ClearShape } from '../grid/clear';
import type { Coagulant, GameState } from '../state';
import { isTargetingGem } from '../tuning/gems';
import type { TargetingGemKey, WeaponKey } from '../types';
import { dist } from '../util/math';
import { coagulantSurfaceDist } from './coagulants';
import { nearestFrontierPoint, type FrontierPoint } from './frontier';
import {
  bestCoagulant,
  deepestIncursionPoint,
  densestFieldPoint,
  highestMassPoint,
  outsidePerimeterPoint,
  weakestCoagulantPoint,
} from './targeting';

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): the dispatch
// layer between a socketed Targeting gem and the acquire functions in
// systems/targeting.ts — the one place that knows how each gem kind maps
// to a reading, on both a weapon that aims (targetingAcquire, below) and
// one that doesn't (auraTargetingReading).

// First-draft, like every other Targeting/Behaviour gem constant in the
// project — sized against Amplifier's +45% flat damage (tuning/gems.ts),
// smaller because this is a bonus on ONE coagulant within an area hit
// that would otherwise land on everything, not a blanket multiplier.
const AURA_FOCUS_BONUS = 0.35;
// How long Opportunist keeps redirecting to the last hit before it's
// stale — long enough to matter within one weapon's own cooldown, short
// enough that it reads as "riding the moment," not a second Fixation.
const OPPORTUNIST_WINDOW = 1.2;

export function targetingGemFor(state: GameState, key: WeaponKey): TargetingGemKey | undefined {
  const sockets = state.weaponSockets[key];
  const gem = sockets?.gems.find((g) => isTargetingGem(g.kind));
  return gem ? (gem.kind as TargetingGemKey) : undefined;
}

// Fixation's per-weapon lock: keep the current target while it's still
// alive and in range, otherwise pick a fresh one (highest-mass, the same
// criterion Threat Priority uses — the least-surprising default for "what
// do I lock onto first"). Shared between the ACQUIRE-stage reading
// (fixationPoint, below) and the aura reading (auraTargetingReading's
// 'fixation' case) so the two can never pick differently for the same
// weapon.
function pickOrKeepFixationTarget(state: GameState, key: WeaponKey, x: number, y: number, maxRange: number): Coagulant | null {
  const current = state.fixationTarget[key];
  const stillValid = !!current && current.mass > 0 && current.phase !== 'forming' && dist(x, y, current.x, current.y) <= maxRange + current.radius;
  const target = stillValid ? current! : bestCoagulant(state, x, y, maxRange, (a, b) => a.mass > b.mass);
  if (target) {
    state.fixationTarget[key] = target;
  } else {
    delete state.fixationTarget[key];
  }
  return target;
}

function fixationPoint(state: GameState, key: WeaponKey, maxRange: number): FrontierPoint | null {
  const t = state.tower;
  const target = pickOrKeepFixationTarget(state, key, t.x, t.y, maxRange);
  if (target) return { x: target.x, y: target.y, dist: coagulantSurfaceDist(target, t.x, t.y) };
  return nearestFrontierPoint(state);
}

// Wraps a weapon's default ACQUIRE so a socketed Targeting gem replaces
// it wholesale (weapons/pipeline.ts's own contract for the stage) —
// falls back to `defaultAcquire` when no Targeting gem is socketed, or
// when the socketed kind has no ACQUIRE-stage reading (fieldPriority/
// opportunist are the only ones legal here in the first place, per
// tuning/gems.ts's TARGETING_GEM_DEFS, so the `default` branch below is
// unreachable in practice — kept as a defensive fallback rather than an
// assertion, consistent with how gemLegalFor already gates what a player
// can socket).
//
// `maxRangeFor` is a function, not a number, because most callers want
// the weapon's own live `state.grid.maxRange` (unknown at the module-load
// time pipelines are defined) while Lance wants its own fixed
// `LANCE_RANGE` instead.
export function targetingAcquire(
  key: WeaponKey,
  maxRangeFor: (state: GameState) => number,
  defaultAcquire: (state: GameState) => FrontierPoint | null,
): (state: GameState) => FrontierPoint | null {
  return (state) => {
    const kind = targetingGemFor(state, key);
    if (!kind) return defaultAcquire(state);
    const maxRange = maxRangeFor(state);
    switch (kind) {
      case 'threatPriority':
        return highestMassPoint(state, maxRange);
      case 'fieldPriority':
        return densestFieldPoint(state, maxRange);
      case 'breachPriority':
        return deepestIncursionPoint(state, maxRange);
      case 'vigilance':
        return outsidePerimeterPoint(state, maxRange);
      case 'triage':
        return weakestCoagulantPoint(state, maxRange);
      case 'fixation':
        return fixationPoint(state, key, maxRange);
      case 'opportunist': {
        const hit = state.lastHitPoint;
        if (state.time - hit.time > OPPORTUNIST_WINDOW) return defaultAcquire(state);
        return { x: hit.x, y: hit.y, dist: dist(state.tower.x, state.tower.y, hit.x, hit.y) };
      }
      default:
        return defaultAcquire(state);
    }
  };
}

// The self-centered reading — Blades/Frost/Immolation/Shockwave have no
// ACQUIRE stage (pipeline.ts's own comment: "there is nothing to
// acquire, the tower is always the origin"), so a Targeting gem can't
// replace a stage that doesn't exist. Instead of a refusal across the
// board, five of the seven gems get an honest reading against the aura's
// own hit: Vigilance clips the near field out of the shape entirely;
// Threat Priority/Triage/Breach Priority/Fixation pick ONE coagulant
// within the aura's reach and bonus-damage it, via ClearOptions'
// `focusTarget`/`focusBonus` (grid/clear.ts). Field Priority and
// Opportunist stay refused (tuning/gems.ts) — both would either duplicate
// Homing or have no aim point to redirect, so `default` here is
// unreachable in practice, same caveat as targetingAcquire above.
//
// `originX`/`originY` is the aura's own hit centre — normally the tower,
// but Frost's Homing offset moves it, and this reading follows that
// offset rather than always reading the tower directly.
export interface AuraTargetingReading {
  readonly shape?: ClearShape;
  readonly focusTarget?: Coagulant;
  readonly focusBonus?: number;
}

const NO_READING: AuraTargetingReading = {};

export function auraTargetingReading(state: GameState, key: WeaponKey, originX: number, originY: number, radius: number): AuraTargetingReading {
  const kind = targetingGemFor(state, key);
  if (!kind) return NO_READING;
  const grid = state.grid;
  switch (kind) {
    case 'vigilance':
      // Not legal on 'orbital' (Blades) — tuning/gems.ts's own comment
      // explains why (the orbit never reaches inside the perimeter in
      // the first place), so this branch is unreachable for Blades.
      return grid ? { shape: { kind: 'annulus', inner: grid.perimeter, outer: radius } } : NO_READING;
    case 'threatPriority': {
      const target = bestCoagulant(state, originX, originY, radius, (a, b) => a.mass > b.mass);
      return target ? { focusTarget: target, focusBonus: AURA_FOCUS_BONUS } : NO_READING;
    }
    case 'triage': {
      const target = bestCoagulant(state, originX, originY, radius, (a, b) => a.mass < b.mass);
      return target ? { focusTarget: target, focusBonus: AURA_FOCUS_BONUS } : NO_READING;
    }
    case 'breachPriority': {
      const t = state.tower;
      const target = bestCoagulant(state, originX, originY, radius, (a, b) => dist(t.x, t.y, a.x, a.y) < dist(t.x, t.y, b.x, b.y));
      return target ? { focusTarget: target, focusBonus: AURA_FOCUS_BONUS } : NO_READING;
    }
    case 'fixation': {
      const target = pickOrKeepFixationTarget(state, key, originX, originY, radius);
      return target ? { focusTarget: target, focusBonus: AURA_FOCUS_BONUS } : NO_READING;
    }
    default:
      return NO_READING;
  }
}
