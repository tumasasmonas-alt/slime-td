// Shared vocabulary used by both state.ts and the tuning/ modules.
// Lives outside both so neither has to import "downward" from the other.

// 'immolation' added Phase 5A (Decision 70, docs/plans/phase-5-6-arsenal.md
// S7.11): Ward Pulse was a weapon misfiled as a passive since the port —
// it has a cooldown and a tower-centered radius like Frost and Blades,
// not a flat per-level multiplier like everything in PassiveKey below.
export type WeaponKey = 'bolt' | 'blades' | 'chain' | 'frost' | 'poison' | 'missile' | 'immolation';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S3): what a weapon's
// effect physically is, independent of which weapon it belongs to — the
// axis a support gem reinterprets against instead of against a specific
// WeaponKey. Five today (one per shipped weapon); the 6C+ catalogue adds
// 'beam', 'summon' and 'tag'. A gem switching on WeaponKey instead of
// DeliveryKind is the N x M cost the pipeline exists to avoid — see that
// plan's S1, call 2's correction.
export type DeliveryKind = 'projectile' | 'orbital' | 'pulse' | 'cloud' | 'ring';

export type PassiveKey =
  | 'maxHp'
  | 'regen'
  | 'armor'
  | 'pickup'
  | 'xpGain';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S5): the six
// Amplifier gems. A closed union, not `string` — GemInstance.kind used
// to be a placeholder `string` (5B) with a comment saying a real union
// would replace it wholesale once Phase 6A populated one. This is that
// union; 6A-2 extends it with the fourteen Behaviour gems.
export type AmplifierGemKey = 'amplifier' | 'overclock' | 'expansion' | 'extension' | 'velocity' | 'attunement';

export type BehaviourGemKey =
  | 'multishot'
  | 'formation'
  | 'echo'
  | 'barrage'
  | 'splash'
  | 'overflow'
  | 'kickback'
  | 'priming'
  | 'pierce'
  | 'fork'
  | 'chaining'
  | 'homing'
  | 'ricochet'
  | 'bounce';

export type GemKey = AmplifierGemKey | BehaviourGemKey;
