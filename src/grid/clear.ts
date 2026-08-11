import type { Coagulant, GameState, Grid } from '../state';
import type { WeaponKey } from '../types';
import { circleOverlapArea, clamp, closestPointOnSegment, dist, distToSegment, rand } from '../util/math';
import {
  COAGULANT_ARMOR_FLOOR,
  COAGULANT_DAMAGE_SCALE,
  COAGULANT_RESISTANCE,
  MASS_BEHEMOTH,
  MASS_CONGEALER,
} from '../tuning/coagulants';
import { MATURITY_MAX, SCAR_PER_DENSITY, ageFloorAt, maturityBucket, maturityYieldMult } from '../tuning/maturity';
import { COAGULANT_XP_RISK_PREMIUM, gemValueFromRemoved } from '../tuning/xp';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../tuning/world';
import { dropGemShower } from '../systems/gems';
import { coagulantOverlapArea, splatterOnDeath } from '../systems/coagulants';
import { spawnParticles } from '../systems/particles';
import { cellBucket, gIdx, worldToCell } from './grid';

export interface ClearOptions {
  radiusPx?: number;
  freezeDuration?: number;
  // Per-weapon multiplier on damage dealt to coagulants — see
  // tuning/weapons.ts's WeaponDef.coagulantMult. Weapons that don't pass
  // one (tests, ad-hoc calls) get the neutral default.
  coagulantMult?: number;

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): the RESOLVE
  // stage, added as new ClearOptions fields rather than a real pipeline
  // stage — arsenal plan S4's one hard constraint is that stage 4 "may
  // add new ClearOptions; it may not add a second damage path," and
  // clearAt already is that one path (Decision 42). Built by
  // systems/resolveOpts.ts from a weapon's socketed gems; every field
  // here is a Behaviour-class gem's effect on this call.

  // Pierce, on the three area archetypes (pulse/cloud/ring): the grid
  // loop's density-resistance curve is skipped, so the hit lands at full
  // power into thick tissue instead of being blunted where it matters
  // most — a partial answer to "nothing scales up against density"
  // (arsenal plan S3). Grid-only; a coagulant's own resistance constant
  // represents "already maximum density" and has nothing to bypass.
  ignoreResistance?: boolean;
  // Splash, on the three area archetypes: flattens the linear distance
  // falloff so the rim of the hit reads close to full power instead of
  // trailing to zero — distinct from Expansion (bigger radius, same
  // shape) rather than a duplicate of it.
  flattenFalloff?: boolean;
  // Overflow: damage that would overkill a coagulant carries to the
  // single nearest surviving coagulant instead of being discarded by the
  // clamp below. One hop only, applied once after the main coagulant
  // loop — never chained further, so it terminates by construction.
  overflow?: boolean;
  // Kickback: every coagulant hit is shoved this many pixels outward from
  // the hit's origin, clamped to stay inside the arena. Establishes the
  // displacement primitive Repulsor (6F) and Inversion (6I) later reuse.
  kickback?: number;
  // Priming: a coagulant not hit in the last PRIMING_WINDOW seconds takes
  // this multiplier on the hit that breaks that streak. Coagulant-only —
  // see systems/resolveOpts.ts for why grid cells don't carry the same
  // per-cell "last hit" state (the exact cost that got assist credit
  // dropped in 5B).
  priming?: number;

  // Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S2-S4): the
  // extension-carried effects, following the same "new ClearOptions
  // field, never a second damage path" rule 6A-2's RESOLVE fields set.
  //
  // Shatter Core (Frost): `chill` marks a hit coagulant as chilled for
  // this many seconds; `shatter` is the damage multiplier a hit applies
  // if the TARGET was already chilled coming in. Ordering rule: a hit
  // that applies chill does not itself benefit from it — the chilled
  // check reads state before this hit's own `chill` write, or Frost would
  // silently double its own damage and Shatter Core would stop being a
  // setup card.
  chill?: number;
  shatter?: number;
  // Corrosive (Poison): strips this fraction of a hit coagulant's armour
  // for a fixed window. Bunker Buster (Missile): scales damage up by this
  // much per point of the target's (possibly-debuffed) armour — reads the
  // same effective-armour value Corrosive writes, in the other direction.
  armorShred?: number;
  armorScaled?: number;
  // Piercing Core (Lance, Phase 6C-2 docs/plans/phase-6c2-lance.md S6):
  // reduces effective armour by up to this many points, floored at 0 —
  // distinct from armorShred (a temporary debuff written back onto the
  // coagulant) and armorScaled (scales damage up WITH armour); this one
  // reduces the armour THIS hit sees, once, with no lasting effect.
  armorIgnoreCap?: number;
  // Rime (Frost) / Ash (Immolation): suppress ambient regrowth in the hit
  // radius — systems/growth.ts reads Grid.regrowMult/regrowTimer, written
  // here as a radius effect exactly like freezeDuration above.
  suppressRegrowth?: { mult: number; seconds: number };
  // Resonant Ring (Shockwave, Phase 6C-1 S5): damage scales UP with local
  // density instead of the resistance term scaling it down — arsenal plan
  // S3's "nothing scales up against density" gap, answered per-cell. On a
  // coagulant (whose "density" is fixed at 1, Decision 46) this is just a
  // flat `1 + densityScaled` bonus, applied in the coagulant loop below.
  densityScaled?: number;

  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Threat
  // Priority/Triage/Breach Priority/Fixation's aura reading — a bonus
  // fraction applied only to the ONE coagulant that equals `focusTarget`
  // by reference (coagulants have no id field; identity is the object
  // itself), so a weapon with no aim can still express "focus damage on
  // whichever one this gem's selection criterion picked" without a second
  // damage path. `focusTarget` is set by systems/targetingGems.ts, never
  // constructed here.
  focusTarget?: Coagulant;
  focusBonus?: number;

  // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3): the nine
  // Conditional gems. All RESOLVE-stage, all new `ClearOptions` fields,
  // no second damage path — Penetration and Corrosion reuse
  // `armorIgnoreCap`/`armorShred` above (already exist, from Lance's
  // Piercing Core and Poison's Corrosive extensions respectively — see
  // Decision 90 for the one thing that costs: when both a gem and the
  // matching extension are socketed on the same weapon, the gem's value
  // wins outright rather than stacking, since every weapon's own clearAt
  // call spreads `...opts` LAST, after its own extension-set fields).

  // Virulence: bonus damage against high-**maturity** ground. Grid-only —
  // coagulants have no per-cell maturity of their own (their `armor` is
  // already derived from maturity once, at formation).
  maturityScaled?: number;
  // Saturation: bonus damage scaled by local **density** at the hit.
  // Distinct from `densityScaled` above (Resonant Ring's own field) even
  // though both read `dens` — reusing that field would mean an extension
  // silently overwrites the gem's contribution instead of the two
  // stacking, the same collision this comment block just named for
  // armorIgnoreCap/armorShred, avoidable here since this is a new gem
  // with no field to collide against yet.
  saturationScaled?: number;
  // Giant-Slayer: bonus damage against **high-mass** coagulants, scaled
  // by mass relative to MASS_BEHEMOTH (tuning/coagulants.ts) — full bonus
  // at behemoth mass and up, tapering to none at low mass. Coagulant-only
  // (grid cells have no mass).
  massScaledUp?: number;
  // Culling: bonus damage against **low-mass** coagulants, the mirror of
  // Giant-Slayer — scaled by how far mass sits below MASS_CONGEALER.
  massScaledDown?: number;
  // Culling's other half: instantly finishes a coagulant once a hit
  // leaves it at or below this FRACTION of its own mass at formation
  // (`c.startMass`) — a fraction, not an absolute, so it does something to
  // a behemoth and doesn't delete a mote on sight (plan S3).
  cullingFinishFraction?: number;
  // Desperation: bonus damage scaling up as core integrity drops — read
  // from `state.tower.hp`/`maxHp` ONCE per clearAt call (not per cell or
  // per coagulant, since it doesn't vary within one hit) and folded
  // directly into `power` before either loop runs.
  desperationScaled?: number;
  // Proximity: bonus damage the closer this HIT's own centre is to the
  // core, relative to `grid.maxRange` — resolved once per call, same
  // shape as Desperation, folded into `power` before either loop.
  proximityScaled?: number;
  // Momentum: the ALREADY-RESOLVED multiplier for this call (built from
  // `state.weaponStreak[momentumKey]` by systems/resolveOpts.ts, since
  // that's the one place that already knows both the weapon key and the
  // live socket state) — applied to `power` once, same as Desperation/
  // Proximity above. `momentumKey` is carried alongside it purely so
  // clearAt can update the streak afterward: incremented on a hit,
  // reset on a miss OR a kill. Kill detection reuses
  // `state.lastCoagulantDeathAt` (Bladestorm's own signal,
  // weapons/blades.ts) rather than a new one — the same disclosed
  // imprecision Bladestorm already accepted ("any weapon, any
  // coagulant," not attributed to this specific hit), since clearAt has
  // no per-hit kill-attribution channel to read instead.
  momentumMult?: number;
  momentumKey?: WeaponKey;

  // Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S3): the shape
  // this call damages, generalizing "distance from (x,y), capped at
  // radiusPx" so Shockwave's travelling ring and (6C-2) Lance's beam can
  // reuse every downstream concern below — falloff, resistance, maturity,
  // scarring, the coagulant loop, XP, DPS — completely unchanged, reading
  // a shape-aware distance instead of a point distance. **Absent means
  // the original disc, byte-for-byte** (S3.4/S3.5's non-negotiable
  // constraint) — the disc branch below is untouched, not re-derived.
  //
  // Density-based radius widening (the disc's own
  // `clamp(1.25 - density, 0.4, 1.25)` term, sampled at the hit centre)
  // applies to the disc shape only. Annulus/capsule use their given
  // width literally — not an oversight: it sidesteps the density-sample-
  // point trap the plan flagged (a capsule sampled at its near-zero-
  // density tower origin would silently widen the whole beam) by
  // removing the coupling entirely, rather than fixing a sample point for
  // it. Nothing in either weapon's design calls for a ring's band width
  // or a beam's cross-section to vary with ambient density.
  shape?:
    | { readonly kind: 'annulus'; readonly inner: number; readonly outer: number }
    | { readonly kind: 'capsule'; readonly toX: number; readonly toY: number };
}

