import { CORE_SOCKET_COUNT, type CoreGemKey } from './tuning/coreGems';
import { EVENT_INITIAL_DELAY } from './tuning/events';
import { xpToNext } from './tuning/xp';
import { WORLD_HEIGHT, WORLD_WIDTH } from './tuning/world';
import type { GemKey, PassiveKey, WeaponKey } from './types';

// Fully typed port of the prototype's freshState() object. Game state
// lives in this one central object (CLAUDE.md convention) — systems added
// in later phases fill in fields that are placeholders (null/[]) here,
// they don't change this shape.

export interface Tower {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  shake: number;
}

export interface Grid {
  cols: number;
  rows: number;
  size: number;
  cellSize: number;
  vein: Float32Array;
  threshold: Float32Array;
  growth: Float32Array;
  frozen: Float32Array;
  bucket: Int8Array;
  // Phase 4A (Decision 25): quality of ground, decoupled from `growth`'s
  // quantity — consumed by nobody, only accrued by clearing and slowly by
  // age. "The battlefield hardens, the wilderness stays soft." See
  // tuning/maturity.ts and systems/maturity.ts.
  maturity: Float32Array;
  // Quantized read of `maturity` (0..MATURITY_BUCKETS-1), gating the
  // dirty-set the same way `bucket` gates it for `growth` — maturity decays
  // every cell every tick, so marking dirty on every float change would
  // collapse the dirty-set optimization to the whole grid.
  matBucket: Int8Array;
  maxRange: number;
  perimeter: number;
}

export interface SlimeLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

interface ProjectileBase {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  radius: number;
  color: string;
  life: number;
  // Phase 6A-1: which weapon fired this, needed the moment a gem's effect
  // has to be read at impact time rather than at spawn time — Expansion's
  // area scaling on a projectile's impact radius (systems/projectiles.ts)
  // is the first caller. Pulled forward from 6A-2's plan (which needed it
  // for `resolveOpts` and the behaviour flags) since Expansion needed it
  // first; see docs/plans/phase-6a2-behaviour-gems.md S3.
  src: WeaponKey;
  // Phase 6A-1: Expansion's area scaling on a projectile's impact
  // radius — the projectile's own radius (above) is its *visual* size,
  // unrelated to how big a hit it lands. Defaults to 1 via `?? 1` at
  // every read site, so a projectile spawned before this field existed
  // (impossible in practice, but matches the pattern) degrades safely.
  impactAreaMult?: number;

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S3): projectile
  // behaviour flags — the entity carries its own behaviour, the same
  // pattern that already makes rendering entity-driven (arsenal plan
  // S9½). Chain's own hopsLeft/visited/legStart (below) is the template
  // this generalizes: `chains` is that same mechanic, promoted to a flag
  // any projectile can carry instead of Chain's private implementation.
  pierce?: number; // pass-throughs remaining before despawning on impact
  forks?: number; // splits into this many children on first impact (consumed then)
  chains?: number; // arcs to any nearby target (grid or coagulant) after resolving, decaying damage each hop
  bounces?: number; // like `chains`, but coagulant-only — Bounce's distinct reading from Chaining
  homing?: boolean; // steers toward its target point each tick
  ricochet?: boolean; // reverses once along its incoming path, damaging again
  // Runtime bookkeeping for chains/bounces (which target has this
  // projectile already visited, so a hop never lands on the same spot
  // twice) and the one-shot flags below. Optional because most
  // projectiles carry none of this — only ones with a Behaviour gem do.
  // Separate sets for `chains` and `bounces`, deliberately: they index
  // into different spaces (grid cell index vs. coagulant array index),
  // and a weapon can carry both gems at once (nothing stops it), so
  // sharing one set would let a grid-cell index and a coagulant index
  // collide as false "already visited" matches.
  visited?: Set<number>;
  bounceVisited?: Set<number>;
  forked?: boolean;
  ricocheted?: boolean;

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): RESOLVE
  // options baked in at spawn time (systems/resolveOpts.ts), read back by
  // systems/projectiles.ts when the impact actually resolves — the same
  // pattern `impactAreaMult` already established. Individual fields
  // rather than one nested ClearOptions, so this file doesn't need a
  // type-only import from grid/clear.ts (which already imports GameState
  // from here) for what both sides already agree are exactly grid/clear.ts's
  // ClearOptions field names.
  ignoreResistance?: boolean;
  flattenFalloff?: boolean;
  overflow?: boolean;
  kickback?: number;
  priming?: number;

  // Phase 6A-2: Homing's steering target for a non-missile projectile —
  // missile already has its own required `targetPoint` (below); this is
  // the same idea made optional for Bolt/Chain when the Homing gem is
  // socketed. Captured once at spawn (the point the weapon was aiming at
  // when it fired), not re-acquired mid-flight.
  homingTarget?: { x: number; y: number };
}

