import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { spawnChainFx, updateChainFx } from './chainFx';

describe('spawnChainFx', () => {
  it('pushes an fx entry spanning the two points, offset at its midpoint', () => {
    const state = freshState();
    spawnChainFx(state, 0, 0, 100, 0);

    expect(state.chainFx).toHaveLength(1);
    const fx = state.chainFx[0]!;
    expect(fx.x1).toBe(0);
    expect(fx.y1).toBe(0);
    expect(fx.x2).toBe(100);
    expect(fx.y2).toBe(0);
    expect(fx.mx).toBeCloseTo(50, 0);
    // Jittered perpendicular to the line (line is horizontal, so the
    // midpoint's y should be offset from 0).
    expect(fx.my).not.toBe(0);
    expect(fx.life).toBe(fx.maxLife);
  });

  it('caps the fx list rather than growing unbounded', () => {
    const state = freshState();
    for (let i = 0; i < 100; i++) {
      spawnChainFx(state, 0, 0, 10, 10);
    }
    expect(state.chainFx.length).toBeLessThanOrEqual(60);
  });
});

describe('updateChainFx', () => {
  it('decays life and removes expired fx entries', () => {
    const state = freshState();
    spawnChainFx(state, 0, 0, 10, 10);
    const life = state.chainFx[0]!.life;

    updateChainFx(state, life - 0.01);
    expect(state.chainFx).toHaveLength(1);

    updateChainFx(state, 0.02);
    expect(state.chainFx).toHaveLength(0);
  });
});