export type ClearShape = NonNullable<ClearOptions['shape']>;

const ARMOR_SHRED_WINDOW = 2.0;

// "Not hit recently," for Priming — long enough that a weapon has to
// genuinely spread its fire to keep triggering it, short enough that a
// single weapon cycling through a small group of coagulants still gets
// there.
const PRIMING_WINDOW = 2.0;

const GEM_DROP_THRESHOLD = 0.08;
// Shared by both the grid loop and the coagulant loop below, so a future
// balance-pass retune of one automatically keeps the other consistent —
// see docs/DECISIONS.md #50, "no new mechanic, just the same formula
// applied to an entity instead of a cell."
const DAMAGE_COEFF = 0.022;

// Phase 6C-1 (docs/plans/phase-6c1-shockwave-fission.md S3.1): the
// per-cell damage/freeze/scar formula, factored out so the disc branch
// and the annulus/capsule branch below share it exactly — every concern
// this comment block used to sit above inline (falloff, resistance,
// maturity, scarring, the dirty set) now lives in exactly one place
// regardless of which shape called it. `d`/`halfWidth` play the role the
// disc's own `d`/`radiusPx` always did: `1 - d/halfWidth` is the falloff
// term, unchanged.
function applyCellDamage(
  grid: Grid,
  state: GameState,
  i: number,
  d: number,
  halfWidth: number,
  power: number,
  opts: ClearOptions,
  ageFloor: number,
): number {
  const freezeDuration = opts.freezeDuration ?? 0;
  if (freezeDuration > 0) {
    // Phase 4B: frozen renders as a rim (grid/slimeLayer.ts), gated on the
    // dirty set like every other rendered state — mark dirty only on the
    // newly-frozen transition, not every hit while already frozen, or an
    // AoE freeze weapon would spam the dirty set for no visible change.
    const wasFrozen = grid.frozen[i]! > 0;
    grid.frozen[i] = Math.max(grid.frozen[i]!, freezeDuration);
    if (!wasFrozen) state.dirty.add(i);
  }
  if (opts.suppressRegrowth) {
    grid.regrowMult[i] = opts.suppressRegrowth.mult;
    grid.regrowTimer[i] = Math.max(grid.regrowTimer[i]!, opts.suppressRegrowth.seconds);
  }
  const dens = grid.growth[i]!;
  if (dens <= 0.001) return 0;
  const rawFalloff = 1 - d / halfWidth;
  const falloff = opts.flattenFalloff ? Math.max(rawFalloff, 0.85) : rawFalloff;
  const resistance = opts.ignoreResistance ? 1.3 : clamp(1.3 - dens, 0.12, 1.3);
  // Phase 4A: maturity further reduces yield, floored so nothing is ever
  // unclearable (Decision 44's guarantee restated for terrain).
  const matYield = maturityYieldMult(grid.maturity[i]!);
  // Resonant Ring: this cell's OWN density scales the hit up, independent
  // of (and stacking with) `resistance`'s usual scaling-down — the two
  // aren't the same lever, since resistance already applies regardless.
  const densityMult = opts.densityScaled ? 1 + opts.densityScaled * dens : 1;
  // Phase 6D-2: Saturation — the same "reward for hitting dense ground"
  // shape as Resonant Ring above, kept as its own field rather than
  // reusing `densityScaled` (this comment block's own ClearOptions note
  // explains why: an extension setting that field would silently
  // overwrite a gem's contribution instead of the two stacking).
  const saturationMult = opts.saturationScaled ? 1 + opts.saturationScaled * dens : 1;
  // Virulence: bonus scaling with this cell's own maturity — full bonus
  // at MATURITY_MAX, none on virgin ground. Independent of matYield
  // above: that term already reduces what mature ground YIELDS; this one
  // rewards a weapon for choosing to fight it anyway.
  const maturityMult = opts.maturityScaled ? 1 + opts.maturityScaled * (grid.maturity[i]! / MATURITY_MAX) : 1;
  const removeAmt = clamp(power * DAMAGE_COEFF * falloff * resistance * matYield * densityMult * saturationMult * maturityMult, 0, dens);
  if (removeAmt <= 0) return 0;
  const newDens = Math.max(0, dens - removeAmt);
  const removedHere = dens - newDens;
  grid.growth[i] = newDens;
  const nb = cellBucket(grid, i);
  if (nb !== grid.bucket[i]) {
    grid.bucket[i] = nb;
    state.dirty.add(i);
  }

  // "You scar what you clear" (Decision 25/63) — the only place maturity
  // is ever gained. Capped, never consumed by anything else.
  const newMaturity = Math.min(MATURITY_MAX, grid.maturity[i]! + removedHere * SCAR_PER_DENSITY);
  if (newMaturity !== grid.maturity[i]) {
    grid.maturity[i] = newMaturity;
    const nmb = maturityBucket(newMaturity, ageFloor);
    if (nmb !== grid.matBucket[i]) {
      grid.matBucket[i] = nmb;
      state.dirty.add(i);
    }
  }
  return removedHere;
}

