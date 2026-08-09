import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { emissionPlan, hasHomingGem, projectileFlags, resolveOpts } from './resolveOpts';

function socket(state: ReturnType<typeof freshState>, weapon: 'bolt' | 'frost', kind: string): void {
  state.weapons[weapon] = 1;
  state.weaponSockets[weapon] = { extensions: [], gems: [{ id: 1, kind: kind as never }] };
}

describe('resolveOpts', () => {
  it('is empty with no gems socketed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(resolveOpts(state, 'bolt')).toEqual({});
  });

  it('pierce sets ignoreResistance', () => {
    const state = freshState();
    socket(state, 'bolt', 'pierce');
    expect(resolveOpts(state, 'bolt').ignoreResistance).toBe(true);
  });

  it('splash sets flattenFalloff', () => {
    const state = freshState();
    socket(state, 'bolt', 'splash');
    expect(resolveOpts(state, 'bolt').flattenFalloff).toBe(true);
  });

  it('overflow/kickback/priming set their own fields, each a real number where applicable', () => {
    const overflow = freshState();
    socket(overflow, 'bolt', 'overflow');
    expect(resolveOpts(overflow, 'bolt').overflow).toBe(true);

    const kickback = freshState();
    socket(kickback, 'bolt', 'kickback');
    expect(resolveOpts(kickback, 'bolt').kickback).toBeGreaterThan(0);

    const priming = freshState();
    socket(priming, 'bolt', 'priming');
    expect(resolveOpts(priming, 'bolt').priming).toBeGreaterThan(1); // a real multiplier, not a flag
  });

  it('an Amplifier-class gem contributes nothing to RESOLVE options', () => {
    const state = freshState();
    socket(state, 'bolt', 'amplifier');
    expect(resolveOpts(state, 'bolt')).toEqual({});
  });

  it('a gem socketed in a different weapon has no effect here', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weapons.frost = 1;
    state.weaponSockets.frost = { extensions: [], gems: [{ id: 1, kind: 'pierce' }] };
    expect(resolveOpts(state, 'bolt')).toEqual({});
  });
});

describe('projectileFlags', () => {
  it('is empty with no gems socketed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(projectileFlags(state, 'bolt')).toEqual({});
  });

  it('pierce sets a positive charge count', () => {
    const state = freshState();
    socket(state, 'bolt', 'pierce');
    expect(projectileFlags(state, 'bolt').pierce).toBeGreaterThan(0);
  });

  it('fork/chaining/bounce/ricochet/homing each set their own field', () => {
    for (const [kind, field] of [
      ['fork', 'forks'],
      ['chaining', 'chains'],
      ['bounce', 'bounces'],
      ['ricochet', 'ricochet'],
      ['homing', 'homing'],
    ] as const) {
      const state = freshState();
      socket(state, 'bolt', kind);
      const flags = projectileFlags(state, 'bolt') as Record<string, unknown>;
      expect(flags[field]).toBeTruthy();
    }
  });
});

describe('emissionPlan', () => {
  it('is count 1, no formation, with nothing socketed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    expect(emissionPlan(state, 'bolt')).toEqual({ count: 1, formation: false });
  });

  it('multishot raises the count without setting formation', () => {
    const state = freshState();
    socket(state, 'bolt', 'multishot');
    const plan = emissionPlan(state, 'bolt');
    expect(plan.count).toBeGreaterThan(1);
    expect(plan.formation).toBe(false);
  });

  it('formation raises the count AND sets formation', () => {
    const state = freshState();
    socket(state, 'bolt', 'formation');
    const plan = emissionPlan(state, 'bolt');
    expect(plan.count).toBeGreaterThan(1);
    expect(plan.formation).toBe(true);
  });

  it('stacks additively when both are socketed', () => {
    const state = freshState();
    state.weapons.bolt = 5; // socketCount(5) >= 2, room for two gems
    state.weaponSockets.bolt = {
      extensions: [],
      gems: [
        { id: 1, kind: 'multishot' },
        { id: 2, kind: 'formation' },
      ],
    };
    const both = emissionPlan(state, 'bolt').count;
    const multishotOnly = (() => {
      const s = freshState();
      socket(s, 'bolt', 'multishot');
      return emissionPlan(s, 'bolt').count;
    })();
    expect(both).toBeGreaterThan(multishotOnly);
  });
});

describe('hasHomingGem', () => {
  it('is false with no gems socketed', () => {
    const state = freshState();
    state.weapons.frost = 1;
    expect(hasHomingGem(state, 'frost')).toBe(false);
  });

  it('is true once Homing is socketed', () => {
    const state = freshState();
    socket(state, 'frost', 'homing');
    expect(hasHomingGem(state, 'frost')).toBe(true);
  });
});
