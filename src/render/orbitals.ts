import type { GameState, OrbitalVisual } from '../state';

const SPIN_SPEED = 6; // independent of orbital motion — the blade's own visible spin
const POINTS = 4;
const INNER_RATIO = 0.35;
const DOT_GLOW_BLUR = 10;

// Phase 5B-6 (docs/plans/phase-5b-framework.md S6a): dispatches on
// OrbitalVisual.shape/color rather than assuming Blades, so a future
// weapon whose effect orbits (Orbital Conversion's target, Phase 6)
// renders without this module knowing which weapon it is — matching the
// pattern render/projectiles.ts and render/clouds.ts already use.
// docs/DECISIONS.md #17: shuriken shape kept for Blades specifically,
// not a plain glowing dot, so it still reads as a blade.
export function drawOrbitals(ctx: CanvasRenderingContext2D, state: GameState): void {
  state.orbitals.forEach((o, i) => {
    if (o.shape === 'shuriken') {
      drawShuriken(ctx, o, state.time * SPIN_SPEED + i);
    } else {
      drawDot(ctx, o);
    }
  });
}

function drawShuriken(ctx: CanvasRenderingContext2D, o: OrbitalVisual, angle: number): void {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(angle);
  ctx.shadowColor = o.glowColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  const inner = o.radius * INNER_RATIO;
  for (let i = 0; i < POINTS * 2; i++) {
    const a = (i / (POINTS * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? o.radius : inner;
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

function drawDot(ctx: CanvasRenderingContext2D, o: OrbitalVisual): void {
  ctx.save();
  ctx.shadowColor = o.glowColor;
  ctx.shadowBlur = DOT_GLOW_BLUR;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
