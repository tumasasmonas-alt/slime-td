import { EVENT_INITIAL_DELAY } from './tuning/events';
import { xpToNext } from './tuning/xp';
import { WORLD_HEIGHT, WORLD_WIDTH } from './tuning/world';
import type { PassiveKey, WeaponKey } from './types';

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

export interface OrbitalVisual {
  x: number;
  y: number;
  radius: number;
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

export interface NovaFx {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
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
export type CoagulantKind = 'mote' | 'congealer' | 'behemoth';

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

export interface Coagulant {
  x: number;
  y: number;
  mass: number;
  // Ships at ~0 for every Wave 1 kind — maturity, which picks a nonzero
  // value, doesn't exist until Phase 4A (Decision 44).
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
}

export interface GameState {
  running: boolean;
  paused: boolean;
  time: number;
  nodesPurged: number;
  tierIndex: number;

  tower: Tower;
  weapons: Partial<Record<WeaponKey, number>>;
  passives: Partial<Record<PassiveKey, number>>;

  grid: Grid | null;
  slimeLayer: SlimeLayer | null;
  dirty: Set<number>;

  projectiles: Projectile[];
  orbitals: OrbitalVisual[];
  chainFx: ChainFx[];
  clouds: CausticCloud[];
  particles: Particle[];
  gems: Gem[];
  novaFx: NovaFx | null;

  frontier: Float32Array | null;

  events: InfectionEvent[];
  eventSpawnTimer: number;
  coagulants: Coagulant[];

  weaponTimers: Record<WeaponKey, number>;
  bladeNextHit: Record<number, number>;
  wardTimer: number;
  simAcc: number;
  announceTimer: number;
  contactPressure: number;

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

    grid: null,
    slimeLayer: null,
    dirty: new Set(),

    projectiles: [],
    orbitals: [],
    chainFx: [],
    clouds: [],
    particles: [],
    gems: [],
    novaFx: null,

    frontier: null,

    events: [],
    // A little breathing room before the first event, matching the
    // node system's old start-of-run grace period.
    eventSpawnTimer: EVENT_INITIAL_DELAY,
    coagulants: [],

    weaponTimers: { bolt: 0, blades: 0, chain: 0, frost: 0, poison: 0, missile: 0 },
    bladeNextHit: {},
    wardTimer: 0,
    simAcc: 0,
    announceTimer: 0,
    contactPressure: 0,

    pendingLevelUps: 0,
    pendingAnnouncements: [],
  };
}
