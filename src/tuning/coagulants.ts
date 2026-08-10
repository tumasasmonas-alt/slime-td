import { clamp } from '../util/math';
import type { CoagulantKind } from '../state';

// Coagulants: Phase 3C, Wave 1 (Mote/Congealer/Behemoth — pure density
// readings, no maturity needed; see docs/DECISIONS.md #36). Numbers here
// are first-pass, not balanced — this whole phase ends in a playtest
// gate specifically to correct them. The agreed dials if the economy
// misbehaves in play are arrival speed and arrival mass (Decision 27).

// --- formation ------------------------------------------------------------
// Bounded flood-fill (Decision 43): a spark drains contiguous *revealed*
// mass out to a hard radius cap, so "contiguous mass" means "mass inside
// a formation footprint," not "the entire saturated wilderness."
export const FORMATION_RADIUS_CAP = 180; // px
export const FORMATION_CELL_CAP = 700; // safety valve alongside the radius cap

// Below this, nothing forms at all — the floor that makes a clean field
// genuinely protective, not just cosmetic.
export const MASS_MIN_FORMATION = 10;
// At/above these, size crosses into the next kind (Rule 4: size is
// emergent from available mass, never a spawn table).
export const MASS_CONGEALER = 25;
export const MASS_BEHEMOTH = 150;

// A spark landing closer than perimeter + this can't form at all — a
// backstop, not the primary mechanism (that's the vein stopping short of
// the perimeter, tuning/events.ts's VEIN_STOP_MARGIN, and blooms already
// landing no closer than perimeter+70 by construction). Found live during
// the Phase 3C playtest gate (2026-08-06): a coagulant sparking with
// almost no runway to the core is a distinct failure from the mass being
// too large, and deserves its own guard rather than relying on upstream
// placement never producing a close point.
export const FORMATION_MIN_DISTANCE = 30;

// How long a coagulant sits in its 'forming' phase — visible, growing,
// but not yet moving, targetable, or damageable — before it detaches and
// goes live. Formation used to be instant: a full-mass, full-speed,
// already-lethal coagulant would appear with zero warning, which is what
// actually produced "a behemoth spawned and insta-exploded on me" in the
// 2026-08-06 playtest, not (only) a speed or distance problem.
export const FORMATION_RISE_DURATION = 1.8;

function massTier(mass: number): CoagulantKind {
  if (mass >= MASS_BEHEMOTH) return 'behemoth';
  if (mass >= MASS_CONGEALER) return 'congealer';
  return 'mote';
}

// Wave 1's mass-only identity — kept as its own function (rather than
// folded into coagulantKindFrom below) because it's still exactly right
// for a fragment's kind: a Blastoma splitting into two pieces derives each
// fragment's identity from its own (smaller) mass, per Rule 4, not from
// the maturity/shape that made the parent a Blastoma in the first place.
export function coagulantKindFromMass(mass: number): CoagulantKind {
  return massTier(mass);
}

// Above this, a formation site counts as "scarred" for identity purposes —
// meaningfully above AGE_CEILING (0.33, tuning/maturity.ts), so ambient
// global age alone can never trigger a Sclerotic; it has to be ground the
// player actually fought over.
//
// Retuned down from 0.55 after a debug-harness verification (Decision 59's
// methodology) found it was never reached in practice. A single grid cell
// can scar up to ~0.97 under sustained combat, but formation reads *mean*
// maturity over the whole flood-filled footprint, and that mean dilutes
// hard toward the surrounding region's average — the highest mean any
// coagulant actually sparked at across a 500s max-weapons run was ~0.46,
// well short of 0.55. 0.4 sits with real headroom above both AGE_CEILING
// (so it still can't trigger from passive aging alone) and below what was
// empirically observed as reachable.
export const MATURITY_SCLEROTIC_THRESHOLD = 0.4;

// Below this, a flood-filled region counts as "fragmented" rather than
// solid — see systems/formation.ts's floodFillMass for how it's measured
// (cells actually reached vs. the disc the flood-fill's own reach spans).
// A solid saturated patch fills its disc almost completely; a vein-webbed
// lattice reaches far through thin corridors while visiting few cells.
// First-pass, not measured against a real webbed vein yet — see
// docs/plans/phase-4c1-wave2-armour.md's risks.
export const FRAGMENTATION_THRESHOLD = 0.5;

// Phase 4C-2 (Decision 69): the mass bar that splits §10's high-mass +
// scarred table cell away from plain Sclerotic — reuses MASS_BEHEMOTH
// rather than a new number, since "high mass" already means the same
// thing everywhere else in the roster.
export const MASS_BULWARK = MASS_BEHEMOTH;

