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

  // Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md S3): the nine
  // Conditional gems. Penetration/Corrosion reuse fields that already
  // exist (armorIgnoreCap/armorShred, from Lance's Piercing Core and
  // Poison's Corrosive) — the guard here is that the GEM path actually
  // sets them, same as the extension path already does elsewhere.
  describe('Conditional gems (Phase 6D-2)', () => {
    it('penetration sets armorIgnoreCap', () => {
      const state = freshState();
      socket(state, 'bolt', 'penetration');
      expect(resolveOpts(state, 'bolt').armorIgnoreCap).toBeGreaterThan(0);
    });

    it('virulence sets maturityScaled', () => {
      const state = freshState();
      socket(state, 'bolt', 'virulence');
      expect(resolveOpts(state, 'bolt').maturityScaled).toBeGreaterThan(0);
    });

    it('saturation sets saturationScaled, distinct from densityScaled', () => {
      const state = freshState();
      socket(state, 'bolt', 'saturation');
      const opts = resolveOpts(state, 'bolt');
      expect(opts.saturationScaled).toBeGreaterThan(0);
      expect(opts.densityScaled).toBeUndefined();
    });

    it('giantSlayer sets massScaledUp', () => {
      const state = freshState();
      socket(state, 'bolt', 'giantSlayer');
      expect(resolveOpts(state, 'bolt').massScaledUp).toBeGreaterThan(0);
    });

    it('culling sets both massScaledDown and cullingFinishFraction', () => {
      const state = freshState();
      socket(state, 'bolt', 'culling');
      const opts = resolveOpts(state, 'bolt');
      expect(opts.massScaledDown).toBeGreaterThan(0);
      expect(opts.cullingFinishFraction).toBeGreaterThan(0);
    });

    it('corrosion sets armorShred', () => {
      const state = freshState();
      socket(state, 'bolt', 'corrosion');
      expect(resolveOpts(state, 'bolt').armorShred).toBeGreaterThan(0);
    });

    it('desperation sets desperationScaled', () => {
      const state = freshState();
      socket(state, 'bolt', 'desperation');
      expect(resolveOpts(state, 'bolt').desperationScaled).toBeGreaterThan(0);
    });

    it('proximity sets proximityScaled', () => {
      const state = freshState();
      socket(state, 'bolt', 'proximity');
      expect(resolveOpts(state, 'bolt').proximityScaled).toBeGreaterThan(0);
    });

    describe('momentum', () => {
      it('sets momentumKey to the weapon it is socketed into', () => {
        const state = freshState();
        socket(state, 'bolt', 'momentum');
        expect(resolveOpts(state, 'bolt').momentumKey).toBe('bolt');
      });

      it('momentumMult is 1 (no bonus) with no streak yet', () => {
        const state = freshState();
        socket(state, 'bolt', 'momentum');
        expect(resolveOpts(state, 'bolt').momentumMult).toBe(1);
      });

      it('momentumMult rises with state.weaponStreak for that weapon', () => {
        const state = freshState();
        socket(state, 'bolt', 'momentum');
        state.weaponStreak.bolt = 3;
        expect(resolveOpts(state, 'bolt').momentumMult).toBeGreaterThan(1);
      });

      it('momentumMult is capped — an absurd streak does not produce an absurd multiplier', () => {
        const state = freshState();
        socket(state, 'bolt', 'momentum');
        state.weaponStreak.bolt = 1000;
        const capped = resolveOpts(state, 'bolt').momentumMult!;

        state.weaponStreak.bolt = 5;
        const atFive = resolveOpts(state, 'bolt').momentumMult!;

        expect(capped).toBe(atFive); // both clamp to the same cap
      });

      it('reads THIS weapon\'s own streak, not another weapon\'s', () => {
        const state = freshState();
        socket(state, 'bolt', 'momentum');
        state.weaponStreak.chain = 10; // a different weapon's streak
        expect(resolveOpts(state, 'bolt').momentumMult).toBe(1); // unaffected
      });
    });

    it('a Targeting-class gem contributes nothing to RESOLVE options either', () => {
      const state = freshState();
      socket(state, 'bolt', 'threatPriority');
      expect(resolveOpts(state, 'bolt')).toEqual({});
    });
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
