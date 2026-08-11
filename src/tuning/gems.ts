import type { AmplifierGemKey, BehaviourGemKey, ConditionalGemKey, DeliveryKind, GemKey, TargetingGemKey } from '../types';

// Phase 6A-1 (docs/plans/phase-6a1-gem-foundation.md S5): the six
// Amplifier gems — a per-weapon replacement for the deleted global
// damage/atkSpeed passives, plus three new scalars (area/duration/
// velocity) that had no passive equivalent. `delta` returns an additive
// term (matching how the old passiveMult() combined levels of the SAME
// passive — value = level * perLevel); systems/weaponMods.ts sums deltas
// across a weapon's socketed gems and returns `1 + sum` per field, so
// two different Amplifier gems in the same weapon combine additively
// rather than compounding.
//
// Values are sized to compensate for the deleted passives' maxed values
// (Amplifier +80%, Overclock +72% — see that plan's S1 call 3 and S7),
// not derived from anything measured. First-draft constants, expected to
// move at the Phase 5 gate exactly like every other phase's first pass.
export interface GemModDelta {
  readonly damage?: number;
  readonly rate?: number;
  readonly area?: number;
  readonly duration?: number;
  readonly velocity?: number;
}

// The resolved per-weapon multiplier struct — systems/weaponMods.ts
// computes it (reading GameState is systems-layer work), but the shape
// lives here so tuning/weapons.ts can reference it for its live stats()
// readout without tuning/ importing from systems/ (this project's
// layering: tuning holds data, systems holds behaviour that reads it).
export interface WeaponMods {
  readonly damage: number;
  readonly rate: number;
  readonly area: number;
  readonly duration: number;
  readonly velocity: number;
}

export const IDENTITY_MODS: WeaponMods = { damage: 1, rate: 1, area: 1, duration: 1, velocity: 1 };

export interface AmplifierGemDef {
  readonly name: string;
  readonly icon: string;
  // Every delivery kind either has a real reading or is refused — never
  // offered as a card, never legal to socket, for an archetype where
  // `supports` returns false. Unlike 6A-2's Behaviour class (which the
  // owner asked to have no refusals at all), the Amplifier class keeps
  // the refusals from the original design: Extension and Velocity name
  // a term (duration, travel speed) that doesn't exist on every
  // archetype, and reinterpreting them would just duplicate another gem.
  readonly supports: (delivery: DeliveryKind) => boolean;
  // Read once a gem is already sitting in a specific weapon's socket —
  // the inventory screen's picker and stat lines, where the archetype is
  // known.
  readonly desc: (delivery: DeliveryKind) => string;
  // Read on the level-up card, before the gem has a weapon at all — a
  // separate string rather than calling desc() with a guessed archetype,
  // which would print a wrong (even if plausible-looking) sentence for
  // whichever weapon the player actually sockets it into later.
  readonly genericDesc: string;
  readonly delta: (pointsInvested: number) => GemModDelta;
}

const ALWAYS = (): boolean => true;