// Phase 6C-1 (S3.3, Trap A): bounding box in grid cells for the annulus
// and capsule shapes — the disc branch keeps its own centered
// cx+/-radiusCells box untouched (S3.4/S3.5), so this is only ever called
// for the two new shapes.
function shapeBoundingBox(grid: Grid, x: number, y: number, shape: ClearShape, halfWidth: number): { minGx: number; maxGx: number; minGy: number; maxGy: number } {
  const { cx: cx0, cy: cy0 } = worldToCell(grid, x, y);
  if (shape.kind === 'annulus') {
    const outerCells = Math.ceil(shape.outer / grid.cellSize) + 1;
    return { minGx: cx0 - outerCells, maxGx: cx0 + outerCells, minGy: cy0 - outerCells, maxGy: cy0 + outerCells };
  }
  const { cx: cx1, cy: cy1 } = worldToCell(grid, shape.toX, shape.toY);
  const pad = Math.ceil(halfWidth / grid.cellSize) + 1;
  return {
    minGx: Math.min(cx0, cx1) - pad,
    maxGx: Math.max(cx0, cx1) + pad,
    minGy: Math.min(cy0, cy1) - pad,
    maxGy: Math.max(cy0, cy1) + pad,
  };
}

// Phase 6C-1 (S3.2): the cheap bounding-circle reject ahead of the real
// overlap computation, generalized the same way as the overlap itself
// below. For the annulus this is genuinely different math from the disc
// case, not just a passthrough — a coagulant sitting near the tower can
// be much closer than `hitRadius` (the band's half-width) and still be
// nowhere near the band, so the reject has to compare the coagulant's own
// radial distance against [inner, outer], not against hitRadius directly.
function shapeCheapReject(shape: ClearShape | undefined, x: number, y: number, hitRadius: number, c: Coagulant): boolean {
  if (!shape) return dist(x, y, c.x, c.y) > hitRadius + c.radius;
  if (shape.kind === 'annulus') {
    const r = dist(x, y, c.x, c.y);
    return r + c.radius < shape.inner || r - c.radius > shape.outer;
  }
  return distToSegment(c.x, c.y, x, y, shape.toX, shape.toY) > hitRadius + c.radius;
}

