import type {
  BloomInfectionEvent,
  GameState,
  Grid,
  InfectionEvent,
  InfectionEventPhase,
  VeinInfectionEvent,
  VeinSegment,
} from '../state';
import { cellBucket, gIdx, worldToCell } from '../grid/grid';
import {
  BLOOM_ACTIVE_RATE,
  BLOOM_PEAK_RATE,
  BLOOM_RADIUS,
  EVENT_ACTIVE_DURATION,
  EVENT_DECAY_DURATION,
  EVENT_PEAK_DURATION,
  EVENT_TELEGRAPH_DURATION,
  MAX_CONCURRENT_EVENTS,
  VEIN_ACTIVE_RATE,
  VEIN_FORMATION_INTERVAL,
  VEIN_PEAK_RATE,
  VEIN_WEIGHT,
  VEIN_WIDTH,
  eventSpawnInterval,
} from '../tuning/events';
import { clamp, dist, lerp, pick, rand } from '../util/math';
import { attemptFormation } from './formation';
import { generateVeinPath } from './veinPath';

// --- growth injection -------------------------------------------------
// Same "read density, converge toward 1, update bucket/dirty" shape as
// applyAmbientGrowth and the old node influence — events are just another
// source writing into the same grid, not a special case.

function injectAt(grid: Grid, cx: number, cy: number, rate: number, dt: number, dirty: Set<number>): void {
  if (cx < 0 || cx >= grid.cols || cy < 0 || cy >= grid.rows) return;
  const i = gIdx(grid, cx, cy);
  if (grid.frozen[i]! > 0) return; // events respect freeze, same as ambient growth
  const dens = grid.growth[i]!;
  const newDens = Math.min(1, dens + rate * dt * (1 - dens));
  if (newDens !== dens) {
    grid.growth[i] = newDens;
    const nb = cellBucket(grid, i);
    if (nb !== grid.bucket[i]) {
      grid.bucket[i] = nb;
      dirty.add(i);
    }
  }
}

// Stamps growth along one segment by walking it in cellSize steps and
// injecting a small radius at each sample point — the "walk a line, stamp
// circles" version of the old node influence. `touched` dedupes cells hit
// by more than one sample (segment joints, overlapping branches) within
// the same call so they aren't injected twice in one tick.
function injectSegment(
  grid: Grid,
  seg: VeinSegment,
  rate: number,
  dt: number,
  dirty: Set<number>,
  touched: Set<number>,
): void {
  const len = dist(seg.x1, seg.y1, seg.x2, seg.y2);
  const steps = Math.max(1, Math.ceil(len / grid.cellSize));
  const radiusCells = Math.max(1, Math.ceil(VEIN_WIDTH / grid.cellSize));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const sx = seg.x1 + (seg.x2 - seg.x1) * t;
    const sy = seg.y1 + (seg.y2 - seg.y1) * t;
    const { cx: scx, cy: scy } = worldToCell(grid, sx, sy);
    for (let oy = -radiusCells; oy <= radiusCells; oy++) {
      const cy = scy + oy;
      if (cy < 0 || cy >= grid.rows) continue;
      for (let ox = -radiusCells; ox <= radiusCells; ox++) {
        const cx = scx + ox;
        if (cx < 0 || cx >= grid.cols) continue;
        const wx = cx * grid.cellSize + grid.cellSize / 2;
        const wy = cy * grid.cellSize + grid.cellSize / 2;
        if (dist(wx, wy, sx, sy) > VEIN_WIDTH) continue;
        const i = gIdx(grid, cx, cy);
        if (touched.has(i)) continue;
        touched.add(i);
        injectAt(grid, cx, cy, rate, dt, dirty);
      }
    }
  }
}

// How much of the trunk is "grown" right now — 0 during telegraph (no
// injection yet), ramping 0->1 across the active phase, full at peak and
// decay. Exported so render/events.ts can reveal the same segments it's
// growing, rather than recomputing the fraction separately.
export function veinRevealCount(event: VeinInfectionEvent): number {
  if (event.phase === 'telegraph') return 0;
  if (event.phase === 'active') {
    const t = clamp(1 - event.phaseTimer / EVENT_ACTIVE_DURATION, 0, 1);
    return Math.ceil(t * event.trunk.length);
  }
  return event.trunk.length; // peak, decay
}