export interface BoltProjectile extends ProjectileBase {
  type: 'bolt';
}

export interface ChainProjectile extends ProjectileBase {
  type: 'chain';
  hopsLeft: number;
  visited: Set<number>;
  legStart: { x: number; y: number };
}

export interface MissileProjectile extends ProjectileBase {
  type: 'missile';
  speed: number;
  splashRadius: number;
  targetPoint: { x: number; y: number };
}

export type Projectile = BoltProjectile | ChainProjectile | MissileProjectile;

// Phase 5B-6 (docs/plans/phase-5b-framework.md S6a): appearance data
// lives on the entity, matching the pattern render/projectiles.ts and
// render/clouds.ts already use — a weapon whose effect orbits (Blades
// today, Orbital Conversion's target in Phase 6) draws itself without
// render/orbitals.ts needing to know which weapon it is. `shape` is
// deliberately a closed union rather than a free-form string: adding a
// shape is a one-line type change plus one new case in drawOrbitals,
// not a silent no-op if a caller typos a string.
export type OrbitalShape = 'shuriken' | 'dot';

export interface OrbitalVisual {
  x: number;
  y: number;
  radius: number;
  shape: OrbitalShape;
  color: string;
  glowColor: string;
}

export interface ChainFx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  life: number;
  maxLife: number;
}

export interface BubbleSeed {
  a: number;
  r: number;
  speed: number;
  phase: number;
}

export interface CausticCloud {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  dmgPerSec: number;
  color: string;
  tickTimer: number;
  // Generated once at cloud creation (weapons/poison.ts), not lazily
  // inside the draw call — the prototype's `if (!c.bubbleSeeds)` in its
  // render function mutated state during a draw call, the same
  // anti-pattern novaFx's frame-rate-dependent decay was (Confirmed
  // docs/DECISIONS.md #4). Required, not optional, since it's
  // always populated up front.
  bubbleSeeds: BubbleSeed[];

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): the Homing
  // gem's cloud reading — "drifts toward the nearest mass instead of
  // sitting still," applied per-tick in systems/clouds.ts rather than
  // once at spawn, since a cloud lives for several seconds and the
  // nearest mass can change during that time. RESOLVE options mirror
  // ProjectileBase's individual-field pattern for the same reason (no
  // type-only import cycle with grid/clear.ts).
  homing?: boolean;
  ignoreResistance?: boolean;
  flattenFalloff?: boolean;
  overflow?: boolean;
  kickback?: number;
  priming?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Gem {
  x: number;
  y: number;
  xp: number;
  radius: number;
  // Per-gem drift speed multiplier, sampled once at drop time. Defaults to
  // 1 (dropGem) so ordinary single-gem drops are unaffected; a shower
  // (systems/gems.ts's dropGemShower) randomizes it so gems spawned at the
  // same point and moment separate over their flight instead of arriving
  // at the core in one simultaneous clump — see Decision 61.
  driftJitter: number;
}