export const AMPLIFIER_GEM_DEFS: Readonly<Record<AmplifierGemKey, AmplifierGemDef>> = {
  amplifier: {
    name: 'Amplifier',
    icon: '💥',
    supports: ALWAYS,
    desc: () => '+45% damage.',
    genericDesc: '+45% damage to whatever weapon this is socketed into.',
    delta: () => ({ damage: 0.45 }),
  },
  overclock: {
    name: 'Overclock',
    icon: '⏱️',
    supports: ALWAYS,
    // Orbital has no cooldown to shrink — its "how often" is how often
    // each blade can re-hit the same patch, so Overclock reads as hit
    // frequency there rather than colliding with Velocity's orbit-speed
    // reading below (two gems both meaning "spin faster" would be the
    // exact "cards appear to do nothing" duplicate this project has
    // already found and fixed once).
    desc: (d) => (d === 'orbital' ? '+40% hit frequency.' : '+40% fire rate.'),
    genericDesc: '+40% fire rate (or hit frequency, on Orbiting Blades).',
    delta: () => ({ rate: 0.4 }),
  },
  expansion: {
    name: 'Expansion',
    icon: '📐',
    supports: ALWAYS,
    desc: (d) => (d === 'orbital' ? '+30% orbit radius.' : '+30% area.'),
    genericDesc: '+30% area — radius, or orbit radius on Orbiting Blades.',
    delta: () => ({ area: 0.3 }),
  },
  extension: {
    name: 'Extension',
    icon: '⏳',
    // No duration term on projectile (nothing lingers) or orbital (blades
    // are continuous, not timed) or ring (Immolation's tick is Overclock's
    // job, and it has no separate lingering effect to extend) — offering
    // it there would either do nothing or duplicate Overclock.
    //
    // Phase 6C-2 (docs/plans/phase-6c2-lance.md S2.1): 'beam' added,
    // against this plan's own first recommendation (refuse) — the owner's
    // call. A beam gets its OWN duration term (the line stays hot briefly
    // and resolves a second time, weapons/lance.ts), independent of
    // Lance's Afterglow extension, so this is never a dead socket the way
    // refusing-until-Afterglow would have been.
    supports: (d) => d === 'pulse' || d === 'cloud' || d === 'beam',
    desc: (d) => {
      if (d === 'pulse') return '+40% freeze duration.';
      if (d === 'beam') return '+40% linger duration.';
      return '+40% cloud lifetime.';
    },
    genericDesc: '+40% duration — freeze, cloud lifetime, or a beam\'s own linger window.',
    delta: () => ({ duration: 0.4 }),
  },
  velocity: {
    name: 'Velocity',
    icon: '💨',
    // Only things that travel have a travel speed. A beam is
    // instantaneous (Phase 6C-2 S2.1) — no travel time to raise, so it
    // stays excluded here with no change needed.
    supports: (d) => d === 'projectile' || d === 'orbital',
    desc: (d) => (d === 'orbital' ? '+35% orbit speed.' : '+35% projectile speed.'),
    genericDesc: '+35% travel speed. Only legal on projectile weapons or Orbiting Blades.',
    delta: () => ({ velocity: 0.35 }),
  },
  attunement: {
    name: 'Attunement',
    icon: '🔮',
    supports: ALWAYS,
    desc: () => '+3% damage per enhancement point invested in this weapon.',
    genericDesc: '+3% damage per enhancement point already invested in the weapon this sockets into.',
    delta: (points) => ({ damage: points * 0.03 }),
  },
};

export function isAmplifierGem(kind: GemKey): kind is AmplifierGemKey {
  return kind in AMPLIFIER_GEM_DEFS;
}

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S6): the fourteen
// Behaviour gems. Per the owner's 2026-08-09 call, **no refusals** — every
// gem has a reading on every archetype, so `supports` is always true and
// there is no `AmplifierGemDef`-style per-archetype legality gate here.
//
// **Mechanical honesty, stated once rather than fourteen times:** the
// nine gems built on RESOLVE (Splash, Overflow, Kickback, Priming) or
// pure firing-time logic (Homing, Multishot, Formation, Echo, Barrage)
// are REAL on every archetype — clearAt and the emission queue are both
// archetype-agnostic, so wiring them into resolveOpts once covers all
// five. The remaining four (Fork, Chaining, Bounce, Ricochet) are REAL
// on the `projectile` archetype only in this batch (systems/projectiles.ts's
// behaviour flags) — their orbital/pulse/cloud/ring readings below are
// honest descriptions of the design's intent, not yet backed by code,
// because implementing them needs clearAt to report *which* coagulant a
// hit killed, not just how much mass moved, and threading that through
// its ~15 existing call sites is a larger, separate change. Flagged
// exactly the way this project flags every other preserved gap (see
// Immolation Ring's BACKLOG entry) rather than silently shipped or
// silently refused.
export interface BehaviourGemDef {
  readonly name: string;
  readonly icon: string;
  readonly desc: (delivery: DeliveryKind) => string;
  readonly genericDesc: string;
}

