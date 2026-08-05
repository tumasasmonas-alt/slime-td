import type { GameState } from '../state';
import { rand } from '../util/math';

const MAX_CHAIN_FX = 60;
const FX_LIFE = 0.22;

// A brief jagged lightning-arc visual so Chain Bolt hits read as clearly
// distinct from the plain Bolt Turret dot they'd otherwise be confused
// with — see archive/PROTOTYPE_HANDOFF.md "Visual/style decisions to
// preserve".
export function spawnChainFx(state: GameState, x1: number, y1: number, x2: number, y2: number): void {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const jitter = rand(-16, 16);
  state.chainFx.push({
    x1,
    y1,
    x2,
    y2,
    mx: mx + nx * jitter,
    my: my + ny * jitter,
    life: FX_LIFE,
    maxLife: FX_LIFE,
  });
  if (state.chainFx.length > MAX_CHAIN_FX) {
    state.chainFx.splice(0, state.chainFx.length - MAX_CHAIN_FX);
  }
}

export function updateChainFx(state: GameState, dt: number): void {
  const remaining: typeof state.chainFx = [];
  for (const fx of state.chainFx) {
    fx.life -= dt;
    if (fx.life > 0) remaining.push(fx);
  }
  state.chainFx = remaining;
}
