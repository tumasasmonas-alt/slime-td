import { describe, expect, it } from 'vitest';
import { freshState } from './state';
import { xpToNext } from './tuning/xp';
import { WORLD_HEIGHT, WORLD_WIDTH } from './tuning/world';

describe('freshState', () => {
  it('centers the tower on the fixed world, not the window', () => {
    const state = freshState();
    expect(state.tower.x).toBe(WORLD_WIDTH / 2);
    expect(state.tower.y).toBe(WORLD_HEIGHT / 2);
  });

  it('starts xpToNext from the level-up formula, not a fast-first-level special case (Decision 61)', () => {
    expect(freshState().tower.xpToNext).toBe(xpToNext(1));
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