function veinInjectionRate(event: VeinInfectionEvent): number {
  if (event.phase === 'active') return VEIN_ACTIVE_RATE;
  if (event.phase === 'peak') return VEIN_PEAK_RATE;
  return 0; // telegraph: not injecting yet. decay: the aftermath is the point, not more growth.
}

function applyVeinGrowth(grid: Grid, event: VeinInfectionEvent, dt: number, dirty: Set<number>): void {
  const rate = veinInjectionRate(event);
  if (rate <= 0) return;
  const revealed = veinRevealCount(event);
  const touched = new Set<number>();
  for (let i = 0; i < revealed; i++) {
    injectSegment(grid, event.trunk[i]!, rate, dt, dirty, touched);
  }
  for (const branch of event.branches) {
    if (branch.parentIndex >= revealed) continue;
    for (const seg of branch.segments) {
      injectSegment(grid, seg, rate, dt, dirty, touched);
    }
  }
}

function bloomInjectionRate(event: BloomInfectionEvent): number {
  if (event.phase === 'active') return BLOOM_ACTIVE_RATE;
  if (event.phase === 'peak') return BLOOM_PEAK_RATE;
  return 0;
}

function applyBloomGrowth(grid: Grid, event: BloomInfectionEvent, dt: number, dirty: Set<number>): void {
  const rate = bloomInjectionRate(event);
  if (rate <= 0) return;
  const radiusCells = Math.ceil(event.radius / grid.cellSize);
  const { cx: ecx, cy: ecy } = worldToCell(grid, event.x, event.y);
  for (let oy = -radiusCells; oy <= radiusCells; oy++) {
    const cy = ecy + oy;
    if (cy < 0 || cy >= grid.rows) continue;
    for (let ox = -radiusCells; ox <= radiusCells; ox++) {
      const cx = ecx + ox;
      if (cx < 0 || cx >= grid.cols) continue;
      const wx = cx * grid.cellSize + grid.cellSize / 2;
      const wy = cy * grid.cellSize + grid.cellSize / 2;
      const d = dist(wx, wy, event.x, event.y);
      if (d > event.radius) continue;
      // Same falloff shape as the old node influence.
      const falloff = Math.pow(1 - d / event.radius, 1.4);
      injectAt(grid, cx, cy, rate * falloff, dt, dirty);
    }
  }
}

// --- lifecycle ----------------------------------------------------------

function phaseDuration(phase: InfectionEventPhase): number {
  switch (phase) {
    case 'telegraph':
      return EVENT_TELEGRAPH_DURATION;
    case 'active':
      return EVENT_ACTIVE_DURATION;
    case 'peak':
      return EVENT_PEAK_DURATION;
    case 'decay':
      return EVENT_DECAY_DURATION;
  }
}

function nextPhase(phase: InfectionEventPhase): InfectionEventPhase | null {
  switch (phase) {
    case 'telegraph':
      return 'active';
    case 'active':
      return 'peak';
    case 'peak':
      return 'decay';
    case 'decay':
      return null;
  }
}

// Advances the event's phase timer, transitioning phases as it expires.
// Returns false once decay has run out — the event should be removed;
// the density it already injected stays on the grid ("the slime it
// created remains" — §11 — is true by construction, since injection
// writes straight into grid.growth rather than tracking its own pool).
// Arms formationTimer the instant peak begins, so the first attempt
// fires promptly rather than waiting out a full VEIN_FORMATION_INTERVAL.
function advancePhase(event: InfectionEvent, dt: number): boolean {
  event.age += dt;
  event.phaseTimer -= dt;
  if (event.phaseTimer > 0) return true;
  const next = nextPhase(event.phase);
  if (next === null) return false;
  event.phase = next;
  event.phaseTimer = phaseDuration(next);
  if (next === 'peak') event.formationTimer = 0;
  return true;
}

// Picks a random point along a fully-revealed trunk (peak-only, so this
// is always safe) — occasionally off a branch instead, so buds show up
// on the lattice too, not just the spine.
function randomVeinPoint(event: VeinInfectionEvent): { x: number; y: number } {
  const useBranch = event.branches.length > 0 && Math.random() < 0.3;
  const segments = useBranch ? pick(event.branches).segments : event.trunk;
  const seg = pick(segments);
  const t = Math.random();
  return { x: lerp(seg.x1, seg.x2, t), y: lerp(seg.y1, seg.y2, t) };
}

