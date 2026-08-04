import { randInt } from '../util/math';

// Gray-Scott reaction-diffusion. Produces the static coral/maze pattern
// the growth field reveals over time. Simulated at half the grid's
// resolution and upsampled 2x (nearest-neighbor) to keep one-time startup
// cost low even on large grids.
//
// STABILITY: explicit-Euler 2D diffusion (5-point stencil) is only stable
// when D * step <= ~0.25. Du=1.0 with step=1 diverges to NaN within ~25
// iterations with NO thrown error — a silently blank field, not a crash.
// Never raise RD_STEP without re-deriving this bound. See
// veinField.test.ts for a canary test that guards this.
const RD_ITERATIONS = 2000;
const RD_FEED = 0.0545;
const RD_KILL = 0.062;
const RD_STEP = 0.15;
const RD_DU = 1.0;
const RD_DV = 0.5;

export function generateVeinFieldRaw(
  cols: number,
  rows: number,
  iterations: number,
  feed: number,
  kill: number,
  step: number,
): Float32Array {
  const size = cols * rows;
  let u = new Float32Array(size).fill(1);
  let v = new Float32Array(size).fill(0);

  const seeds = Math.max(6, Math.floor(size / 450));
  for (let s = 0; s < seeds; s++) {
    const cx = randInt(2, cols - 3);
    const cy = randInt(2, rows - 3);
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const xx = cx + x;
        const yy = cy + y;
        if (xx >= 0 && xx < cols && yy >= 0 && yy < rows) {
          v[yy * cols + xx] = 1;
          u[yy * cols + xx] = 0;
        }
      }
    }
  }

  let u2 = new Float32Array(size);
  let v2 = new Float32Array(size);
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < rows; y++) {
      const yU = (y > 0 ? y - 1 : rows - 1) * cols;
      const yD = (y < rows - 1 ? y + 1 : 0) * cols;
      const yRow = y * cols;
      for (let x = 0; x < cols; x++) {
        const xL = x > 0 ? x - 1 : cols - 1;
        const xR = x < cols - 1 ? x + 1 : 0;
        const i = yRow + x;
        const lapU = u[yRow + xL]! + u[yRow + xR]! + u[yU + x]! + u[yD + x]! - 4 * u[i]!;
        const lapV = v[yRow + xL]! + v[yRow + xR]! + v[yU + x]! + v[yD + x]! - 4 * v[i]!;
        const uu = u[i]!;
        const vv = v[i]!;
        const reaction = uu * vv * vv;
        u2[i] = uu + step * (RD_DU * lapU - reaction + feed * (1 - uu));
        v2[i] = vv + step * (RD_DV * lapV + reaction - (kill + feed) * vv);
      }
    }
    const tu = u;
    u = u2;
    u2 = tu;
    const tv = v;
    v = v2;
    v2 = tv;
  }
  return v;
}

export function generateVeinField(cols: number, rows: number): Float32Array {
  const cols2 = Math.max(4, Math.ceil(cols / 2));
  const rows2 = Math.max(4, Math.ceil(rows / 2));
  const raw = generateVeinFieldRaw(cols2, rows2, RD_ITERATIONS, RD_FEED, RD_KILL, RD_STEP);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const value = raw[i]!;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = Math.max(1e-6, max - min);

  const field = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const sy = Math.min(rows2 - 1, Math.floor(cy / 2));
    for (let cx = 0; cx < cols; cx++) {
      const sx = Math.min(cols2 - 1, Math.floor(cx / 2));
      field[cy * cols + cx] = (raw[sy * cols2 + sx]! - min) / range;
    }
  }
  return field;
}
