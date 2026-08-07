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

export function coagulantKindFromMass(mass: number): CoagulantKind {
  if (mass >= MASS_BEHEMOTH) return 'behemoth';
  if (mass >= MASS_CONGEALER) return 'congealer';
  return 'mote';
}

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
const COAGULANT_SPEED_K = 60;
const COAGULANT_SPEED_MIN = 4;
const COAGULANT_SPEED_MAX = 22.5;

export function coagulantSpeed(mass: number): number {
  return clamp(COAGULANT_SPEED_K / Math.sqrt(mass), COAGULANT_SPEED_MIN, COAGULANT_SPEED_MAX);
}

// --- the conservation rules (2026-08-05 session record §8) ------------

// Rule 3 — arrival delivers full remaining mass as tower damage and
// dumps that same mass back into the field (systems/coagulants.ts's
// depositMass, which grows the deposit area outward rather than
// clipping at the perimeter disc, so mass is never destroyed on
// arrival — only combat kills destroy mass).
export const COAGULANT_ARRIVAL_DAMAGE_MULT = 0.1;

// Rule 2 — killing is a sink; death yields XP (via the existing
// clearAt/gem pipeline, since coagulant damage flows through the same
// totalRemoved accumulator as grid clearing) plus only a small *fixed*
// splatter by size class, never a return of what it eats.
export const COAGULANT_SPLATTER: Record<CoagulantKind, number> = {
  mote: 5,
  congealer: 20,
  behemoth: 60,
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
