import type { VeinBranch, VeinSegment } from '../state';
import {
  VEIN_BRANCH_CHANCE,
  VEIN_BRANCH_DEPTH,
  VEIN_BRANCH_LENGTH,
  VEIN_DISPLACEMENT_DEPTH,
  VEIN_INITIAL_OFFSET,
} from '../tuning/events';
import { rand } from '../util/math';

interface Point {
  x: number;
  y: number;
}

// Recursive midpoint displacement — the standard lightning-bolt
// construction. Pushes each segment's midpoint sideways (perpendicular to
// the segment, so it reads as a jag across the direction of travel rather
// than along it) by a shrinking random offset, then recurses on the two
// halves. Emitting the left half before the right half at every level
// preserves start->end order in `out`, which is what lets the caller
// reveal the trunk progressively during the active phase just by walking
// the array in order (see systems/events.ts's veinRevealCount()).
function displace(p1: Point, p2: Point, depth: number, offset: number, out: VeinSegment[]): void {
  if (depth <= 0) {
    out.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    return;
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const push = rand(-offset, offset);
  const mid: Point = {
    x: (p1.x + p2.x) / 2 + nx * push,
    y: (p1.y + p2.y) / 2 + ny * push,
  };
  displace(p1, mid, depth - 1, offset * 0.55, out);
  displace(mid, p2, depth - 1, offset * 0.55, out);
}

function shortBranch(origin: Point, angle: number, depth: number, length: number): VeinSegment[] {
  const tip: Point = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  const segs: VeinSegment[] = [];
  displace(origin, tip, depth, length * 0.35, segs);
  return segs;
}

export interface VeinPath {
  trunk: VeinSegment[];
  branches: VeinBranch[];
}

// Builds the trunk from an edge point to the core, then forks a handful
// of short branches off random interior trunk points — the lattice this
// produces is deliberate: Wave 2's Blastoma coagulant (§10) is specified
// to form where a vein has "webbed" through an area, and a branching vein
// gives that shape for free rather than needing its own system in 4C.
export function generateVeinPath(originX: number, originY: number, targetX: number, targetY: number): VeinPath {
  const trunk: VeinSegment[] = [];
  displace(
    { x: originX, y: originY },
    { x: targetX, y: targetY },
    VEIN_DISPLACEMENT_DEPTH,
    VEIN_INITIAL_OFFSET,
    trunk,
  );

  const branches: VeinBranch[] = [];
  // Skip the first/last couple of segments so branches don't sprout
  // right at the origin or right on top of the core.
  for (let i = 2; i < trunk.length - 2; i++) {
    if (Math.random() >= VEIN_BRANCH_CHANCE) continue;
    const seg = trunk[i]!;
    const trunkAngle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const branchAngle = trunkAngle + (Math.random() < 0.5 ? 1 : -1) * rand(0.6, 1.3);
    branches.push({
      parentIndex: i,
      segments: shortBranch({ x: seg.x2, y: seg.y2 }, branchAngle, VEIN_BRANCH_DEPTH, VEIN_BRANCH_LENGTH),
    });
  }

  return { trunk, branches };
}