export const BEHAVIOUR_GEM_DEFS: Readonly<Record<BehaviourGemKey, BehaviourGemDef>> = {
  echo: {
    name: 'Echo',
    icon: '🔁',
    desc: () => 'Fires again shortly after, at reduced power.',
    genericDesc: 'Fires again shortly after, at reduced power. Works the same on every weapon.',
  },
  barrage: {
    name: 'Barrage',
    icon: '💢',
    desc: () => 'One shot becomes a rapid burst of smaller ones — a trap against flat armour reduction, on purpose.',
    genericDesc: 'One shot becomes a rapid burst of smaller ones. Many small hits are shredded by flat armour reduction — the exact inverse of Detonation.',
  },
  overflow: {
    name: 'Overflow',
    icon: '💧',
    desc: () => 'Overkill damage on a coagulant carries to the next nearest instead of being wasted.',
    genericDesc: 'Overkill damage on a coagulant carries to the next nearest instead of being wasted. Coagulant-only.',
  },
  splash: {
    name: 'Splash',
    icon: '🌊',
    desc: (d) => {
      if (d === 'orbital') return 'Blade hits gain a small area of effect.';
      if (d === 'beam') return 'The beam\'s edges land nearly as hard as its centre line.';
      return 'The rim of the hit lands nearly as hard as the centre.';
    },
    genericDesc: 'Flattens the falloff from centre to edge — distinct from Expansion (bigger radius, same shape).',
  },
  kickback: {
    name: 'Kickback',
    icon: '👊',
    desc: () => 'Every hit shoves the coagulant it hits outward.',
    genericDesc: 'Every hit shoves the coagulant it hits outward, away from where it landed.',
  },
  priming: {
    name: 'Priming',
    icon: '🎯',
    desc: () => 'The first hit on a coagulant not hit in the last couple of seconds deals far more.',
    genericDesc: 'The first hit on a coagulant not hit recently deals far more. Rewards spreading fire over fixating on one target. Coagulant-only.',
  },
  homing: {
    name: 'Homing',
    icon: '🧲',
    desc: (d) => {
      if (d === 'projectile') return 'Steers toward its target as it flies.';
      if (d === 'orbital') return 'Blades bias toward the side of the arena under the most threat.';
      if (d === 'cloud') return 'The cloud drifts toward the nearest mass instead of sitting still.';
      // Phase 6C-2 (docs/plans/phase-6c2-lance.md S2.2): honest no-op on
      // beam, the same pattern Missile's own Homing already established —
      // Lance's ACQUIRE always targets the biggest coagulant in range
      // (highestMassPoint), so there's nothing left for this to bias.
      if (d === 'beam') return 'No effect — the beam already targets the largest threat in range.';
      return "The pulse's centre offsets toward the densest nearby threat."; // pulse, ring
    },
    genericDesc: 'Biases this weapon toward the threat — the specific reading depends on the weapon it sockets into.',
  },
  multishot: {
    name: 'Multishot',
    icon: '✳️',
    desc: (d) => {
      if (d === 'projectile') return '+2 projectiles in a spread, each at reduced power.';
      if (d === 'orbital') return '+2 blades, each at reduced power.';
      if (d === 'cloud') return '+2 smaller clouds around the target point.';
      if (d === 'beam') return '+2 beams at diverging angles, each at reduced power.';
      return '+2 smaller pulses offset around the tower.'; // pulse, ring
    },
    genericDesc: '+2 emissions at reduced power each — more projectiles, blades, clouds, or pulses depending on the weapon.',
  },
  formation: {
    name: 'Formation',
    icon: '🔷',
    desc: (d) => {
      if (d === 'projectile') return 'Extra shots arrange in a fixed ring around the target instead of scattering.';
      if (d === 'orbital') return 'Blades lock to a fixed arc instead of spreading evenly.';
      if (d === 'cloud') return 'Extra clouds land in a fixed pattern instead of scattering.';
      if (d === 'beam') return 'Extra beams lock to fixed diverging angles instead of scattering.';
      return 'Extra pulses arrange at a fixed radius instead of scattering.'; // pulse, ring
    },
    genericDesc: 'Like Multishot, but the extra emissions land in a fixed pattern instead of scattering randomly.',
  },
  pierce: {
    name: 'Pierce',
    icon: '⚡',
    desc: (d) => {
      if (d === 'projectile') return 'Passes through targets instead of stopping.';
      if (d === 'orbital') return 'No per-blade hit cooldown — never stopped by what it cuts.';
      return 'Ignores density resistance — full power into thick tissue.'; // pulse, cloud, ring
    },
    genericDesc: 'Ignores whatever normally blunts this weapon\'s hit — armour of a different kind depending on the weapon.',
  },
  // Fork/Chaining/Bounce/Ricochet: mechanically real on `projectile`
  // (systems/projectiles.ts's behaviour flags — Bolt, Chain, Missile).
  // Their orbital/pulse/cloud/ring text below describes the design's
  // intended reading honestly, per the owner's no-refusal call, but the
  // mechanism isn't wired up on those archetypes yet — see the class
  // comment above and docs/BACKLOG.md. Not disclosed in the copy itself
  // (that would read as an unfinished-game admission mid-run); disclosed
  // in the project record instead, same as every other preserved gap
  // this project has shipped with (Immolation Ring's balance gaps).
  fork: {
    name: 'Fork',
    icon: '🍴',
    desc: (d) => {
      if (d === 'projectile') return 'Splits into 2 on first impact, each carrying half power.';
      if (d === 'orbital') return 'A hit sheds a small projectile that continues on its own.';
      return 'Splits into two on a kill, each continuing outward.'; // pulse, cloud, ring
    },
    genericDesc: 'One becomes two — the split reads differently depending on the weapon.',
  },
  chaining: {
    name: 'Chaining',
    icon: '🔗',
    desc: (d) => {
      if (d === 'projectile') return 'Arcs to a nearby target (grid or coagulant) after resolving.';
      if (d === 'orbital') return 'A hit arcs to a nearby target.';
      return 'Reaches past its own limit to something beyond it.'; // pulse, cloud, ring
    },
    genericDesc: 'Reaches onward past what this weapon would normally touch.',
  },
  bounce: {
    name: 'Bounce',
    icon: '🪀',
    desc: (d) => {
      if (d === 'projectile') return 'Ricochets between coagulants specifically, rather than stopping.';
      if (d === 'orbital') return 'A hit jumps the blade to a different orbit radius.';
      return 'Re-emits from whatever it just hit.'; // pulse, cloud, ring
    },
    genericDesc: 'Re-emits from what it hits, coagulant to coagulant.',
  },
  ricochet: {
    name: 'Ricochet',
    icon: '↩️',
    desc: (d) => {
      if (d === 'projectile') return 'Reverses once along its path, damaging again.';
      if (d === 'orbital') return 'Blades periodically reverse orbit direction, re-sweeping ground.';
      return 'A second pass, back the way it came.'; // pulse, cloud, ring
    },
    genericDesc: 'A second pass, back the way it came.',
  },
};

