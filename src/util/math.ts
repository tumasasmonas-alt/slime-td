export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

export function pick<T>(arr: readonly T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pick() called on an empty array');
  return item;
}

export function dist2(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(dist2(x1, y1, x2, y2));
}

export function fmtTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Area of the lens where two circles overlap — used to scale weapon
// damage against coagulants by how much of the hit disc actually
// intersects the blob, rather than a flat per-weapon constant (see
// grid/clear.ts's coagulant damage loop, docs/DECISIONS.md #42/#50).
export function circleOverlapArea(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): number {
  const d = dist(x1, y1, x2, y2);
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const r1sq = r1 * r1;
  const r2sq = r2 * r2;
  const alpha = Math.acos(clamp((d * d + r1sq - r2sq) / (2 * d * r1), -1, 1)) * 2;
  const beta = Math.acos(clamp((d * d + r2sq - r1sq) / (2 * d * r2), -1, 1)) * 2;
  const area1 = 0.5 * r1sq * (alpha - Math.sin(alpha));
  const area2 = 0.5 * r2sq * (beta - Math.sin(beta));
  return area1 + area2;
}
