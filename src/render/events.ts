import type { BloomInfectionEvent, GameState, VeinInfectionEvent, VeinSegment } from '../state';
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

// The trunk is contiguous end-to-end (each segment starts where the last
// one ended — see systems/veinPath.test.ts), so it strokes as ONE
// continuous path: a single moveTo, then lineTo through every segment's
// end point. Stroking each segment as its own subpath (moveTo/lineTo per
// segment) put a lineCap at every joint, which with 'round' caps read as
// a string of beads rather than a single line — fixed here rather than
// carried forward from 3B.
function strokeTrunk(
  ctx: CanvasRenderingContext2D,
  segments: VeinSegment[],
  color: string,
  alpha: number,
  width: number,
  glow: number,
): void {
  if (segments.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.beginPath();
  ctx.moveTo(segments[0]!.x1, segments[0]!.y1);
  for (const seg of segments) ctx.lineTo(seg.x2, seg.y2);
  ctx.stroke();
  ctx.restore();
}

// Branches are also individually contiguous (systems/veinPath.test.ts),
// but stroked as *separate* per-segment subpaths so the width can taper
// toward the tip — a single stroke() call can only have one lineWidth.
// 'butt' caps on a narrowing line read as a genuine point, which is what
// "ends in small points like lightning" (the project owner's note on
// 3B's visual) actually needs, not a rounded-off branch.
function strokeBranch(
  ctx: CanvasRenderingContext2D,
  segments: VeinSegment[],
  color: string,
  alpha: number,
  baseWidth: number,
  glow: number,
): void {
  if (segments.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  for (let i = 0; i < segments.length; i++) {
    const t = i / segments.length; // 0 at the fork, ~1 at the tip
    ctx.lineWidth = Math.max(0.6, baseWidth * (1 - t * 0.75));
    const seg = segments[i]!;
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVein(ctx: CanvasRenderingContext2D, event: VeinInfectionEvent, time: number): void {
  let alpha: number;
  let width: number;
  let glow: number;
  let trunk: VeinSegment[];
  let branches: VeinSegment[][];

  if (event.phase === 'telegraph') {
    // The full path lights up dimly — the warning is showing the whole
    // route, not just where growth is (there isn't any yet).
    alpha = 0.18 + Math.sin(time * 3) * 0.05;
    width = 1.5;
    glow = 0;
    trunk = event.trunk;
    branches = event.branches.map((b) => b.segments);
  } else if (event.phase === 'active') {
    // Only the revealed prefix draws — the vein visibly extends inward,
    // in step with where it's actually injecting growth (veinRevealCount
    // is the same function systems/events.ts uses for injection).
    alpha = 0.85;
    width = 3;
    glow = 14;
    const revealed = veinRevealCount(event);
    trunk = event.trunk.slice(0, revealed);
    branches = event.branches.filter((b) => b.parentIndex < revealed).map((b) => b.segments);
  } else if (event.phase === 'peak') {
    alpha = 1;
    width = 4;
    glow = 20;
    trunk = event.trunk;
    branches = event.branches.map((b) => b.segments);
  } else {
    // decay — full shape, fading out. The density it created stays on
    // the grid; only the vein's own glow disappears.
    const t = clamp(event.phaseTimer / EVENT_DECAY_DURATION, 0, 1);
    alpha = t;
    width = 2 + 2 * t;
    glow = 20 * t;
    trunk = event.trunk;
    branches = event.branches.map((b) => b.segments);
  }

  strokeTrunk(ctx, trunk, VEIN_COLOR, alpha, width, glow);
  for (const branch of branches) {
    strokeBranch(ctx, branch, VEIN_COLOR, alpha, width * 0.7, glow);
  }
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
