import type { GameState } from '../state';
import { clamp } from '../util/math';
import { hexAlpha } from './color';

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S5.1): owns the colour, same
// convention render/immolationRing.ts already set — weapons/lance.ts
// imports it rather than declaring its own.
export const LANCE_COLOR = '#ffe08a';

const AURA_BASE_RADIUS = 14;
const AURA_MAX_GROWTH = 6;
const PARTICLE_COUNT = 4;
const PARTICLE_BASE_ORBIT = 22;
const PARTICLE_ORBIT_SHRINK = 8;
const PARTICLE_SPIN_SPEED = 3;

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S5.1): three layers, each
// telling the player something the others can't —
//
//   1. Core aura, brightening with charge — the ONLY one that still works
//      with no coagulant on the field, since Lance falls back to
//      nearest-frontier and there are real stretches with nothing to draw
//      a target line toward. Without this the weapon reads as idle,
//      exactly the failure this exists to prevent (S5.1).
//   2. Charge particles, orbiting tight around the tower rather than
//      drifting inward — CLAUDE.md/S5.1's warning: "particles drifting
//      toward the core" is this game's established idiom for XP pickup,
//      and colliding with it would make these unreadable as anything but
//      a pending level-up.
//   3. A faint line to whichever target is CURRENTLY acquired — jumps
//      live if a bigger coagulant forms mid-charge, because
//      weapons/lance.ts re-runs highestMassPoint every tick while
//      charging (S5.2), not once at the start of the charge.
//
// Visually distinct from Immolation Ring's steady green ring at a fixed
// outward radius (render/immolationRing.ts) — this is small, at the
// tower itself, gold, and pulses with charge rather than sitting static.
export function drawLanceCharge(ctx: CanvasRenderingContext2D, state: GameState): void {
  const charge = state.lanceCharge;
  if (!charge) return;
  const t = state.tower;
  const progress = clamp(charge.chargeTime > 0 ? charge.progress / charge.chargeTime : 0, 0, 1);

  ctx.save();
  ctx.fillStyle = LANCE_COLOR;
  ctx.shadowColor = LANCE_COLOR;
  ctx.shadowBlur = 8 + progress * 20;
  ctx.globalAlpha = 0.25 + progress * 0.55;
  ctx.beginPath();
  ctx.arc(t.x, t.y, AURA_BASE_RADIUS + progress * AURA_MAX_GROWTH, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = LANCE_COLOR;
  ctx.globalAlpha = 0.4 + progress * 0.5;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + state.time * PARTICLE_SPIN_SPEED;
    const orbitR = PARTICLE_BASE_ORBIT - progress * PARTICLE_ORBIT_SHRINK;
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(angle) * orbitR, t.y + Math.sin(angle) * orbitR, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (charge.target) {
    ctx.save();
    ctx.strokeStyle = LANCE_COLOR;
    ctx.globalAlpha = 0.12 + progress * 0.38;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(charge.target.x, charge.target.y);
    ctx.stroke();
    ctx.restore();
  }
}

// The beam's own flash on release — reuses the fading-stroke vocabulary
// render/novaFx.ts established for a circle, generalized to a line.
export function drawBeamFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const fx of state.beamFx) {
    if (fx.life <= 0) continue;
    const alpha = fx.life / fx.maxLife;
    ctx.save();
    ctx.strokeStyle = hexAlpha(fx.color, alpha);
    ctx.lineWidth = 5;
    ctx.shadowColor = fx.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(fx.x, fx.y);
    ctx.lineTo(fx.toX, fx.toY);
    ctx.stroke();
    ctx.restore();
  }
}
