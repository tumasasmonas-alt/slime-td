import type { GameState } from '../state';
import { rand } from '../util/math';

const MAX_PARTICLES = 400;
const DEFAULT_SPEED = 60;

export function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number = DEFAULT_SPEED,
): void {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(speed * 0.4, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(0.3, 0.7),
      maxLife: 0.7,
      color,
      size: rand(1.5, 3.5),
    });
  }
  if (state.particles.length > MAX_PARTICLES) {
    state.particles.splice(0, state.particles.length - MAX_PARTICLES);
  }
}

export function updateParticles(state: GameState, dt: number): void {
  const remaining: typeof state.particles = [];
  for (const p of state.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    remaining.push(p);
  }
  state.particles = remaining;
}
