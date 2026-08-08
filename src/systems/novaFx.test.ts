import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { updateNovaFx } from './novaFx';

describe('updateNovaFx', () => {
  it('does nothing when there is no active novaFx', () => {
    const state = freshState();
    expect(() => updateNovaFx(state, 0.1)).not.toThrow();
    expect(state.novaFx).toHaveLength(0);
  });

  it('decays life by dt, not a fixed 1/60 — Confirmed decision 4', () => {
    const state = freshState();
    state.novaFx = [{ x: 0, y: 0, radius: 100, life: 0.4, maxLife: 0.4, color: '#fff' }];

    updateNovaFx(state, 0.25);

    expect(state.novaFx).toHaveLength(1);
    expect(state.novaFx[0]!.life).toBeCloseTo(0.15, 5);
  });

  it('clears novaFx once its life runs out', () => {
    const state = freshState();
    state.novaFx = [{ x: 0, y: 0, radius: 100, life: 0.1, maxLife: 0.4, color: '#fff' }];

    updateNovaFx(state, 0.2);

    expect(state.novaFx).toHaveLength(0);
  });

  // Phase 5B-6: the whole point of the list — two pulse weapons firing
  // the same frame must not overwrite each other's effect.
  it('decays and removes independently when two novaFx are active at once', () => {
    const state = freshState();
    state.novaFx = [
      { x: 0, y: 0, radius: 100, life: 0.1, maxLife: 0.4, color: '#fff' },
      { x: 10, y: 10, radius: 50, life: 0.4, maxLife: 0.4, color: '#0ff' },
    ];

    updateNovaFx(state, 0.2);

    expect(state.novaFx).toHaveLength(1);
    expect(state.novaFx[0]!.x).toBe(10);
    expect(state.novaFx[0]!.life).toBeCloseTo(0.2, 5);
  });
});