export function isBehaviourGem(kind: GemKey): kind is BehaviourGemKey {
  return kind in BEHAVIOUR_GEM_DEFS;
}

// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md): the seven
// Targeting gems. Unlike Amplifier (a numeric delta) or Behaviour (a
// RESOLVE/projectile-flag effect), a Targeting gem replaces a weapon's
// ACQUIRE stage wholesale (systems/targetingGems.ts's targetingAcquire) —
// there is no `delta` field here because "what to aim at" isn't a number
// to scale.
//
// `supports` is per-archetype like Amplifier's, not the Behaviour class's
// always-true — Targeting gems have real refusals (plan S1): a weapon
// with no ACQUIRE stage has nothing for most of these to replace, unless
// the reading is re-expressed as something an aura CAN do (below).
//
// Two gems keep a real refusal on self-centered archetypes because there
// is genuinely nothing to reinterpret without duplicating Homing (Field
// Priority's "densest region" IS Homing's own pulse/ring reading;
// Opportunist's "wherever was hit last" has no aim point on a weapon that
// never aims). The other five get an honest aura-specific reading instead
// of a refusal — see each `desc` below for what that reading actually is.
//
// Vigilance is additionally refused on `orbital` specifically (Blades) —
// not in the original plan's table, found while implementing: Blades'
// orbit radius already floors at `perimeter + margin`
// (tuning/weaponGeometry.ts's towerCenteredRadius), so the blade's own
// center is structurally never inside the perimeter. "Only outside the
// perimeter" would be a guaranteed no-op there, not a real choice — the
// same silent-inert failure this whole batch exists to catch, just found
// during the build instead of after. See docs/plans/phase-6d1-targeting-gems.md
// S10 (as-built) for the full reasoning.
export interface TargetingGemDef {
  readonly name: string;
  readonly icon: string;
  readonly supports: (delivery: DeliveryKind) => boolean;
  readonly desc: (delivery: DeliveryKind) => string;
  readonly genericDesc: string;
}

