import { describe, expect, it } from 'vitest';
import { freshState } from './state';
import { WORLD_HEIGHT, WORLD_WIDTH } from './tuning/world';

describe('freshState', () => {
  it('centers the tower on the fixed world, not the window', () => {
    const state = freshState();
    expect(state.tower.x).toBe(WORLD_WIDTH / 2);
    expect(state.tower.y).toBe(WORLD_HEIGHT / 2);
  });

  it('starts xpToNext at the prototype\'s literal 10, not the level-up formula', () => {
    expect(freshState().tower.xpToNext).toBe(10);
  });

  it('has no grid yet — built at run start in a later phase', () => {
    expect(freshState().grid).toBeNull();
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = freshState();
    const b = freshState();
    a.tower.hp = 1;
    expect(b.tower.hp).toBe(100);
  });
});
