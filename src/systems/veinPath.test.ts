import { describe, expect, it } from 'vitest';
import { VEIN_DISPLACEMENT_DEPTH } from '../tuning/events';
import { generateVeinPath } from './veinPath';

describe('generateVeinPath', () => {
  it('produces 2^depth trunk segments', () => {
    const { trunk } = generateVeinPath(0, 0, 1000, 1000);
    expect(trunk).toHaveLength(2 ** VEIN_DISPLACEMENT_DEPTH);
  });

  it('the trunk starts exactly at the origin and ends exactly at the target', () => {
    // Only interior midpoints get displaced — the leftmost recursive
    // spine never touches p1 away from the origin, and the rightmost
    // spine never touches p2 away from the target, so these should be
    // exact, not approximate.
    const { trunk } = generateVeinPath(50, 60, 900, 700);
    const first = trunk[0]!;
    const last = trunk[trunk.length - 1]!;
    expect(first.x1).toBe(50);
    expect(first.y1).toBe(60);
    expect(last.x2).toBe(900);
    expect(last.y2).toBe(700);
  });

  it('the trunk is contiguous — each segment starts where the previous one ended', () => {
    const { trunk } = generateVeinPath(0, 0, 1000, 500);
    for (let i = 1; i < trunk.length; i++) {
      expect(trunk[i]!.x1).toBeCloseTo(trunk[i - 1]!.x2, 6);
      expect(trunk[i]!.y1).toBeCloseTo(trunk[i - 1]!.y2, 6);
    }
  });

  it('every coordinate is finite — displacement never produces NaN or Infinity', () => {
    const { trunk, branches } = generateVeinPath(0, 0, 1000, 1000);
    for (const seg of trunk) {
      expect(Number.isFinite(seg.x1)).toBe(true);
      expect(Number.isFinite(seg.y1)).toBe(true);
      expect(Number.isFinite(seg.x2)).toBe(true);
      expect(Number.isFinite(seg.y2)).toBe(true);
    }
    for (const branch of branches) {
      for (const seg of branch.segments) {
        expect(Number.isFinite(seg.x1)).toBe(true);
        expect(Number.isFinite(seg.y1)).toBe(true);
        expect(Number.isFinite(seg.x2)).toBe(true);
        expect(Number.isFinite(seg.y2)).toBe(true);
      }
    }
  });

  it('never forks a branch from the first or last two trunk segments', () => {
    const trunkLength = 2 ** VEIN_DISPLACEMENT_DEPTH;
    // Run several times — branch presence is randomized per call, so a
    // single run could happen to produce zero branches and vacuously pass.
    for (let run = 0; run < 20; run++) {
      const { branches } = generateVeinPath(0, 0, 1000, 1000);
      for (const branch of branches) {
        expect(branch.parentIndex).toBeGreaterThanOrEqual(2);
        expect(branch.parentIndex).toBeLessThan(trunkLength - 2);
      }
    }
  });

  it("a branch's first segment starts at its parent trunk segment's endpoint", () => {
    for (let run = 0; run < 20; run++) {
      const { trunk, branches } = generateVeinPath(0, 0, 1000, 1000);
      for (const branch of branches) {
        const parent = trunk[branch.parentIndex]!;
        const branchStart = branch.segments[0]!;
        expect(branchStart.x1).toBeCloseTo(parent.x2, 6);
        expect(branchStart.y1).toBeCloseTo(parent.y2, 6);
      }
    }
  });
});
