import type { BloomInfectionEvent, GameState, VeinInfectionEvent } from '../state';
import { veinRevealCount } from '../systems/events';
import { EVENT_ACTIVE_DURATION, EVENT_DECAY_DURATION } from '../tuning/events';
import { clamp } from '../util/math';

const VEIN_COLOR = '#ff5d8a';
const BLOOM_COLOR = '#ffcf4d';

// A weapon's/mechanic's signature visual is part of it, not polish
// (docs/DECISIONS.md #11) — scoped beyond weapons after the playtest
// found Ward Pulse and freeze both slipped through that rule for not
// being weapons (2026-08-05 session record §2). Events ship with theirs
// from day one.
export function drawInfectionEvents(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const event of state.events) {
    if (event.kind === 'vein') drawVein(ctx, event, state.time);
    else drawBloom(ctx, event, state.time);
  }
}

function drawVein(ctx: CanvasRenderingContext2D, event: VeinInfectionEvent, time: number): void {
  let alpha: number;
  let width: number;
  let glow: number;
  let segments: { x1: number; y1: number; x2: number; y2: number }[];

  if (event.phase === 'telegraph') {
    // The full path lights up dimly — the warning is showing the whole
    // route, not just where growth is (there isn't any yet).
    alpha = 0.18 + Math.sin(time * 3) * 0.05;
    width = 1.5;
    glow = 0;
    segments = [...event.trunk, ...event.branches.flatMap((b) => b.segments)];
  } else if (event.phase === 'active') {
    // Only the revealed prefix draws — the vein visibly extends inward,
    // in step with where it's actually injecting growth (veinRevealCount
    // is the same function systems/events.ts uses for injection).
    alpha = 0.85;
    width = 3;
    glow = 14;
    const revealed = veinRevealCount(event);
    segments = event.trunk.slice(0, revealed);
    for (const b of event.branches) {
      if (b.parentIndex < revealed) segments.push(...b.segments);
    }
  } else if (event.phase === 'peak') {
    alpha = 1;
    width = 4;
    glow = 20;
    segments = [...event.trunk, ...event.branches.flatMap((b) => b.segments)];
  } else {
    // decay — full shape, fading out. The density it created stays on
    // the grid; only the vein's own glow disappears.
    const t = clamp(event.phaseTimer / EVENT_DECAY_DURATION, 0, 1);
    alpha = t;
    width = 2 + 2 * t;
    glow = 20 * t;
    segments = [...event.trunk, ...event.branches.flatMap((b) => b.segments)];
  }

  if (segments.length === 0) return;

  ctx.save();
  ctx.strokeStyle = VEIN_COLOR;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (glow > 0) {
    ctx.shadowColor = VEIN_COLOR;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  for (const seg of segments) {
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBloom(ctx: CanvasRenderingContext2D, event: BloomInfectionEvent, time: number): void {
  let alpha: number;
  let radiusScale: number;
  let glow: number;

  if (event.phase === 'telegraph') {
    alpha = 0.25 + Math.sin(time * 4) * 0.08;
    radiusScale = 1;
    glow = 0;
  } else if (event.phase === 'active') {
    const t = clamp(1 - event.phaseTimer / EVENT_ACTIVE_DURATION, 0, 1);
    alpha = 0.3 + 0.5 * t;
    radiusScale = 0.3 + 0.7 * t;
    glow = 16 * t;
  } else if (event.phase === 'peak') {
    alpha = 0.8 + Math.sin(time * 5) * 0.1;
    radiusScale = 1;
    glow = 22;
  } else {
    const t = clamp(event.phaseTimer / EVENT_DECAY_DURATION, 0, 1);
    alpha = 0.8 * t;
    radiusScale = 1;
    glow = 22 * t;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = BLOOM_COLOR;
  ctx.lineWidth = 2;
  if (glow > 0) {
    ctx.shadowColor = BLOOM_COLOR;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.arc(event.x, event.y, event.radius * radiusScale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
