import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { updateNovaFx } from './novaFx';

describe('updateNovaFx', () => {
  it('does nothing when there is no active novaFx', () => {
    const state = freshState();
    expect(() => updateNovaFx(state, 0.1)).not.toThrow();
    expect(state.novaFx).toBeNull();
  });

  it('decays life by dt, not a fixed 1/60 — Confirmed decision 4', () => {
    const state = freshState();
    state.novaFx = { x: 0, y: 0, radius: 100, life: 0.4, maxLife: 0.4 };

    updateNovaFx(state, 0.25);

    expect(state.novaFx).not.toBeNull();
    expect(state.novaFx!.life).toBeCloseTo(0.15, 5);
  });

  it('clears novaFx once its life runs out', () => {
    const state = freshState();
    state.novaFx = { x: 0, y: 0, radius: 100, life: 0.1, maxLife: 0.4 };

    updateNovaFx(state, 0.2);

    expect(state.novaFx).toBeNull();
  });
});
