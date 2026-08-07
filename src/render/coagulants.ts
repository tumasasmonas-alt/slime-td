import type { Coagulant, GameState } from '../state';
import { FORMATION_RISE_DURATION } from '../tuning/coagulants';
import { MATURITY_COLORS } from '../tuning/palette';
import { clamp } from '../util/math';

const HIGHLIGHT_COLOR = 'rgba(255,255,255,0.18)';

// Decision 46: coagulants render into the slime palette, not as a
// separate sprite layer — a coagulant's density maps to a bucket colour
// exactly like a grid cell does, so it reads as the field getting up and
// walking rather than a monster dropped on top of it. Can't literally
// live *in* the slime layer canvas (that's a persistent bitmap repainted
// only on dirty cells; these move every frame), so this draws every
// frame immediately after it instead — same palette, same material read.
export function drawCoagulants(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const c of state.coagulants) {
    if (c.mass <= 0) continue;
    drawBlob(ctx, c, state.time);
  }
}

// 5-9 overlapping flat seed circles — the cheap trick that looks
// expensive. No metaballs, no blur filter, no per-pixel work; overlapping
// flat fills merge into a lumpy organic silhouette on their own. Seeds
// are generated once at formation (systems/formation.ts) and only read
// here, never created inside this draw call (the bubbleSeeds/novaFx bug
// class, docs/DECISIONS.md #4/#7).
//
// While 'forming', the body rises from nothing to full size and fades in
// — the visible half of the pause between spark and threat added after
// the Phase 3C playtest gate (2026-08-06) found formation was instant.
function drawBlob(ctx: CanvasRenderingContext2D, c: Coagulant, time: number): void {
  const riseProgress =
    c.phase === 'forming' ? clamp(1 - c.phaseTimer / FORMATION_RISE_DURATION, 0, 1) : 1;
  const drawRadius = c.radius * riseProgress;
  if (drawRadius <= 0) return;

  // Freshest maturity, full alpha — the brightest, densest slime in the
  // game (Decision 46). Phase 4B: sourced from the two-axis palette
  // (tuning/palette.ts) rather than a flat bucket list.
  const color = `rgb(${MATURITY_COLORS[0]})`;
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.7 * riseProgress;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (const seed of c.seeds) {
    const wobble = 1 + Math.sin(time * seed.speed * 3 + seed.phase) * 0.12;
    const angle = seed.a + time * seed.speed * 0.3;
    const sx = c.x + Math.cos(angle) * seed.r * drawRadius * 0.5;
    const sy = c.y + Math.sin(angle) * seed.r * drawRadius * 0.5;
    const sr = drawRadius * (0.4 + seed.r * 0.3) * wobble;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.beginPath();
  ctx.arc(c.x - drawRadius * 0.2, c.y - drawRadius * 0.2, drawRadius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
