import type { Coagulant, GameState } from '../state';
import { FORMATION_RISE_DURATION } from '../tuning/coagulants';
import { ageFloorAt, maturityBucket } from '../tuning/maturity';
import { MATURITY_COLORS } from '../tuning/palette';
import { clamp } from '../util/math';

const HIGHLIGHT_COLOR = 'rgba(255,255,255,0.18)';
// Sclerotic reads as "plated," not "wobbling jelly" — the same shapes in
// the mature palette with flatter edges, per Decision 46's Wave 2
// anticipation.
const SCLEROTIC_WOBBLE = 0.04;
const DEFAULT_WOBBLE = 0.12;

// Decision 46: coagulants render into the slime palette, not as a
// separate sprite layer — a coagulant's density maps to a bucket colour
// exactly like a grid cell does, so it reads as the field getting up and
// walking rather than a monster dropped on top of it. Can't literally
// live *in* the slime layer canvas (that's a persistent bitmap repainted
// only on dirty cells; these move every frame), so this draws every
// frame immediately after it instead — same palette, same material read.
export function drawCoagulants(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Phase 4C-1 (Decision 68): colour now reads sourceMaturity through the
  // same threshold-relative bucketing terrain uses (tuning/maturity.ts),
  // so it needs the same current age floor terrain reads every tick.
  const ageFloor = state.grid ? ageFloorAt(state.time) : 0;
  for (const c of state.coagulants) {
    if (c.mass <= 0) continue;
    drawBlob(ctx, c, state.time, ageFloor);
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
function drawBlob(ctx: CanvasRenderingContext2D, c: Coagulant, time: number, ageFloor: number): void {
  const riseProgress =
    c.phase === 'forming' ? clamp(1 - c.phaseTimer / FORMATION_RISE_DURATION, 0, 1) : 1;
  const drawRadius = c.radius * riseProgress;
  if (drawRadius <= 0) return;

  // Phase 4C-1 (Decision 68): colour now reads the coagulant's own source
  // maturity through the two-axis palette (Phase 4B) — a Sclerotic, born
  // of hardened ground, renders bone-pale like the ring it came from,
  // rather than every kind defaulting to fresh hot pink. Still the same
  // palette terrain uses (Decision 46: "the brightest, densest slime in
  // the game" at maturity 0, which is every Wave 1 kind unchanged).
  const bucket = maturityBucket(c.sourceMaturity, ageFloor);
  const color = `rgb(${MATURITY_COLORS[bucket]})`;
  // Sclerotic and Bulwark both read as "plated," not "wobbling jelly" —
  // both born of hardened ground (Decision 68/69).
  const wobbleAmp = c.kind === 'sclerotic' || c.kind === 'bulwark' ? SCLEROTIC_WOBBLE : DEFAULT_WOBBLE;
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.7 * riseProgress;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  if (c.parts.length > 0) {
    // Phase 4C-2 (Decision 69): a multi-part body (Bulwark) draws its
    // seed-blobs around each part in turn, cycling through them, so the
    // rendered silhouette traces the actual wall rather than clustering
    // every seed around a single centre point — "wide and flat," not "one
    // big blob with a wide hitbox."
    for (let i = 0; i < c.seeds.length; i++) {
      const seed = c.seeds[i]!;
      const part = c.parts[i % c.parts.length]!;
      const px = c.x + part.dx;
      const py = c.y + part.dy;
      const partDrawRadius = part.r * riseProgress;
      const wobble = 1 + Math.sin(time * seed.speed * 3 + seed.phase) * wobbleAmp;
      const angle = seed.a + time * seed.speed * 0.3;
      const sx = px + Math.cos(angle) * seed.r * partDrawRadius * 0.5;
      const sy = py + Math.sin(angle) * seed.r * partDrawRadius * 0.5;
      const sr = partDrawRadius * (0.4 + seed.r * 0.3) * wobble;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const seed of c.seeds) {
      const wobble = 1 + Math.sin(time * seed.speed * 3 + seed.phase) * wobbleAmp;
      const angle = seed.a + time * seed.speed * 0.3;
      const sx = c.x + Math.cos(angle) * seed.r * drawRadius * 0.5;
      const sy = c.y + Math.sin(angle) * seed.r * drawRadius * 0.5;
      const sr = drawRadius * (0.4 + seed.r * 0.3) * wobble;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.beginPath();
  ctx.arc(c.x - drawRadius * 0.2, c.y - drawRadius * 0.2, drawRadius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