// Phase 5B-6: carries its own colour now (was a hardcoded constant in
// render/novaFx.ts) and state.novaFx becomes a list rather than a single
// nullable slot — see the GameState field below for why the single slot
// was a latent overwrite bug (docs/DECISIONS.md #4/#7's class, applied to
// two pulse weapons firing in the same frame instead of a lazy draw-call
// mutation).
export interface NovaFx {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface VeinSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// A short offshoot forking from the trunk at `parentIndex` (an index into
// the parent vein's `trunk` array). Kept separate from the trunk rather
// than merged into one flat list so growth injection and rendering can
// gate a branch's reveal on the trunk having grown as far as its fork
// point — see systems/events.ts's veinRevealCount().
export interface VeinBranch {
  parentIndex: number;
  segments: VeinSegment[];
}

// Infection Events replace growth nodes (Phase 3B, Decision 29) — one
// system, two variants, sharing a lifecycle: telegraph -> active -> peak
// -> decay -> removed. See docs/DECISIONS.md #29 and
// docs/sessions/2026-08-05-slime-and-arsenal-rework.md §11.
export type InfectionEventPhase = 'telegraph' | 'active' | 'peak' | 'decay';

interface InfectionEventBase {
  phase: InfectionEventPhase;
  phaseTimer: number;
  age: number;
  // Countdown to the next coagulant-formation attempt — only meaningful
  // during the peak phase (Decision 43/50: events are sparks, coagulants
  // are Phase 3C). Set to Infinity outside peak so it never fires early.
  formationTimer: number;
}

export interface VeinInfectionEvent extends InfectionEventBase {
  kind: 'vein';
  // Generated once at telegraph time (systems/veinPath.ts), never lazily
  // inside a draw call or growth-injection call — the bubbleSeeds/novaFx
  // bug class (docs/DECISIONS.md #4, #7).
  trunk: VeinSegment[];
  branches: VeinBranch[];
}

export interface BloomInfectionEvent extends InfectionEventBase {
  kind: 'bloom';
  x: number;
  y: number;
  radius: number;
}

export type InfectionEvent = VeinInfectionEvent | BloomInfectionEvent;

// Coagulants: Phase 3C, Decision 42. No HP — `mass` IS the hit points,
// the arrival damage, and the XP value, all at once. See
// docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md §7.
// 'sclerotic' and 'blastoma' added in Phase 4C-1 (Decision 68) — identity
// derived from maturity and mass-shape, not a spawn table (§10, Rule 4).
// 'carrier' and 'bulwark' added in Phase 4C-2 (Decision 69) — corridor
// density and (maturity, mass) respectively.
export type CoagulantKind = 'mote' | 'congealer' | 'behemoth' | 'sclerotic' | 'blastoma' | 'carrier' | 'bulwark';

// Phase 4C-2 (Decision 69): a body part, offset from the coagulant's
// centre. Absent/empty `parts` means "a single circle of radius `radius`
// at the centre" — every Wave 1 kind and 4C-1's Sclerotic/Blastoma, none
// of which need this. Bulwark is the first body that isn't a single
// circle ("wide and flat rather than round," §10), modelled as a cluster
// of circles rather than true ellipse geometry so every existing piece of
// circle math (circleOverlapArea, distance checks) keeps working
// unmodified — see docs/plans/phase-4c2-carrier-bulwark.md §2.
export interface CoagulantPart {
  dx: number;
  dy: number;
  r: number;
}

export interface CoagulantSeed {
  a: number;
  r: number;
  speed: number;
  phase: number;
}

// 'forming': visible (rising, growing toward full size) but not yet
// moving, targetable, or damageable — it hasn't detached from the field.
// 'active': live — moves toward the core, can be hit, can arrive.
// Added after the Phase 3C playtest gate (2026-08-06) found formation was
// instant: a full-mass, full-speed, already-lethal coagulant appearing
// with zero warning. Same naming as InfectionEvent's phase/phaseTimer,
// not to be confused with CoagulantSeed's unrelated `phase` (a wobble
// angle, not a lifecycle stage).
export type CoagulantPhase = 'forming' | 'active';

// Phase 5B (docs/plans/phase-5b-framework.md S2, S4): a picked-up but
// unsocketed gem, or one currently sitting in a weapon's socket. `id` is
// unique per pickup (not per kind) because the same gem kind may be
// socketed into several different weapons at once (arsenal plan S5's
// duplicate rule) — two instances of 'amplifier' are two separate
// objects, not a stacked count.
export interface GemInstance {
  id: number;
  // Phase 6A-1: narrowed from a placeholder `string` to the real GemKey
  // union now that Phase 6A populates one (arsenal plan S1).
  kind: GemKey;
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): an extension
// instance, identical in shape whether it's sitting in
// GameState.extensionInventory or inside a weapon's own
// WeaponSockets.extensions — moving one between the two is a literal
// array move, not a reshape. `weaponKey` is redundant while socketed
// (implied by which weapon's sockets it's in) but is what makes it bound
// to that weapon while banked (call 6, docs/plans/phase-6a3-loop-fixes.md
// S1) — an extension never fits any weapon but the one it was rolled for.
// `level` tracks progress toward removal at 3 (the owner's rule: maxed
// extensions leave the card pool permanently, no repeat offer) — and,
// per S3a, a re-roll of an already-owned extension levels THIS instance
// in place, wherever it currently lives, rather than creating a second
// one. Only PLACEHOLDER_EXTENSION_KIND exists until Phase 6B.
export interface ExtensionInstance {
  id: number;
  weaponKey: WeaponKey;
  kind: string;
  level: 1 | 2 | 3;
}

// Extensions and gems share one socket pool per weapon (arsenal plan S5:
// "specialise this weapon, or generalise it?" is meant to be a live
// question every time a socket opens) — occupiedSlots() in
// systems/sockets.ts is what enforces the combined count against
// socketCount(pointsInvested).
export interface WeaponSockets {
  extensions: ExtensionInstance[];
  gems: GemInstance[];
}

// Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): a banked-but-
// unsocketed core gem — the core-gem mirror of GemInstance. Unlike
// weapon gems, a core gem is never legal to hold twice at once (only 3
// fixed core sockets exist and the design has never allowed duplicates
// there — see GameState.coreGems below), so `id` exists for UI
// click-identification symmetry with GemInstance/ExtensionInstance
// rather than because two instances of the same kind can coexist.
export interface CoreGemInstance {
  id: number;
  kind: CoreGemKey;
}

export interface Coagulant {
  x: number;
  y: number;
  mass: number;
  // Ships at ~0 for every Wave 1 kind (Decision 44) — Phase 4C-1 (Decision
  // 68) is what finally derives a nonzero value, from source maturity.
  armor: number;
  kind: CoagulantKind;
  radius: number;
  speed: number;
  phase: CoagulantPhase;
  phaseTimer: number;
  // Generated once at formation (systems/formation.ts), never lazily
  // inside a draw call — the bubbleSeeds/novaFx bug class again
  // (docs/DECISIONS.md #4, #7).
  seeds: CoagulantSeed[];
  // Blastoma-only (Phase 4C-1, Decision 68): fractures into two fragments
  // once mass drops to this value. 0 means "never splits" — the default
  // for every other kind, and for a fragment itself, so nothing re-splits.
  // Checked in the update pass, not in clearAt, for the same reason
  // Decisions 4/7 exist: pushing new entities onto state.coagulants while
  // clearAt is mid-iteration over that same array is the mutate-during-
  // iteration hazard, not a draw call, but the same class of bug.
  splitAtMass: number;
  // The mean maturity of the ground this coagulant formed from — drives
  // both armor (coagulantArmor()) and its render colour (Decision 68),
  // sourced from the same two-axis palette terrain uses (Phase 4B).
  sourceMaturity: number;
  // Phase 4C-2 (Decision 69): non-circular bodies. `radius` remains the
  // bounding circle for cheap broad-phase rejection everywhere it's
  // already used; when `parts` is present, damage/collision/targeting
  // narrow-phase against the actual parts instead. Empty/absent for every
  // kind except Bulwark — see systems/coagulants.ts's coagulantSurfaceDist
  // and coagulantOverlapArea.
  parts: CoagulantPart[];
  // Phase 4C-2 (Decision 69): Carrier-only — the mass it formed with,
  // needed as a stable reference point for capping how much it can grow
  // by feeding off the field it crosses (systems/coagulants.ts's
  // feedCarrier). Equal to `mass` at formation for every kind; harmless
  // and unused for anything that doesn't feed.
  startMass: number;
  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S2): last state.time
  // this coagulant took damage — Priming's "not hit recently" read.
  // -Infinity at creation so the very first hit always counts as fresh.
  // Written unconditionally in grid/clear.ts on every hit (cheap, one
  // field), read only by weapons carrying the Priming gem.
  lastHitAt: number;
}