// Phase 4C-2 (Decision 69): mean revealed density along the straight line
// from a spark point to the core, above which the corridor counts as
// "thick enough to feed a Carrier" — §10's fourth identity reading,
// gating on player performance alone: a clean near field leaves no
// corridor, so a Carrier cannot form regardless of mass or maturity
// elsewhere. See systems/formation.ts's sampleCorridorDensity.
export const CORRIDOR_DENSITY_THRESHOLD = 0.5;

// Phase 4C-1 (Decision 68) + 4C-2 (Decision 69): identity is a function of
// mass, maturity, mass *shape*, and corridor density — all four of §10's
// field readings. Checked in this order deliberately:
//
// 1. High maturity always wins over everything else, since "my own kill
//    zone got up and walked at me" (§10) should hold regardless of mass or
//    corridor — split further into Bulwark (high mass) vs. plain Sclerotic
//    by MASS_BULWARK, the cell §10's table reserves for Bulwark.
// 2. A thick corridor makes a Carrier, checked before mass-shape, since a
//    Carrier is defined by the terrain *between* it and the core, not by
//    what it looks like at the spark point itself.
// 3. Fragmented shape at sufficient mass makes a Blastoma.
// 4. Otherwise, the ordinary Wave 1 mass tiers.
export function coagulantKindFrom(
  mass: number,
  maturity: number,
  fillRatio: number,
  corridorDensity: number,
): CoagulantKind {
  if (maturity >= MATURITY_SCLEROTIC_THRESHOLD) {
    return mass >= MASS_BULWARK ? 'bulwark' : 'sclerotic';
  }
  if (corridorDensity >= CORRIDOR_DENSITY_THRESHOLD) return 'carrier';
  if (mass >= MASS_CONGEALER && fillRatio < FRAGMENTATION_THRESHOLD) return 'blastoma';
  return massTier(mass);
}

// Armor is a function of source maturity, never a per-kind table (Rule 4)
// — a Sclerotic is armoured *because* it formed from hardened ground, so
// this needs no separate balancing pass as new kinds are added. Decision
// 44's consumption path (grid/clear.ts) has been live since 3C at
// armor: 0 for every Wave 1 kind; this is what finally feeds it.
// Deliberately gentle (max ~20 flat reduction) — the project owner's
// tuning posture for this phase: penetration, the designed counter, is
// Phase 5, so armor lands alongside a +50% weapon damage pass
// (WEAPON_DAMAGE_SCALE, tuning/weapons.ts) rather than at full strength.
export const ARMOR_AT_FULL_MATURITY = 20;

export function coagulantArmor(maturity: number): number {
  return clamp(maturity, 0, 1) * ARMOR_AT_FULL_MATURITY;
}

// Blastoma fractures once its mass drops to this fraction of its starting
// mass (Decision 68) — the project owner's call: splits at 50%, into two
// fragments sharing the remaining mass, rather than at death. Splitting on
// death was rejected as impossible: by then mass is 0, so there is nothing
// left to give the children, and inventing some would break Rule 2
// (killing is a sink — damage dealt is mass permanently destroyed).
// Fracturing at a threshold conserves exactly instead.
export const BLASTOMA_SPLIT_FRACTION = 0.5;

// Radius from mass: r = k * sqrt(mass), so area is proportional to mass
// — a behemoth is big *because* it is big, not because of a separate
// size stat (Decision 42).
export const COAGULANT_RADIUS_K = 2.6;

export function coagulantRadius(mass: number): number {
  return COAGULANT_RADIUS_K * Math.sqrt(mass);
}

// --- movement ---------------------------------------------------------
// Straight line to the core (Decision 42). A continuous function of mass
// rather than three discrete per-kind speeds — "big mass, slow movement"
// should hold *within* a kind too, not just across kind boundaries — and
// roughly 40-50% slower across the board than the original per-kind
// figures (mote 70 / congealer 45 / behemoth 25), per the Phase 3C
// playtest gate (2026-08-06). r = k*sqrt(mass) already governs radius, so
// an inverse-sqrt shape here means speed and size grow from the same
// underlying quantity rather than two independently-tuned curves.
// Halved again the same day, same playtest round as AMBIENT_BASE/
// CREEP_RAMP: coagulant travel still read as too fast on its own. The
// K/MIN/MAX trio is scaled uniformly, so the inverse-sqrt *shape* (the
// mass-to-speed curve, "big mass, slow movement") is unchanged — only
// the absolute speeds it produces are smaller.
//
// 2026-08-10: raised ~30% across the board — the owner's call, "increase
// slime arriving speed" as part of a broader difficulty pass. Same
// uniform-scaling rule as the cut above, applied in the other direction.
const COAGULANT_SPEED_K = 78;
const COAGULANT_SPEED_MIN = 5;
const COAGULANT_SPEED_MAX = 29;