// Phase 3C: coagulant formation is triggered here, and only here — events
// are sparks, standing mass never spontaneously coagulates (Decision 28).
// A vein sheds repeatedly across peak ("coagulants bud off along its
// length," §10); a bloom is one discrete spark, so formationTimer is set
// to Infinity after its single attempt rather than repeating.
function updateFormation(state: GameState, event: InfectionEvent, dt: number): void {
  if (event.phase !== 'peak') return;
  event.formationTimer -= dt;
  if (event.formationTimer > 0) return;
  if (event.kind === 'vein') {
    event.formationTimer = VEIN_FORMATION_INTERVAL * rand(0.7, 1.3);
    const point = randomVeinPoint(event);
    attemptFormation(state, point.x, point.y);
  } else {
    event.formationTimer = Infinity;
    attemptFormation(state, event.x, event.y);
  }
}

export function updateEvents(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  const remaining: InfectionEvent[] = [];
  for (const event of state.events) {
    const alive = advancePhase(event, dt);
    if (!alive) continue;
    if (event.kind === 'vein') applyVeinGrowth(grid, event, dt, state.dirty);
    else applyBloomGrowth(grid, event, dt, state.dirty);
    updateFormation(state, event, dt);
    remaining.push(event);
  }
  state.events = remaining;
}

// --- spawning -------------------------------------------------------------

function pickEdgePoint(grid: Grid, tower: { x: number; y: number }): { x: number; y: number } {
  const angle = rand(0, Math.PI * 2);
  const r = grid.maxRange - 30;
  return {
    x: clamp(tower.x + Math.cos(angle) * r, 20, grid.cols * grid.cellSize - 20),
    y: clamp(tower.y + Math.sin(angle) * r, 20, grid.rows * grid.cellSize - 20),
  };
}

function pickFieldPoint(grid: Grid, tower: { x: number; y: number }): { x: number; y: number } {
  const angle = rand(0, Math.PI * 2);
  const r = rand(grid.perimeter + 70, grid.maxRange - 30);
  return {
    x: clamp(tower.x + Math.cos(angle) * r, 20, grid.cols * grid.cellSize - 20),
    y: clamp(tower.y + Math.sin(angle) * r, 20, grid.rows * grid.cellSize - 20),
  };
}

function spawnVein(state: GameState): void {
  const grid = state.grid;
  if (!grid) return;
  const origin = pickEdgePoint(grid, state.tower);
  const { trunk, branches } = generateVeinPath(origin.x, origin.y, state.tower.x, state.tower.y);
  state.events.push({
    kind: 'vein',
    phase: 'telegraph',
    phaseTimer: EVENT_TELEGRAPH_DURATION,
    age: 0,
    formationTimer: Infinity, // armed when peak begins — see advancePhase
    trunk,
    branches,
  });
}

function spawnBloom(state: GameState): void {
  const grid = state.grid;
  if (!grid) return;
  const site = pickFieldPoint(grid, state.tower);
  state.events.push({
    kind: 'bloom',
    phase: 'telegraph',
    phaseTimer: EVENT_TELEGRAPH_DURATION,
    age: 0,
    formationTimer: Infinity, // armed when peak begins — see advancePhase
    x: site.x,
    y: site.y,
    radius: BLOOM_RADIUS,
  });
}

// Same "decrement unconditionally, spawn+reset only under the cap" shape
// the old node spawn timer used — when the arena is already at
// MAX_CONCURRENT_EVENTS the timer keeps counting past zero rather than
// resetting, so the next event fires as soon as a slot frees rather than
// waiting out a fresh full interval.
export function updateEventSpawn(state: GameState, dt: number): void {
  state.eventSpawnTimer -= dt;
  if (state.eventSpawnTimer <= 0 && state.events.length < MAX_CONCURRENT_EVENTS) {
    state.eventSpawnTimer = eventSpawnInterval(state.time) * rand(0.85, 1.2);
    if (Math.random() < VEIN_WEIGHT) spawnVein(state);
    else spawnBloom(state);
  }
}
