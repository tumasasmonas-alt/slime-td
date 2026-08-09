import type { PassiveKey } from '../types';

// Phase 5B (docs/plans/phase-5b-framework.md S1, S4): five of today's
// seven passives are direct ports onto the core's 3 fixed sockets —
// bounded, low-risk work, unlike the other 60 weapon-side gems, which are
// genuine Phase 6 content. Reusing PassiveKey's own values here rather
// than inventing new identifiers keeps state.passives as the single field
// driving pickupMult/xpMult/armorMult/etc. — no translation layer needed.
//
// `damage` and `atkSpeed` (Amplifier/Overclock) were the other two
// PassiveKey members — per the arsenal plan S9A/S9F they became
// per-weapon socketed gems in Phase 6A, not core gems, and 6A-1 deleted
// them from PassiveKey entirely once the gems existed to replace them.
// This Extract<> is now the identity of PassiveKey; kept as an Extract
// rather than collapsed to `= PassiveKey` so a future core-gem-only key
// re-diverging from PassiveKey is a type error here, not a silent drift.
export type CoreGemKey = Extract<PassiveKey, 'maxHp' | 'regen' | 'armor' | 'pickup' | 'xpGain'>;

export const CORE_GEM_KEYS: readonly CoreGemKey[] = ['maxHp', 'regen', 'armor', 'pickup', 'xpGain'];

export const CORE_SOCKET_COUNT = 3;