// Phase 6C-1 (S3.2): the shape-aware coagulant overlap, generalizing
// `coagulantOverlapArea` (a disc-vs-parts lens-area sum) to the other two
// shapes. `!shape` is a pure passthrough to the original call — the
// disc-path guarantee (S3.4/S3.5) extends to the coagulant loop too, just
// via an early return rather than a separate code block, since this side
// was already one function call rather than an inlined loop.
function shapeCoagulantOverlap(shape: ClearShape | undefined, x: number, y: number, halfWidth: number, c: Coagulant): number {
  if (!shape) return coagulantOverlapArea(c, x, y, halfWidth);
  if (shape.kind === 'annulus') {
    // area(annulus ∩ c) = area(discOuter ∩ c) - area(discInner ∩ c) —
    // exact for circular parts, since discInner ⊂ discOuter always holds.
    // Reuses the existing disc overlap function twice rather than adding
    // new lens-area geometry for a third shape.
    return coagulantOverlapArea(c, x, y, shape.outer) - coagulantOverlapArea(c, x, y, shape.inner);
  }
  // Capsule: approximated per-part by treating the capsule locally as a
  // disc centred at the closest point on the beam's segment to that
  // part — exact where the part sits well inside the beam's length, a
  // slight underestimate right at the beam's own end caps. Accepted as a
  // first-pass simplification in the same spirit as coagulantOverlapArea's
  // own documented one for overlapping Bulwark parts.
  if (c.parts.length === 0) {
    const p = closestPointOnSegment(c.x, c.y, x, y, shape.toX, shape.toY);
    return circleOverlapArea(p.x, p.y, halfWidth, c.x, c.y, c.radius);
  }
  let total = 0;
  for (const part of c.parts) {
    const partX = c.x + part.dx;
    const partY = c.y + part.dy;
    const p = closestPointOnSegment(partX, partY, x, y, shape.toX, shape.toY);
    total += circleOverlapArea(p.x, p.y, halfWidth, partX, partY, part.r);
  }
  return total;
}

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S3): `clearAt` used to
// return only a mass figure, so no caller could know WHICH coagulant a
// hit touched or killed — the stated blocker for Fork/Chaining/Bounce/
// Ricochet's literal on-kill readings ("splits into two on a kill,"
// Bounce's coagulant-to-coagulant hop). `removed` is the exact same
// number the old bare return was — every existing caller that only reads
// `.removed` sees byte-identical behaviour, proven by the full suite
// before anything downstream consumes `touched`/`killed` (S3's own
// non-negotiable constraint, the same one 6C-1's shape generalization
// held for the disc path).
export interface ClearResult {
  readonly removed: number;
  // Every coagulant this call actually dealt damage to (removeAmt > 0),
  // including overflow's own nearest-survivor hop — NOT filtered to
  // "still alive," so a caller can distinguish "touched and died" from
  // "touched and survived" via `killed` below rather than re-deriving it
  // from mass. Can contain the same coagulant twice, if it received both
  // a direct hit and overflow's extra hop in the same call — a caller
  // that needs a unique set should dedupe, most only need `touched[0]`
  // or a length check and don't care.
  readonly touched: readonly Coagulant[];
  // The subset of `touched` whose mass reached 0 as a direct result of
  // THIS call (not a coagulant that was already at 0 mass beforehand —
  // the main loop's own `if (c.mass <= 0) continue` guard already
  // excludes those from ever being touched in the first place).
  readonly killed: readonly Coagulant[];
}