export function coagulantSpeed(mass: number): number {
  return clamp(COAGULANT_SPEED_K / Math.sqrt(mass), COAGULANT_SPEED_MIN, COAGULANT_SPEED_MAX);
}

// --- the conservation rules (2026-08-05 session record §8) ------------

// Rule 3 — arrival delivers full remaining mass as tower damage and
// dumps that same mass back into the field (systems/coagulants.ts's
// depositMass, which grows the deposit area outward rather than
// clipping at the perimeter disc, so mass is never destroyed on
// arrival — only combat kills destroy mass).
//
// 2026-08-10: raised from 0.1, same difficulty pass as the speed bump
// above — a faster-arriving coagulant should also hurt more when it
// gets there, not just get there sooner.
export const COAGULANT_ARRIVAL_DAMAGE_MULT = 0.14;

// Rule 2 — killing is a sink; death yields XP (via the existing
// clearAt/gem pipeline, since coagulant damage flows through the same
// totalRemoved accumulator as grid clearing) plus only a small *fixed*
// splatter by size class, never a return of what it eats.
export const COAGULANT_SPLATTER: Record<CoagulantKind, number> = {
  mote: 5,
  congealer: 20,
  behemoth: 60,
  // Sclerotic can form at any mass tier (§10's table has it at low, mid,
  // and — before Bulwark exists — high mass), so its splatter sits with
  // congealer's rather than scaling to its (variable) size.
  sclerotic: 25,
  // Blastoma requires mass >= MASS_CONGEALER by construction, trending
  // toward the higher end of the range it can appear in.
  blastoma: 35,
  // Carrier arrives having fed off the field (below), so it's typically
  // larger than its formation mass alone would suggest — splatter sits
  // above congealer to reflect that without needing to scale to its
  // (variable, capped) final size.
  carrier: 30,
  // Bulwark requires MASS_BULWARK (high mass) by construction — the
  // largest fixed splatter in the roster.
  bulwark: 60,
};

// --- damage against coagulants (grid/clear.ts) -------------------------
// Coagulants are dense slime that walks (2026-08-06 session record §7):
// clearAt's own resistance formula already makes dense tissue ~10x
// tankier, so a coagulant's local "density" is fixed at 1 — always
// near-max resistance — rather than tracked as its own stat.
export const COAGULANT_RESISTANCE = 0.3; // clamp(1.3 - 1, 0.12, 1.3)

// Flat armor reduction with a floor (Decision 44) — makes many small
// hits worthless and leaves big hits nearly intact, rather than scaling
// every build down equally.
export const COAGULANT_ARMOR_FLOOR = 0.15;

// The master damage dial — the "support gem" hook the project owner
// asked to keep open (2026-08-06 follow-up). Per-weapon multipliers
// live alongside each weapon's other data in tuning/weapons.ts.
export const COAGULANT_DAMAGE_SCALE = 1.0;

// --- Carrier feeding (Phase 4C-2, Decision 69) --------------------------
// Decision 42's hook, left in place since Wave 1 for exactly this: "a seam
// where the Wave 2 Carrier can feed off the field it crosses." Consumes
// grid growth in a small radius around itself each tick and adds it to its
// own mass, leaving a visibly thinned trail — §10's "worm track," which
// doubles as its own tell.
export const CARRIER_FEED_RADIUS = 26; // px
export const CARRIER_FEED_RATE = 4; // mass/sec, capacity-limited by what the field actually holds

// Mass drives both radius and arrival damage, so an uncapped Carrier
// crossing a saturated field would compound badly. Capped relative to its
// own starting mass, not an absolute number, so the cap scales with
// however large the corridor that spawned it already was.
export const CARRIER_MASS_CAP_MULT = 2.5;

// --- Bulwark's body (Phase 4C-2, Decision 69) ---------------------------
// "Wide and flat rather than round" (§10) — modelled as a line of
// overlapping circles perpendicular to its direction of travel, rather
// than true ellipse geometry, so every existing piece of circle math
// keeps working unmodified (docs/plans/phase-4c2-carrier-bulwark.md §2).
// Typed as `number`, not inferred as the literal 4 — systems/formation.ts's
// buildBulwarkParts guards a count-of-1 edge case that would otherwise be
// flagged as unreachable dead code against the current value.
export const BULWARK_PART_COUNT: number = 4;
// Each part's radius, as a fraction of the mass-derived "equivalent
// single-blob" radius (coagulantRadius(mass)).
export const BULWARK_PART_RADIUS_FRACTION = 0.55;
// Total span the line of parts covers, as a multiple of that same
// equivalent radius — parts overlap along the line (span/(count-1) is
// less than 2x a part's own radius) so the wall reads as one continuous
// body, not a row of separate blobs.
export const BULWARK_SPAN_FRACTION = 1.7;
