# Phase 6D-0 — the balance-shape pass

**Status:** planned, greenlit as part of the full 6D batch (2026-08-10).
**Umbrella:** `docs/plans/phase-6d-conditional-targeting-gems.md`
(findings and reasoning; this document is the build).
**Ships:** tuning constants only. No new mechanism, no new content, no
new gems.

> **Why this is first.** Every other 6D batch adds damage-affecting
> content. Shipping 16 gems onto a difficulty curve that flattens at nine
> minutes makes the late game worse before it makes it better, and it
> makes the next playtest unreadable — nobody could tell which change
> caused what.

---

## 1. What this fixes

Four findings from the post-gate playtest, all confirmed against the
tuning constants (umbrella §1, §2, §4c, §5):

1. **The threat plateaus.** Ambient escalation caps at 3.1× at t=560s;
   event frequency at 2.6× at t=420s. Player power is uncapped.
2. **The opening is ~10% too hard** (owner's calibration).
3. **Aura weapons are aimed at vacuum** — parked at 100–115px, where the
   ambient growth ramp is 0.056–0.096 against 0.49 at 400px.
4. **Armour is inconsequential** — flat 20 max, against level-8 hits of
   44–313.

## 2. The escalation curve

**`tuning/growth.ts`.** Replace the bounded `AMBIENT_ESCALATION`
breakpoint table with an unbounded curve. The table's shape over the
first nine minutes is preserved — it was tuned by playtest and the owner
says mid-game is right — and only its termination changes.

```
ambientInfectionMult(t) = tableShape(t) × LATE_GROWTH ^ (t / 60)
```

- `tableShape(t)` keeps the existing breakpoints, so t < 560s is
  substantially unchanged.
- `LATE_GROWTH` ≈ **1.05 per minute**, first draft — doubles roughly
  every 14 minutes, forever.

**`tuning/events.ts`.** `eventSpawnInterval` currently lerps 18s → 7s and
stops at t=420s. Continue past the ramp toward an asymptotic hard floor
of **3s**, never below — the floor protects the simulation, not the
difficulty.

**Guard:** a test asserting `ambientInfectionMult` is strictly increasing
at t = 600, 1200, 2400s, and that `eventSpawnInterval` never returns
below the floor. Both are outcome tests (does it keep climbing?), not
mechanism tests pinning a coefficient.

## 3. The opening, by ~10%

`AMBIENT_BASE` 0.02 → **0.018**, `CREEP_RAMP` 0.035 → **0.032**.

**Order matters here.** §4's aura fix is itself a large early-game buff,
and the owner's 10% reading predates it. Ship both, then re-judge the
opening in the playtest rather than cutting it twice. If the opening ends
up too *easy*, this section is the first thing to revert — it's two
constants.

## 4. The aura fix (the main event)

`tuning/weapons.ts` and `weapons/blades.ts`. The reach terms only —
`towerCenteredRadius()` and the perimeter floor are untouched, so
DECISIONS #16 and documented prototype bug #5 are not reopened. This
raises the *other* term of the `max()`, which is what the struct exists
to allow.

| Weapon | Field | From | To |
|---|---|---|---|
| Immolation | `IMMOLATION_REACH.base` | 66 | **190** |
| Immolation | `IMMOLATION_REACH.perLevel` | 6 | **18** |
| Frost | `FROST_REACH.base` | 115 | **210** |
| Frost | `FROST_REACH.perLevel` | 12 | **20** |
| Blades | `BLADE_REACH.base` | 64 | **165** |
| Blades | `BLADE_REACH.perLevel` | 2 | **14** |
| Blades | `HIT_RADIUS` (blades.ts) | 16 | **26** |
| Blades | `bladeCount` at lv1 | 1 | **2** |

**No aura damage changes.** `clearAt` applies `power` per cell, so
Immolation and Frost already out-clear the projectiles per shot (umbrella
§4c) — the earlier "raise Frost/Shockwave damage" proposal was aimed at a
stat that was already winning, and is withdrawn.

**Blades is the exception** and gets the two extra edits above: it is the
one aura genuinely below Bolt on throughput (0.7×), because its hit disc
is 16px and its `perLevel: 2` never once cleared the floor at any level.

## 5. The weapon spread

**Nerf, per the owner's "both ends" call:**
- **Chain Bolt** — the outlier at 496 DPS at level 8, ~2× the field.
  `chainDamage` 11 + 4/lvl → **9 + 3/lvl**, and `chainCount` cap 6 → **5**.
  Two small cuts rather than one large one, so neither the fork fantasy
  nor the damage identity is gutted.
- **Fission Charge** — `fissionCount` cap 9 → **7**. Its raw DPS is mid-
  pack; the outlier is *area* (nine independent blast discs), so the count
  is the honest lever, not the damage.

**Raise:**
- **Shockwave** — excluded from §4 (it already travels outward from the
  floor, so reach is fine). Its weakness is band thickness:
  `SHOCKWAVE_SPEED` 260 → **210**, which thickens the swept band per tick,
  plus `shockwaveDamage` 12 + 4.5/lvl → **17 + 6/lvl**.

## 6. Armour

`tuning/coagulants.ts`.

- `ARMOR_AT_FULL_MATURITY` 20 → **35**.
- Add a time term so armour joins the escalation rather than capping at
  full maturity.

**⚠️ Bounded, not unbounded — the one place this plan narrows a settled
call.** `effectivePower = max(power - armor, power × 0.15)`, so unbounded
armour drives *every* weapon onto the 15% floor: weapon damage stops
distinguishing anything and Penetration stops working, since it subtracts
from a value already past the floor. On the numbers, Lance reaches the
floor around 25 minutes and Chain's forks around 8.

**Therefore:** armour's time scaling is capped where the best-hitting
weapon still keeps ~50% of its damage, and **the unbounded half of the
difficulty curve is carried by §2's ambient and event escalation** —
which drive coagulant count and mass, and have no such degeneracy.

Raised with the owner (umbrella §8 Q1) rather than applied silently, per
`CLAUDE.md`'s ground-truth protocol. **If the owner prefers literal
unbounded armour, §2's escalation should be softened to compensate** —
they are the same difficulty budget spent two ways.

## 7. Tests

Outcome tests over mechanism tests (Decision 20), because every number
here is expected to move:

1. **The curve keeps climbing** — `ambientInfectionMult` strictly
   increasing at 10/20/40 minutes; `eventSpawnInterval` monotonically
   non-increasing and never below its floor.
2. **The aura floor rule** (umbrella §4b) — a level-1 all-aura deck
   (Blades + Frost + Immolation, no gems, no extensions) survives the
   opening N minutes of simulated ticks. This is the test that would have
   caught the original bug, and it is the batch's most important guard.
3. **Aura engagement** — each aura weapon's radius at level 1 sits in a
   region whose ambient growth rate exceeds a floor, expressed against
   `growth.ts`'s own ramp rather than a hardcoded radius, so a later
   retune of `PERIMETER` or `outerSpan` can't silently re-park them in
   vacuum.
4. **Armour never degenerates** — no weapon's effective damage against
   max-armour targets falls to the `COAGULANT_ARMOR_FLOOR` at any time
   value the curve can produce. This is the guard for §6's whole argument.
5. **Blades' reach actually responds to level** — a regression guard for
   the dead `perLevel` term: radius at level 8 must exceed radius at
   level 1.

## 8. Order of work

1. Tests 1, 3, 4, 5 first — they fail against current code, which proves
   they test something.
2. §2 escalation, §3 opening.
3. §4 aura reach (the main event), then test 2.
4. §5 spread, §6 armour.
5. Full suite, typecheck, build.
6. **Playtest before 6D-1.** This batch is the one whose result changes
   what the others should be.

## 9. Decision records this generates

- **Unbounded ambient/event escalation** supersedes the bounded
  `AMBIENT_ESCALATION` table and the event-interval floor as the
  difficulty model.
- **Time-scaled, bounded armour** extends Decision 44's flat-subtraction
  model without replacing it, and records the degeneracy argument so
  nobody "fixes" the bound away later.
- **The aura floor rule** (umbrella §4b) as a standing design constraint.

## 10. As-built delta

*To be filled in when this ships.*