const EMPTY_CLEAR_RESULT: ClearResult = { removed: 0, touched: [], killed: [] };

// The core damage-the-field function: density directly resists both the
// radius and magnitude of a hit — sparse tissue clears in one satisfying
// chunk, mature tissue only chips down a little per hit. Direct port of
// the prototype's clearAt().
export function clearAt(state: GameState, x: number, y: number, power: number, opts: ClearOptions = {}): ClearResult {
  const grid = state.grid;
  if (!grid) return EMPTY_CLEAR_RESULT;
  // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Opportunist's
  // shared record — a single mutation of the existing object, never a new
  // allocation (clearAt is the hottest function in the game, per the
  // plan's own risk S6). Written unconditionally, on every hit regardless
  // of which weapon or how much damage actually lands, since "wherever
  // damage last landed" is honestly about the hit's location, not a
  // confirmed kill.
  state.lastHitPoint.x = x;
  state.lastHitPoint.y = y;
  state.lastHitPoint.time = state.time;
  // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3): Desperation/
  // Proximity/Momentum — all three fold into `power` itself, once, here,
  // rather than as per-cell/per-coagulant terms: none of them varies
  // within a single hit (Desperation and Momentum read state that's fixed
  // for the whole call; Proximity reads this hit's own (x,y), not a
  // per-cell position).
  //
  // Desperation: reads CURRENT hp, not max — inert at full health.
  if (opts.desperationScaled) {
    const missingFrac = 1 - state.tower.hp / state.tower.maxHp;
    power *= 1 + opts.desperationScaled * missingFrac;
  }
  // Proximity: the closer this hit's own centre is to the tower relative
  // to the field's own maxRange, the bigger the bonus — clamped so a hit
  // literally on the tower doesn't exceed the gem's own intended cap.
  if (opts.proximityScaled) {
    const proximityFrac = clamp(1 - dist(x, y, state.tower.x, state.tower.y) / grid.maxRange, 0, 1);
    power *= 1 + opts.proximityScaled * proximityFrac;
  }
  // Momentum: `momentumMult` is already the fully-resolved multiplier
  // (systems/resolveOpts.ts builds it from `state.weaponStreak`, since
  // that's the one place that already knows both the weapon key and the
  // live socket state) — just applied here, same as the other two.
  if (opts.momentumMult) power *= opts.momentumMult;

  // Bucketing (not the yield formula below) needs the current age floor —
  // see tuning/maturity.ts's maturityBucket for why a fixed 0..1 split
  // can't stay legible as the floor itself rises over a run.
  const ageFloor = ageFloorAt(state.time);
  let totalRemoved = 0;
  // Tracked separately so only this portion carries the risk premium into
  // XP (Decision 31/61) — totalRemoved itself stays the honest physical
  // mass-removed figure the return value and the gem-drop threshold use.
  let coagulantRemoved = 0;
  // Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S3): populated by the
  // coagulant loop and the overflow block below, returned as ClearResult's
  // `touched`/`killed` — see that interface's own comment for exactly what
  // each contains.
  const touched: Coagulant[] = [];
  const killed: Coagulant[] = [];
  // Set by whichever branch below runs — the disc's own density-scaled
  // radius, or the new shape's literal half-width — and read afterward by
  // the (shared, shape-agnostic) coagulant loop's cheap reject.
  let hitRadius: number;

  const shape = opts.shape;
  if (!shape) {
    // ORIGINAL DISC PATH — byte-for-byte unchanged (S3.4/S3.5). Every
    // shipped weapon and ~589 tests depend on this being a re-arrangement,
    // never a re-derivation.
    const { cx, cy } = worldToCell(grid, x, y);
    const i0 = gIdx(grid, cx, cy);
    const baseDensity = grid.growth[i0] ?? 0;
    const radiusPx = (opts.radiusPx ?? 30) * clamp(1.25 - baseDensity, 0.4, 1.25);
    const radiusCells = Math.max(1, Math.round(radiusPx / grid.cellSize));
    hitRadius = radiusPx;

    for (let oy = -radiusCells; oy <= radiusCells; oy++) {
      const gy = cy + oy;
      if (gy < 0 || gy >= grid.rows) continue;
      for (let ox = -radiusCells; ox <= radiusCells; ox++) {
        const gx = cx + ox;
        if (gx < 0 || gx >= grid.cols) continue;
        const ddx = ox * grid.cellSize;
        const ddy = oy * grid.cellSize;
        const d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d > radiusPx) continue;
        const i = gy * grid.cols + gx;
        totalRemoved += applyCellDamage(grid, state, i, d, radiusPx, power, opts, ageFloor);
      }
    }
  } else {
    // Annulus (Shockwave) or capsule (6C-2's Lance) — a clean generalization
    // rather than a replica of the disc's cell-quantized distance math; see
    // S3.3 for the two traps (the bounding box, and the density sample
    // point this branch sidesteps entirely rather than fixing — S3's
    // header comment above `shape` explains why).
    const halfWidth = shape.kind === 'annulus' ? (shape.outer - shape.inner) / 2 : (opts.radiusPx ?? 20);
    hitRadius = halfWidth;
    const { minGx, maxGx, minGy, maxGy } = shapeBoundingBox(grid, x, y, shape, halfWidth);

    for (let gy = minGy; gy <= maxGy; gy++) {
      if (gy < 0 || gy >= grid.rows) continue;
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (gx < 0 || gx >= grid.cols) continue;
        const wx = gx * grid.cellSize + grid.cellSize / 2;
        const wy = gy * grid.cellSize + grid.cellSize / 2;
        const d = shape.kind === 'annulus' ? Math.abs(dist(wx, wy, x, y) - (shape.inner + shape.outer) / 2) : distToSegment(wx, wy, x, y, shape.toX, shape.toY);
        if (d > halfWidth) continue;
        const i = gy * grid.cols + gx;
        totalRemoved += applyCellDamage(grid, state, i, d, halfWidth, power, opts, ageFloor);
      }
    }
  }

  // Coagulants aren't in the grid (Decision 42's one hard constraint —
  // putting them there would let them scar terrain as they walk, now that
  // Phase 4A's maturity exists). So they get their own loop here rather than
  // falling out of the cell loop above: same falloff/resistance shape,
  // scaled by how much of the hit disc actually overlaps the blob
  // instead of by a flat per-weapon constant. A coagulant's local
  // "density" is fixed at 1 — it IS the densest slime in the game
  // (Decision 46) — so resistance is a constant, not sampled.
  //
  // Phase 4C-2 (Decision 69): `c.radius` is still the cheap bounding-circle
  // reject below, but the overlap area itself goes through
  // coagulantOverlapArea, which sums per-part overlap for a non-circular
  // body (Bulwark) instead of treating it as one big circle.
  const weaponMult = opts.coagulantMult ?? 1;
  // Phase 6A-2: Overflow's excess is summed across every coagulant this
  // call overkills, then applied once, after the loop, to the single
  // nearest survivor — never chained into a second overflow, which is
  // what makes it terminate by construction rather than by a visited set.
  let overflowExcess = 0;
  for (const c of state.coagulants) {
    if (c.mass <= 0) continue;
    if (shapeCheapReject(shape, x, y, hitRadius, c)) continue; // cheap reject before the trig
    const overlap = shapeCoagulantOverlap(shape, x, y, hitRadius, c);
    if (overlap <= 0) continue;
    const cellsEquivalent = overlap / (grid.cellSize * grid.cellSize);
    // Corrosive: armour is read net of any active debuff before this
    // hit's own effect is applied below — the floor (COAGULANT_ARMOR_FLOOR)
    // still applies on top, so armour becomes answerable, never irrelevant
    // (arsenal plan S12.3, the same rule that bounds Penetration).
    const debuffActive = c.armorDebuffUntil > state.time;
    let effectiveArmor = debuffActive ? c.armor * (1 - c.armorDebuff) : c.armor;
    // Piercing Core (Lance, Phase 6C-2 S6): ignores armour entirely, up to
    // a cap — reads the SAME effective-armour value as Corrosive/Bunker
    // Buster above, applied after Corrosive's own reduction, so all three
    // stack in the order they're written rather than three independent
    // passes over the raw value. Capped, not unlimited, so armour stays
    // answerable rather than irrelevant against an absurd target (arsenal
    // plan S12.3's rule, the same one that bounds Penetration).
    if (opts.armorIgnoreCap) effectiveArmor = Math.max(0, effectiveArmor - opts.armorIgnoreCap);
    // Bunker Buster: reads the same effective-armour value in the other
    // direction — more armour (even net of Corrosive's own reduction)
    // means more bonus damage. Corrosive reduces what Bunker Buster scales
    // on, so running both on one target is deliberately mediocre.
    const armorScaledMult = opts.armorScaled ? 1 + effectiveArmor * opts.armorScaled : 1;
    const effectivePower = Math.max(power - effectiveArmor, power * COAGULANT_ARMOR_FLOOR) * armorScaledMult;
    // Priming: a coagulant not hit in the last PRIMING_WINDOW seconds
    // takes the bonus on the hit that breaks the streak.
    const primed = opts.priming !== undefined && state.time - c.lastHitAt >= PRIMING_WINDOW;
    const primingMult = primed ? opts.priming! : 1;
    // Shatter Core: read BEFORE this hit's own `chill` write below — a hit
    // that applies chill must not benefit from it, or Frost would silently
    // double its own damage on every hit. `opts.shatter` is a BONUS
    // fraction (+30/45/60%, matching every other "+X%" value in the
    // codebase, e.g. the Amplifier gem's delta), not the multiplier
    // itself — using it directly as the multiplier would make Shatter
    // Core a damage REDUCTION instead of a bonus.
    const wasChilled = c.chilledUntil > state.time;
    const shatterMult = wasChilled && opts.shatter ? 1 + opts.shatter : 1;
    // Resonant Ring, coagulant reading: a coagulant's own "density" is
    // fixed at 1 (Decision 46 — it IS the densest slime in the game), so
    // this collapses to a flat `1 + densityScaled` bonus rather than a
    // per-cell sample.
    const densityMult = opts.densityScaled ? 1 + opts.densityScaled : 1;
    // Phase 6D-1: Threat Priority/Triage/Breach Priority/Fixation's aura
    // reading — only the one coagulant `systems/targetingGems.ts` picked
    // gets the bonus, everything else this hit's radius also overlaps is
    // unaffected. Reference equality, not a kind/mass comparison: the
    // selection already happened once, upstream, and re-deriving "which
    // one was picked" here from mass/distance would risk silently picking
    // a different coagulant than the one the gem's own description named.
    const focusMult = opts.focusTarget === c && opts.focusBonus ? 1 + opts.focusBonus : 1;
    // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3): Giant-
    // Slayer/Culling — mirrored scaling against mass, each clamped to
    // [0,1] so an absurdly large or small coagulant doesn't blow the
    // multiplier past its own intended bonus.
    const giantSlayerMult = opts.massScaledUp ? 1 + opts.massScaledUp * clamp(c.mass / MASS_BEHEMOTH, 0, 1) : 1;
    const cullingMult = opts.massScaledDown ? 1 + opts.massScaledDown * clamp(1 - c.mass / MASS_CONGEALER, 0, 1) : 1;
    const raw =
      effectivePower *
      DAMAGE_COEFF *
      cellsEquivalent *
      COAGULANT_RESISTANCE *
      weaponMult *
      COAGULANT_DAMAGE_SCALE *
      primingMult *
      shatterMult *
      densityMult *
      focusMult *
      giantSlayerMult *
      cullingMult;
    const removeAmt = clamp(raw, 0, c.mass);
    if (opts.chill) c.chilledUntil = Math.max(c.chilledUntil, state.time + opts.chill);
    if (opts.armorShred) {
      c.armorDebuff = Math.max(debuffActive ? c.armorDebuff : 0, opts.armorShred);
      c.armorDebuffUntil = state.time + ARMOR_SHRED_WINDOW;
    }
    if (removeAmt <= 0) continue;
    c.lastHitAt = state.time;
    c.mass -= removeAmt;
    totalRemoved += removeAmt;
    coagulantRemoved += removeAmt;
    touched.push(c);
    // Culling's finisher: a fraction of the coagulant's OWN starting
    // mass, not an absolute — checked after this hit's ordinary damage
    // has already landed, only on a hit that actually did something
    // (removeAmt > 0, already guaranteed by the guard above), so a graze
    // can't finish a behemoth outright.
    if (opts.cullingFinishFraction && c.mass > 0 && c.mass <= c.startMass * opts.cullingFinishFraction) {
      totalRemoved += c.mass;
      coagulantRemoved += c.mass;
      c.mass = 0;
    }
    if (opts.overflow && raw > removeAmt) overflowExcess += raw - removeAmt;
    if (opts.kickback && opts.kickback > 0) {
      const angle = Math.atan2(c.y - y, c.x - x);
      c.x = clamp(c.x + Math.cos(angle) * opts.kickback, c.radius, WORLD_WIDTH - c.radius);
      c.y = clamp(c.y + Math.sin(angle) * opts.kickback, c.radius, WORLD_HEIGHT - c.radius);
    }
    if (c.mass <= 0) {
      splatterOnDeath(state, c);
      killed.push(c);
    }
  }

  if (overflowExcess > 0) {
    let nearest: Coagulant | null = null;
    let nearestDist = Infinity;
    for (const c of state.coagulants) {
      if (c.mass <= 0) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }
    if (nearest) {
      const applied = clamp(overflowExcess, 0, nearest.mass);
      nearest.mass -= applied;
      totalRemoved += applied;
      coagulantRemoved += applied;
      nearest.lastHitAt = state.time;
      touched.push(nearest);
      if (nearest.mass <= 0) {
        splatterOnDeath(state, nearest);
        killed.push(nearest);
      }
    }
  }

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10a): the HUD's
  // overall-DPS readout. Mass destroyed, not damage requested — the gap
  // between the two (resistance, maturity, coagulant armor, all applied
  // above) is exactly what makes this readout worth having over a raw
  // damage-number sum. systems/dps.ts drains this once per frame.
  state.dpsAccum += totalRemoved;

  if (totalRemoved > GEM_DROP_THRESHOLD) {
    // Risk premium applies only to the coagulant share of what was
    // removed this hit — a horde kill pays a little more per unit mass
    // than the same mass cleared loose in the field (Decision 31/61).
    const xpBasis = totalRemoved + coagulantRemoved * COAGULANT_XP_RISK_PREMIUM;
    const xpVal = gemValueFromRemoved(xpBasis);
    if (xpVal >= 1) dropGemShower(state, x + rand(-10, 10), y + rand(-10, 10), xpVal);
    spawnParticles(state, x, y, '#ff5d8a', Math.min(10, Math.round(totalRemoved * 3)), 70);
  }

  // Momentum's streak update — the write side of the read at the top.
  // Ramps on a hit that actually removed mass; resets on a miss (nothing
  // removed) or a kill (the plan's own rule S1: it rewards sustained
  // pressure on a target, not finishing it off).
  //
  // Phase 6D-3: reads `killed.length` directly now instead of comparing
  // `state.lastCoagulantDeathAt` across the call — a strictly tighter
  // signal (this call's own kills, not "did any coagulant die anywhere
  // at this exact timestamp," which a same-tick sibling weapon could
  // have false-positived on).
  if (opts.momentumKey) {
    state.weaponStreak[opts.momentumKey] = totalRemoved > 0 && killed.length === 0 ? (state.weaponStreak[opts.momentumKey] ?? 0) + 1 : 0;
  }

  return { removed: totalRemoved, touched, killed };
}