const AURA_DELIVERIES: readonly DeliveryKind[] = ['orbital', 'pulse', 'ring'];
const isAuraDelivery = (d: DeliveryKind): boolean => AURA_DELIVERIES.includes(d);
const NOT_ORBITAL = (d: DeliveryKind): boolean => d !== 'orbital';
const TARGETED_ONLY = (d: DeliveryKind): boolean => d === 'projectile' || d === 'beam';

export const TARGETING_GEM_DEFS: Readonly<Record<TargetingGemKey, TargetingGemDef>> = {
  threatPriority: {
    name: 'Threat Priority',
    icon: '🔺',
    supports: ALWAYS,
    desc: (d) => (isAuraDelivery(d) ? 'Deals bonus damage to the single highest-mass coagulant it hits.' : 'Targets the highest-mass coagulant in range.'),
    genericDesc: 'Prioritizes the biggest threat — the highest-mass coagulant, or bonus damage to it on a weapon with no aim.',
  },
  fieldPriority: {
    name: 'Field Priority',
    icon: '🌐',
    supports: TARGETED_ONLY,
    desc: () => 'Targets the densest revealed ground in range, not just whatever is nearest.',
    genericDesc: 'Targets the densest ground in range. Only legal on weapons that aim — this is Homing\'s own reading on a ring or aura, so it would just duplicate that gem there.',
  },
  breachPriority: {
    name: 'Breach Priority',
    icon: '⛓️',
    desc: (d) => (isAuraDelivery(d) ? 'Deals bonus damage to whichever coagulant it hits is closest to the core.' : 'Targets the deepest ground incursion toward the core, ignoring any coagulant that happens to be closer.'),
    supports: ALWAYS,
    genericDesc: 'Prioritizes the deepest threat toward the core — a ground breach on a weapon that aims, or bonus damage to the closest hit on a weapon that doesn\'t.',
  },
  vigilance: {
    name: 'Vigilance',
    icon: '🛡️',
    supports: NOT_ORBITAL,
    desc: (d) => {
      if (d === 'projectile' || d === 'beam') return 'Never targets anything inside the perimeter.';
      return 'Never damages anything inside the perimeter — the near field is untouched, on purpose.';
    },
    genericDesc: 'Refuses the near field entirely, only outside the perimeter. Not legal on Orbiting Blades — its orbit never reaches inside the perimeter in the first place, so this would do nothing there.',
  },
  fixation: {
    name: 'Fixation',
    icon: '📌',
    supports: ALWAYS,
    desc: (d) => (isAuraDelivery(d) ? 'Keeps its bonus damage on the same coagulant across hits, until it dies.' : 'Locks onto one coagulant and stays on it until it dies.'),
    genericDesc: 'Commits to one target until it dies, instead of re-evaluating every shot. The mirror of Priming, which rewards spreading fire.',
  },
  triage: {
    name: 'Triage',
    icon: '🩹',
    supports: ALWAYS,
    desc: (d) => (isAuraDelivery(d) ? 'Deals bonus damage to the single lowest-mass coagulant it hits.' : 'Targets the weakest (lowest-mass) coagulant in range.'),
    genericDesc: 'Prioritizes finishing off the weakest threat instead of the biggest one — the inverse of Threat Priority.',
  },
  opportunist: {
    name: 'Opportunist',
    icon: '👁️',
    supports: TARGETED_ONLY,
    desc: () => 'Targets wherever another weapon last landed a hit, riding its momentum instead of picking independently.',
    genericDesc: 'Targets wherever damage last landed, from any weapon. Only legal on weapons that aim — a weapon with no aim point has nothing to redirect.',
  },
};