export interface GameState {
  running: boolean;
  paused: boolean;
  time: number;
  nodesPurged: number;
  tierIndex: number;

  tower: Tower;
  // Enhancement points invested per weapon (arsenal plan S6: one +/-
  // per weapon, no cap, no diminishing returns — Decision 40 unchanged).
  // A present key means equipped; value is points spent, which drives
  // both damage/cooldown formulas directly and socketCount() (S2).
  weapons: Partial<Record<WeaponKey, number>>;
  passives: Partial<Record<PassiveKey, number>>;
  // Points banked from level-ups, not yet spent (docs/plans/phase-5b-framework.md
  // S3) — 5C's +/- control spends these; 5B banks-and-shows rather than
  // auto-spending, a deliberately legible placeholder rather than a fake
  // version of the real feature.
  enhancementPool: number;
  // Starting 3 (arsenal plan S5); Phase 7 raises it via meta currency.
  weaponSlots: number;
  // Fixed-length CORE_SOCKET_COUNT array; null means empty. Duplicates
  // disallowed (an implementation-time call, S1/S4 of the 5B plan didn't
  // specify — "5 types competing for 3 slots" reads more sensibly than
  // "which type to stack" for a first cut). A core gem's *effect*
  // (systems/passives.ts's applyCoreGemEffect/removeCoreGemEffect) is
  // applied only while its kind sits in this array — see
  // coreGemInventory below for where an unsocketed one lives instead.
  coreGems: (CoreGemKey | null)[];
  // Unsocketed gems the player owns — populated starting Phase 6A, when
  // any gem kind actually exists to pick up.
  gemInventory: GemInstance[];
  // Phase 6A-3 (docs/plans/phase-6a3-loop-fixes.md S4): the owner's
  // three-section inventory made every socketable thing bankable, not
  // just weapon gems — a picked extension or core gem now grants an
  // instance here instead of applying/socketing itself immediately. A
  // core gem's effect is applied only once it moves out of here and into
  // `coreGems` (systems/gemSockets.ts's socketCoreGem/unsocketCoreGem).
  extensionInventory: ExtensionInstance[];
  coreGemInventory: CoreGemInstance[];
  weaponSockets: Partial<Record<WeaponKey, WeaponSockets>>;
  // Monotonic counter shared across every instance kind this state ever
  // creates — GemInstance, ExtensionInstance and CoreGemInstance alike.
  // One counter rather than one per kind: ids only ever need to be
  // unique within their own array, and a shared source is simpler than
  // three separate ones for no behavioural gain.
  nextGemId: number;

