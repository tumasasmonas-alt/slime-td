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
  maxRange: number;
  safeRadius: number;
}

export interface SlimeLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface GrowthNode {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  strength: number;
  hitRadius: number;
  dead: boolean;
  pulseSeed: number;
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
  targetNode: GrowthNode | null;
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
  // decision 4 in docs/PROGRESS.md). Required, not optional, since it's
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
}

export interface NovaFx {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
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

  nodes: GrowthNode[];
  projectiles: Projectile[];
  orbitals: OrbitalVisual[];
  chainFx: ChainFx[];
  clouds: CausticCloud[];
  particles: Particle[];
  gems: Gem[];
  novaFx: NovaFx | null;

  frontier: Float32Array | null;

  weaponTimers: Record<WeaponKey, number>;
  bladeNextHit: Record<number, number>;
  wardTimer: number;
  nodeSpawnTimer: number;
  simAcc: number;
  announceTimer: number;
  contactPressure: number;

  // Counts level-ups an XP grant produced that the upgrade-card UI hasn't
  // shown a card for yet, consumed one at a time — see systems/xp.ts and
  // docs/KNOWN_ISSUES.md "A single XP grant crossing two levels".
  pendingLevelUps: number;
  // Queued rather than a single slot — a tier escalation and a node spawn
  // can land in the same sim tick, and each deserves its own full
  // announceTimer display instead of the second silently overwriting the
  // first (same overwrite bug class as pendingLevelUps above).
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
      // Deliberately not xpToNext(1) (which is 19) — the prototype
      // hardcodes 10 as the level-1 requirement and only switches to the
      // formula on subsequent level-ups. Preserved for parity.
      xpToNext: 10,
      shake: 0,
    },

    weapons: {},
    passives: {},

    grid: null,
    slimeLayer: null,
    dirty: new Set(),

    nodes: [],
    projectiles: [],
    orbitals: [],
    chainFx: [],
    clouds: [],
    particles: [],
    gems: [],
    novaFx: null,

    frontier: null,

    weaponTimers: { bolt: 0, blades: 0, chain: 0, frost: 0, poison: 0, missile: 0 },
    bladeNextHit: {},
    wardTimer: 0,
    nodeSpawnTimer: 14,
    simAcc: 0,
    announceTimer: 0,
    contactPressure: 0,

    pendingLevelUps: 0,
    pendingAnnouncements: [],
  };
}
