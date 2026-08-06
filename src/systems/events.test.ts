import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BloomInfectionEvent, Grid, VeinInfectionEvent } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import {
  BLOOM_RADIUS,
  EVENT_ACTIVE_DURATION,
  EVENT_DECAY_DURATION,
  EVENT_TELEGRAPH_DURATION,
  MAX_CONCURRENT_EVENTS,
  VEIN_WEIGHT,
} from '../tuning/events';
import { updateEvents, updateEventSpawn, veinRevealCount } from './events';

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 3600;
  return {
    cols: 60,
    rows: 60,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 300,
    perimeter: 100,
    ...overrides,
  };
}

function densityAt(grid: Grid, x: number, y: number): number {
  const { cx, cy } = worldToCell(grid, x, y);
  return grid.growth[gIdx(grid, cx, cy)]!;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('veinRevealCount', () => {
  function makeVein(overrides: Partial<VeinInfectionEvent> = {}): VeinInfectionEvent {
    return {
      kind: 'vein',
      phase: 'telegraph',
      phaseTimer: EVENT_TELEGRAPH_DURATION,
      age: 0,
      trunk: [
        { x1: 0, y1: 0, x2: 1, y2: 0 },
        { x1: 1, y1: 0, x2: 2, y2: 0 },
        { x1: 2, y1: 0, x2: 3, y2: 0 },
        { x1: 3, y1: 0, x2: 4, y2: 0 },
      ],
      branches: [],
      ...overrides,
    };
  }

  it('is 0 during telegraph — nothing has grown yet', () => {
    const event = makeVein({ phase: 'telegraph' });
    expect(veinRevealCount(event)).toBe(0);
  });

  it('is 0 at the very start of the active phase', () => {
    const event = makeVein({ phase: 'active', phaseTimer: EVENT_ACTIVE_DURATION });
    expect(veinRevealCount(event)).toBe(0);
  });

  it('grows partway through the active phase', () => {
    const event = makeVein({ phase: 'active', phaseTimer: EVENT_ACTIVE_DURATION / 2 });
    expect(veinRevealCount(event)).toBe(2); // half of 4 trunk segments
  });

  it('is the full trunk once active completes, at peak, and during decay', () => {
    expect(veinRevealCount(makeVein({ phase: 'active', phaseTimer: 0 }))).toBe(4);
    expect(veinRevealCount(makeVein({ phase: 'peak', phaseTimer: 1 }))).toBe(4);
    expect(veinRevealCount(makeVein({ phase: 'decay', phaseTimer: 0.5 }))).toBe(4);
  });
});

describe('updateEvents — lifecycle', () => {
  function makeVein(overrides: Partial<VeinInfectionEvent> = {}): VeinInfectionEvent {
    return {
      kind: 'vein',
      phase: 'telegraph',
      phaseTimer: EVENT_TELEGRAPH_DURATION,
      age: 0,
      trunk: [{ x1: 300, y1: 300, x2: 310, y2: 300 }],
      branches: [],
      ...overrides,
    };
  }

  it('advances to the next phase once the current one expires', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phase: 'telegraph', phaseTimer: 0.05 })];

    updateEvents(state, 0.1);

    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.phase).toBe('active');
  });

  it('holds its phase while time remains in it', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phase: 'active', phaseTimer: 2 })];

    updateEvents(state, 0.1);

    expect(state.events[0]!.phase).toBe('active');
    expect(state.events[0]!.phaseTimer).toBeCloseTo(1.9, 5);
  });

  it('is removed once decay completes — nothing leaks', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phase: 'decay', phaseTimer: 0.05 })];

    updateEvents(state, 0.1);

    expect(state.events).toHaveLength(0);
  });

  it('tracks age across ticks regardless of phase', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ age: 1 })];

    updateEvents(state, 0.5);

    expect(state.events[0]!.age).toBeCloseTo(1.5, 5);
  });
});

