import type { Coagulant, GameState } from '../state';
import { BUCKET_COLORS } from '../grid/grid';

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
function drawBlob(ctx: CanvasRenderingContext2D, c: Coagulant, time: number): void {
  const color = BUCKET_COLORS[5]!; // brightest bucket — coagulants are always the densest slime in the game
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (const seed of c.seeds) {
    const wobble = 1 + Math.sin(time * seed.speed * 3 + seed.phase) * 0.12;
    const angle = seed.a + time * seed.speed * 0.3;
    const sx = c.x + Math.cos(angle) * seed.r * c.radius * 0.5;
    const sy = c.y + Math.sin(angle) * seed.r * c.radius * 0.5;
    const sr = c.radius * (0.4 + seed.r * 0.3) * wobble;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.beginPath();
  ctx.arc(c.x - c.radius * 0.2, c.y - c.radius * 0.2, c.radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
