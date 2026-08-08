import type { PassiveKey } from '../types';

// Phase 5B (docs/plans/phase-5b-framework.md S1, S4): five of today's
// seven passives are direct ports onto the core's 3 fixed sockets —
// bounded, low-risk work, unlike the other 60 weapon-side gems, which are
// genuine Phase 6 content. Reusing PassiveKey's own values here rather
// than inventing new identifiers keeps state.passives as the single field
// driving damageMult/atkSpeedMult/etc. — no translation layer needed.
//
// `damage` and `atkSpeed` are deliberately excluded: per the arsenal plan
// S9A/S9F, Amplifier and Overclock become per-weapon socketed gems in
// Phase 6A, not core gems. Until then they stay on the old unrestricted
// passive-card mechanism, untouched by this file — see
// docs/plans/phase-5b-framework.md S6.
export type CoreGemKey = Extract<PassiveKey, 'maxHp' | 'regen' | 'armor' | 'pickup' | 'xpGain'>;

export const CORE_GEM_KEYS: readonly CoreGemKey[] = ['maxHp', 'regen', 'armor', 'pickup', 'xpGain'];

export const CORE_SOCKET_COUNT = 3;