export function isTargetingGem(kind: GemKey): kind is TargetingGemKey {
  return kind in TARGETING_GEM_DEFS;
}

// Phase 6D-2 (docs/plans/phase-6d2-conditional-gems.md): the nine
// Conditional gems — every one a RESOLVE-stage damage multiplier or
// debuff (grid/clear.ts's ClearOptions), legal on every weapon. Unlike
// Amplifier or Targeting, there is no `supports` gate here: none of these
// nine reads anything archetype-specific (delivery shape, aim, orbit) —
// only target state (mass, maturity, density, armour) or player state
// (core HP, hit streak) — so `gemSupportsDelivery` falls through to the
// same `true` Behaviour gems get, below.
export interface ConditionalGemDef {
  readonly name: string;
  readonly icon: string;
  readonly desc: string;
  readonly genericDesc: string;
}

export const CONDITIONAL_GEM_DEFS: Readonly<Record<ConditionalGemKey, ConditionalGemDef>> = {
  penetration: {
    name: 'Penetration',
    icon: '🗡️',
    desc: 'Ignores a flat amount of the target\'s armour, capped.',
    genericDesc: 'Ignores armour up to a cap — the counter to a coagulant\'s own armour, which rises over the course of a run.',
  },
  virulence: {
    name: 'Virulence',
    icon: '🧬',
    desc: 'Bonus damage against high-maturity (scarred) ground.',
    genericDesc: 'Rewards fighting the hardest terrain instead of avoiding it — bonus damage scales with how scarred the ground already is.',
  },
  saturation: {
    name: 'Saturation',
    icon: '💦',
    desc: 'Bonus damage scaled by how dense the ground is at the hit.',
    genericDesc: 'Pays you for hitting dense tissue instead of only being blunted by it — distinct from Pierce, which ignores the density penalty rather than reversing it.',
  },
  giantSlayer: {
    name: 'Giant-Slayer',
    icon: '🏔️',
    desc: 'Bonus damage against high-mass coagulants.',
    genericDesc: 'Scales up against the biggest threats on the field — full bonus at behemoth mass and up.',
  },
  culling: {
    name: 'Culling',
    icon: '🔪',
    desc: 'Bonus damage against low-mass coagulants, and instantly finishes ones already near death.',
    genericDesc: 'The inverse of Giant-Slayer — rewards mopping up the small stuff instead of leaving it to pile up, and finishes off anything already reduced to a sliver of its own starting mass.',
  },
  corrosion: {
    name: 'Corrosion',
    icon: '☣️',
    desc: 'Hits strip a fraction of the target\'s armour for a few seconds.',
    genericDesc: 'A universal armour strip, not just Poison\'s speciality — matters once armour actually scales with time (6D-0).',
  },
  desperation: {
    name: 'Desperation',
    icon: '💢',
    desc: 'Bonus damage that rises the lower the core\'s own health drops.',
    genericDesc: 'A comeback mechanic — reads current HP, not max, so it\'s inert at full health and strongest right when the run is in danger.',
  },
  proximity: {
    name: 'Proximity',
    icon: '🎯',
    desc: 'Bonus damage the closer this hit lands to the core.',
    genericDesc: 'Rewards defending the near field specifically — the aura weapons\' own zone, after 6D-0\'s reach fix put them there.',
  },
  momentum: {
    name: 'Momentum',
    icon: '📈',
    desc: 'Damage ramps while landing hits in a row; resets on a miss or a kill.',
    genericDesc: 'Rewards sustained pressure on a target over finishing it off — the mirror of Priming, which rewards spreading fire instead.',
  },
};

