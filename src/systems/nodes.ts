import type { GameState, GrowthNode } from '../state';
import { cellBucket, worldToCell } from '../grid/grid';
import { MAX_NODES } from '../tuning/growth';
import { NODE_HIT_RADIUS, nodeHp, nodeRadius, nodeStrength, nodeXpValue } from '../tuning/nodes';
import { TIERS_LIST } from '../tuning/tiers';
import { clamp, dist, rand } from '../util/math';
import { spawnParticles } from './particles';
import { grantXp } from './xp';

// Growth hotspots that pump density into the area around themselves,
// including past the safe radius where ambient growth can't reach — the
// priority target the frontier-based weapons can't see or prioritize on
// their own. Direct port of the prototype's spawnNode()/destroyNode().
export function spawnNode(state: GameState): void {
  const grid = state.grid;
  if (!grid) return;
  const t = state.tower;
  const angle = rand(0, Math.PI * 2);
  const r = rand(grid.safeRadius + 70, grid.maxRange - 30);
  const x = clamp(t.x + Math.cos(angle) * r, 20, grid.cols * grid.cellSize - 20);
  const y = clamp(t.y + Math.sin(angle) * r, 20, grid.rows * grid.cellSize - 20);
  const hp = nodeHp(state.tierIndex);
  state.nodes.push({
    x,
    y,
    hp,
    maxHp: hp,
    radius: nodeRadius(state.tierIndex),
    strength: nodeStrength(state.tierIndex),
    hitRadius: NODE_HIT_RADIUS,
    dead: false,
    pulseSeed: rand(0, Math.PI * 2),
  });
  state.pendingAnnouncements.push('Infection node forming');
}

export function destroyNode(state: GameState, node: GrowthNode): void {
  node.dead = true;
  spawnParticles(state, node.x, node.y, '#ffcf4d', 30, 180);
  state.nodesPurged += 1;
  grantXp(state, nodeXpValue(state.tierIndex));
}

export function updateNodeSpawn(state: GameState, dt: number): void {
  const tier = TIERS_LIST[state.tierIndex];
  if (!tier) return;
  state.nodeSpawnTimer -= dt;
  const liveCount = state.nodes.reduce((n, node) => n + (node.dead ? 0 : 1), 0);
  if (state.nodeSpawnTimer <= 0 && liveCount < MAX_NODES) {
    state.nodeSpawnTimer = tier.nodeInterval * rand(0.85, 1.2);
    spawnNode(state);
  }
}

export function applyNodeInfluence(state: GameState, dt: number): void {
  const grid = state.grid;
  if (!grid) return;
  for (const node of state.nodes) {
    if (node.dead) continue;
    const rCells = Math.ceil(node.radius / grid.cellSize);
    const { cx: ncx, cy: ncy } = worldToCell(grid, node.x, node.y);
    for (let oy = -rCells; oy <= rCells; oy++) {
      const cy = ncy + oy;
      if (cy < 0 || cy >= grid.rows) continue;
      for (let ox = -rCells; ox <= rCells; ox++) {
        const cx = ncx + ox;
        if (cx < 0 || cx >= grid.cols) continue;
        const i = cy * grid.cols + cx;
        if (grid.frozen[i]! > 0) continue;
        const wx = cx * grid.cellSize + grid.cellSize / 2;
        const wy = cy * grid.cellSize + grid.cellSize / 2;
        const d = dist(wx, wy, node.x, node.y);
        if (d > node.radius) continue;
        const falloff = Math.pow(1 - d / node.radius, 1.4);
        const rate = node.strength * falloff;
        const dens = grid.growth[i]!;
        const newDens = Math.min(1, dens + rate * dt * (1 - dens));
        if (newDens !== dens) {
          grid.growth[i] = newDens;
          const nb = cellBucket(grid, i);
          if (nb !== grid.bucket[i]) {
            grid.bucket[i] = nb;
            state.dirty.add(i);
          }
        }
      }
    }
  }
}