describe('updateEvents — vein growth injection', () => {
  // Four segments placed far apart so falloff from one can't reach
  // another — lets "revealed segments grow, unrevealed ones don't" be a
  // clean spatial assertion rather than a proximity judgment call.
  function makeVein(overrides: Partial<VeinInfectionEvent> = {}): VeinInfectionEvent {
    return {
      kind: 'vein',
      phase: 'active',
      phaseTimer: EVENT_ACTIVE_DURATION,
      age: 0,
      trunk: [
        { x1: 100, y1: 100, x2: 100, y2: 100 },
        { x1: 500, y1: 500, x2: 500, y2: 500 },
        { x1: 100, y1: 500, x2: 100, y2: 500 },
        { x1: 500, y1: 100, x2: 500, y2: 100 },
      ],
      branches: [],
      ...overrides,
    };
  }

  it('injects growth only along revealed segments, not unrevealed ones', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    // advancePhase decrements phaseTimer by dt *before* growth is
    // applied, so this is chosen to land comfortably inside "only the
    // first of four segments revealed" after that decrement (t ~= 0.125,
    // revealed = ceil(0.125*4) = 1), not right on a rounding boundary.
    state.events = [makeVein({ phaseTimer: 3.6 })];

    updateEvents(state, 0.1);

    expect(densityAt(state.grid, 100, 100)).toBeGreaterThan(0);
    expect(densityAt(state.grid, 500, 500)).toBe(0);
    expect(densityAt(state.grid, 100, 500)).toBe(0);
    expect(densityAt(state.grid, 500, 100)).toBe(0);
  });

  it('injects nothing during telegraph', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phase: 'telegraph', phaseTimer: EVENT_TELEGRAPH_DURATION })];

    updateEvents(state, 0.1);

    expect(densityAt(state.grid, 100, 100)).toBe(0);
    expect(densityAt(state.grid, 500, 500)).toBe(0);
  });

  it('injects nothing during decay — the density it already made simply remains', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phase: 'decay', phaseTimer: EVENT_DECAY_DURATION })];

    updateEvents(state, 0.1);

    expect(densityAt(state.grid, 100, 100)).toBe(0);
  });

  it('respects frozen cells — no growth, and the freeze timer is left untouched', () => {
    // Deliberately different from applyAmbientGrowth, which *does*
    // decrement frozen on the cells it skips. A second system doing the
    // same decrement would silently halve every freeze duration whenever
    // a vein happens to cross it.
    const state = freshState();
    state.grid = makeTestGrid();
    const { cx, cy } = worldToCell(state.grid, 100, 100);
    const i = gIdx(state.grid, cx, cy);
    state.grid.frozen[i] = 1.5;
    state.events = [makeVein({ phaseTimer: EVENT_ACTIVE_DURATION / 2 })];

    updateEvents(state, 0.1);

    expect(state.grid.growth[i]).toBe(0);
    expect(state.grid.frozen[i]).toBe(1.5);
  });

  it('marks touched cells dirty so the slime layer repaints them', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeVein({ phaseTimer: EVENT_ACTIVE_DURATION / 2 })];

    updateEvents(state, 0.5); // large dt so density definitely crosses a bucket

    expect(state.dirty.size).toBeGreaterThan(0);
  });
});

describe('updateEvents — bloom growth injection', () => {
  function makeBloom(overrides: Partial<BloomInfectionEvent> = {}): BloomInfectionEvent {
    return {
      kind: 'bloom',
      phase: 'active',
      phaseTimer: EVENT_ACTIVE_DURATION,
      age: 0,
      x: 300,
      y: 300,
      radius: BLOOM_RADIUS,
      ...overrides,
    };
  }

  it('grows faster near its center than near its edge (radial falloff)', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeBloom()];

    updateEvents(state, 1);

    const center = densityAt(state.grid, 300, 300);
    const edge = densityAt(state.grid, 300 + BLOOM_RADIUS - 5, 300);
    expect(center).toBeGreaterThan(0);
    expect(center).toBeGreaterThan(edge);
  });

  it('injects nothing outside its radius', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.events = [makeBloom()];

    updateEvents(state, 1);

    expect(densityAt(state.grid, 300 + BLOOM_RADIUS + 20, 300)).toBe(0);
  });

  it('injects nothing during telegraph or decay', () => {
    const telegraph = freshState();
    telegraph.grid = makeTestGrid();
    telegraph.events = [makeBloom({ phase: 'telegraph', phaseTimer: EVENT_TELEGRAPH_DURATION })];
    updateEvents(telegraph, 0.5);
    expect(densityAt(telegraph.grid, 300, 300)).toBe(0);

    const decay = freshState();
    decay.grid = makeTestGrid();
    decay.events = [makeBloom({ phase: 'decay', phaseTimer: EVENT_DECAY_DURATION })];
    updateEvents(decay, 0.5);
    expect(densityAt(decay.grid, 300, 300)).toBe(0);
  });
});

describe('updateEventSpawn', () => {
  it('spawns once the timer runs out', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.eventSpawnTimer = 0.05;

    updateEventSpawn(state, 0.1);

    expect(state.events).toHaveLength(1);
    expect(state.eventSpawnTimer).toBeGreaterThan(0); // reset for the next spawn
  });

  it('never exceeds MAX_CONCURRENT_EVENTS live events at once', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    for (let i = 0; i < 10; i++) {
      state.eventSpawnTimer = 0;
      updateEventSpawn(state, 0.1);
    }
    expect(state.events.length).toBeLessThanOrEqual(MAX_CONCURRENT_EVENTS);
  });

  it('spawns a vein when the coin flip favors it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < VEIN_WEIGHT
    const state = freshState();
    state.grid = makeTestGrid();
    state.eventSpawnTimer = 0;

    updateEventSpawn(state, 0.1);

    expect(state.events[0]!.kind).toBe('vein');
  });

  it('spawns a bloom when the coin flip favors it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // >= VEIN_WEIGHT
    expect(0.999).toBeGreaterThanOrEqual(VEIN_WEIGHT);
    const state = freshState();
    state.grid = makeTestGrid();
    state.eventSpawnTimer = 0;

    updateEventSpawn(state, 0.1);

    expect(state.events[0]!.kind).toBe('bloom');
  });

  it('every spawned vein starts in the telegraph phase with a generated trunk', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.eventSpawnTimer = 0;
    for (let i = 0; i < 20; i++) {
      state.eventSpawnTimer = 0;
      updateEventSpawn(state, 0.1);
    }
    for (const event of state.events) {
      expect(event.phase).toBe('telegraph');
      if (event.kind === 'vein') {
        expect(event.trunk.length).toBeGreaterThan(0);
      } else {
        expect(event.radius).toBeGreaterThan(0);
      }
    }
  });

  it('does nothing without a grid yet', () => {
    const state = freshState();
    state.eventSpawnTimer = 0;

    updateEventSpawn(state, 0.1);

    expect(state.events).toHaveLength(0);
  });
});
