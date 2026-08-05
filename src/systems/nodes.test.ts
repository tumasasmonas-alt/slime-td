import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { applyNodeInfluence, destroyNode, spawnNode, updateNodeSpawn } from './nodes';

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
    safeRadius: 20,
    ...overrides,
  };
}

describe('spawnNode', () => {
  it('places a node outside the safe radius plus its margin, inside the grid bounds', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;

    spawnNode(state);

    expect(state.nodes).toHaveLength(1);
    const node = state.nodes[0]!;
    const d = Math.hypot(node.x - state.tower.x, node.y - state.tower.y);
    expect(d).toBeGreaterThanOrEqual(state.grid.safeRadius + 70 - 1e-6);
    expect(node.x).toBeGreaterThanOrEqual(20);
    expect(node.x).toBeLessThanOrEqual(state.grid.cols * state.grid.cellSize - 20);
    expect(node.y).toBeGreaterThanOrEqual(20);
    expect(node.y).toBeLessThanOrEqual(state.grid.rows * state.grid.cellSize - 20);
    expect(node.dead).toBe(false);
    expect(node.hp).toBe(node.maxHp);
    expect(state.pendingAnnouncements).toContain('Infection node forming');
  });

  it('does nothing without a grid yet', () => {
    const state = freshState();
    spawnNode(state);
    expect(state.nodes).toHaveLength(0);
  });
});

describe('destroyNode', () => {
  it('marks the node dead, grants xp, and counts toward nodesPurged', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    spawnNode(state);
    const node = state.nodes[0]!;

    destroyNode(state, node);

    expect(node.dead).toBe(true);
    expect(state.nodesPurged).toBe(1);
    expect(state.tower.xp).toBeGreaterThan(0);
    expect(state.particles.length).toBeGreaterThan(0);
  });
});

describe('updateNodeSpawn', () => {
  it('spawns once the timer runs out', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodeSpawnTimer = 0.05;

    updateNodeSpawn(state, 0.1);

    expect(state.nodes).toHaveLength(1);
    expect(state.nodeSpawnTimer).toBeGreaterThan(0); // reset for the next spawn
  });

  it('never exceeds MAX_NODES live nodes at once', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    for (let i = 0; i < 10; i++) {
      state.nodeSpawnTimer = 0;
      updateNodeSpawn(state, 0.1);
    }
    expect(state.nodes.length).toBeLessThanOrEqual(5); // MAX_NODES
  });

  it('does not count dead nodes against the live cap', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    for (let i = 0; i < 5; i++) {
      state.nodeSpawnTimer = 0;
      updateNodeSpawn(state, 0.1);
    }
    expect(state.nodes).toHaveLength(5);
    destroyNode(state, state.nodes[0]!);

    state.nodeSpawnTimer = 0;
    updateNodeSpawn(state, 0.1);

    expect(state.nodes).toHaveLength(6); // 4 live + 1 dead + 1 freshly spawned
    expect(state.nodes.filter((n) => !n.dead)).toHaveLength(5);
  });
});

describe('applyNodeInfluence', () => {
  it('pushes density into cells within its radius, respecting freeze', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodes.push({
      x: 300,
      y: 300,
      hp: 100,
      maxHp: 100,
      radius: 50,
      strength: 1,
      hitRadius: 16,
      dead: false,
      pulseSeed: 0,
    });

    const nearIdx = 30 * state.grid.cols + 30; // world (305,305), right at the node
    const frozenIdx = 30 * state.grid.cols + 33; // world (335,305), within radius but frozen
    state.grid.frozen[frozenIdx] = 5;

    applyNodeInfluence(state, 0.5);

    expect(state.grid.growth[nearIdx]).toBeGreaterThan(0);
    expect(state.grid.growth[frozenIdx]).toBe(0);
  });

  it('ignores dead nodes', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.nodes.push({
      x: 300,
      y: 300,
      hp: 0,
      maxHp: 100,
      radius: 50,
      strength: 1,
      hitRadius: 16,
      dead: true,
      pulseSeed: 0,
    });

    applyNodeInfluence(state, 0.5);

    const idx = 30 * state.grid.cols + 30;
    expect(state.grid.growth[idx]).toBe(0);
  });
});