export function isConditionalGem(kind: GemKey): kind is ConditionalGemKey {
  return kind in CONDITIONAL_GEM_DEFS;
}

// The archetype-aware description, read once a gem is sitting in a
// specific weapon's socket (the inventory screen).
export function gemDesc(kind: GemKey, delivery: DeliveryKind): string {
  if (isAmplifierGem(kind)) return AMPLIFIER_GEM_DEFS[kind].desc(delivery);
  if (isTargetingGem(kind)) return TARGETING_GEM_DEFS[kind].desc(delivery);
  if (isConditionalGem(kind)) return CONDITIONAL_GEM_DEFS[kind].desc;
  return BEHAVIOUR_GEM_DEFS[kind as BehaviourGemKey].desc(delivery);
}

// The archetype-neutral description, read on the level-up card before the
// gem has a weapon at all (docs/plans/phase-6a1-gem-foundation.md S6a).
export function gemGenericDesc(kind: GemKey): string {
  if (isAmplifierGem(kind)) return AMPLIFIER_GEM_DEFS[kind].genericDesc;
  if (isTargetingGem(kind)) return TARGETING_GEM_DEFS[kind].genericDesc;
  if (isConditionalGem(kind)) return CONDITIONAL_GEM_DEFS[kind].genericDesc;
  return BEHAVIOUR_GEM_DEFS[kind as BehaviourGemKey].genericDesc;
}

export function gemName(kind: GemKey): string {
  if (isAmplifierGem(kind)) return AMPLIFIER_GEM_DEFS[kind].name;
  if (isTargetingGem(kind)) return TARGETING_GEM_DEFS[kind].name;
  if (isConditionalGem(kind)) return CONDITIONAL_GEM_DEFS[kind].name;
  return BEHAVIOUR_GEM_DEFS[kind as BehaviourGemKey].name;
}

export function gemIcon(kind: GemKey): string {
  if (isAmplifierGem(kind)) return AMPLIFIER_GEM_DEFS[kind].icon;
  if (isTargetingGem(kind)) return TARGETING_GEM_DEFS[kind].icon;
  if (isConditionalGem(kind)) return CONDITIONAL_GEM_DEFS[kind].icon;
  return BEHAVIOUR_GEM_DEFS[kind as BehaviourGemKey].icon;
}

// Behaviour and Conditional gems have no refusals — every archetype gets
// a real reading (Behaviour: the class comment above explains where the
// mechanism isn't wired up yet even so; Conditional: none of the nine
// reads anything archetype-specific in the first place). Targeting gems
// DO have refusals (see TARGETING_GEM_DEFS's own comment).
export function gemSupportsDelivery(kind: GemKey, delivery: DeliveryKind): boolean {
  if (isAmplifierGem(kind)) return AMPLIFIER_GEM_DEFS[kind].supports(delivery);
  if (isTargetingGem(kind)) return TARGETING_GEM_DEFS[kind].supports(delivery);
  return true;
}

// Every gem that can actually be drawn, socketed or rendered.
export const ALL_GEM_KEYS: readonly GemKey[] = [
  ...(Object.keys(AMPLIFIER_GEM_DEFS) as GemKey[]),
  ...(Object.keys(BEHAVIOUR_GEM_DEFS) as GemKey[]),
  ...(Object.keys(TARGETING_GEM_DEFS) as GemKey[]),
  ...(Object.keys(CONDITIONAL_GEM_DEFS) as GemKey[]),
];
