import type { GameState } from '../state';

const BLADE_COLOR = '#cfe8ff';
const GLOW_COLOR = '#6df0ff';
const SPIN_SPEED = 6; // independent of orbital motion — the blade's own visible spin
const POINTS = 4;
const INNER_RATIO = 0.35;

// Ninja-star shaped, not a plain glowing dot (docs/DECISIONS.md #17) — a 4-pointed shuriken that spins on its own axis as
// it orbits, so it reads as a blade rather than an orbiting blob.
export function drawOrbitals(ctx: CanvasRenderingContext2D, state: GameState): void {
  state.orbitals.forEach((o, i) => {
    drawShuriken(ctx, o.x, o.y, o.radius, state.time * SPIN_SPEED + i);
  });
}

function drawShuriken(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = GLOW_COLOR;
  ctx.shadowBlur = 10;
  ctx.fillStyle = BLADE_COLOR;
  ctx.beginPath();
  const inner = radius * INNER_RATIO;
  for (let i = 0; i < POINTS * 2; i++) {
    const a = (i / (POINTS * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : inner;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