  grid: Grid | null;
  slimeLayer: SlimeLayer | null;
  dirty: Set<number>;

  projectiles: Projectile[];
  orbitals: OrbitalVisual[];
  chainFx: ChainFx[];
  clouds: CausticCloud[];
  particles: Particle[];
  gems: Gem[];
  // Phase 5B-6: list, not a single nullable slot — two pulse weapons
  // (Frost Nova, Immolation Ring once it has a visual) firing in the same
  // frame previously overwrote each other.
  novaFx: NovaFx[];

  frontier: Float32Array | null;

  events: InfectionEvent[];
  eventSpawnTimer: number;
  coagulants: Coagulant[];

  weaponTimers: Record<WeaponKey, number>;
  bladeNextHit: Record<number, number>;
  simAcc: number;
  announceTimer: number;
  contactPressure: number;

  // Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S10a): the HUD's
  // overall-DPS readout, replacing the deleted global DMG/SPD passives
  // readout. `dpsAccum` is mass destroyed since the last frame — every
  // `clearAt` call adds to it (grid/clear.ts), and systems/dps.ts drains
  // it once per frame in the update pass (never a draw call, per
  // Decisions 4/7) into `dps`, an exponentially-smoothed rate so the
  // number reads as a live readout rather than jumping per hit.
  dpsAccum: number;
  dps: number;

  // Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S4): Echo/Barrage's
  // deferred emissions — a weapon firing again later than the tick that
  // decided to fire. Drained each simulation frame by
  // systems/emissions.ts, never inside a draw call. The same weapon
  // registry this rides on (weapons/registry.ts's WEAPON_PIPELINES) is
  // what Trigger (Phase 6I) needs to fire a different weapon by key, so
  // this queue is also that mechanic's first real caller.
  pendingEmissions: {
    weapon: WeaponKey;
    at: number;
    lvl: number;
    target: { x: number; y: number; dist: number } | null;
    powerMult: number;
  }[];

  // Counts level-ups an XP grant produced that the upgrade-card UI hasn't
  // shown a card for yet, consumed one at a time — see systems/xp.ts and
  // docs/BACKLOG.md "A single XP grant crossing two levels".
  pendingLevelUps: number;
  // Queued rather than a single slot — multiple events can land in the
  // same sim tick, and each deserves its own full announceTimer display
  // instead of the second silently overwriting the first (same overwrite
  // bug class as pendingLevelUps above).
  pendingAnnouncements: string[];
}

export function freshState(): GameState {
  return {
    running: false,
    paused: false,
    time: 0,
    nodesPurged: 0,
    tierIndex: 0,

    tower: {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      radius: 22,
      hp: 100,
      maxHp: 100,
      level: 1,
      xp: 0,
      // Level 1 uses the curve like every other level (Decision 61) — no
      // fast-first-level special case. The prototype hardcoded 10 here and
      // only switched to the formula on subsequent level-ups; that parity
      // shim is gone now that the curve itself is the thing being tuned.
      xpToNext: xpToNext(1),
      shake: 0,
    },

    weapons: {},
    passives: {},
    enhancementPool: 0,
    weaponSlots: 3,
    coreGems: new Array(CORE_SOCKET_COUNT).fill(null),
    gemInventory: [],
    extensionInventory: [],
    coreGemInventory: [],
    weaponSockets: {},
    nextGemId: 1,

    grid: null,
    slimeLayer: null,
    dirty: new Set(),

    projectiles: [],
    orbitals: [],
    chainFx: [],
    clouds: [],
    particles: [],
    gems: [],
    novaFx: [],

    frontier: null,

    events: [],
    // A little breathing room before the first event, matching the
    // node system's old start-of-run grace period.
    eventSpawnTimer: EVENT_INITIAL_DELAY,
    coagulants: [],

    weaponTimers: { bolt: 0, blades: 0, chain: 0, frost: 0, poison: 0, missile: 0, immolation: 0 },
    bladeNextHit: {},
    simAcc: 0,
    announceTimer: 0,
    contactPressure: 0,
    dpsAccum: 0,
    dps: 0,

    pendingEmissions: [],
    pendingLevelUps: 0,
    pendingAnnouncements: [],
  };
}
