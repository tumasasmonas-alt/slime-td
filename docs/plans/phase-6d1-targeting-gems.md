# Phase 6D-1 — the Targeting gems

**Status:** planned, greenlit as part of the full 6D batch (2026-08-10).
**Umbrella:** `docs/plans/phase-6d-conditional-targeting-gems.md` §4.
**Ships:** 7 Targeting gems (Scattershot cut), plus the ACQUIRE-stage
work they need to not be dead on half the roster.
**Depends on:** 6D-0 (balance), which should be playtested first.

---

## 1. ⚠️ The problem this batch has to solve first

`weapons/pipeline.ts:28`, written in Phase 5A, says it plainly:

> Stage 2 — ACQUIRE: what does it aim at? **Omitted for self-centered
> weapons (Blades, Frost, Immolation)** — there is nothing to acquire, the
> tower is always the origin. A Targeting gem (Phase 6) replaces this
> stage wholesale; **a weapon with no acquire stage has nothing for a
> Targeting gem to replace.**

**So all seven Targeting gems would ship dead on Blades, Frost,
Immolation and Shockwave** — four of ten weapons, and specifically the
four this session has spent its whole length trying to make worth taking.
This is the *same* defect as §4a's dead-gem audit, pre-baked into the
pipeline and scheduled to repeat.

Catching it before the build is the entire reason this document leads
with it.

### The resolution

**Not** "give auras a fake ACQUIRE." A symmetric ring genuinely has no
"what do you aim at" — inventing one would duplicate the Homing gem,
whose orbital reading is already *"blades bias toward the side of the
arena under the most threat."*

Instead, split the class by whether an honest reading exists:

| Gem | Aura reading | Verdict |
|---|---|---|
| **Vigilance** ("only outside the perimeter") | The aura's **inner edge** is pushed outward — it stops damaging the near field entirely. Real, and a genuine strategic commitment on a ring. | ✅ real on auras |
| **Breach Priority** ("the deepest incursion") | The aura's inner edge is pulled **inward**, prioritising whatever got closest. The mirror of Vigilance, and both are meaningful on a ring. | ✅ real on auras |
| **Threat Priority** ("highest-mass coagulant") | The aura deals bonus damage to the single highest-mass coagulant inside it — focus without aiming. | ✅ real on auras |
| **Triage** ("the weakest") | Same mechanism, inverted target selection. | ✅ real on auras |
| **Fixation** ("stay on one target until it dies") | The aura keeps its bonus on the same coagulant across ticks until it dies. | ✅ real on auras |
| **Field Priority** ("densest field region") | Would offset the aura's centre toward density — **this is Homing's pulse/ring reading verbatim.** | ❌ refused on auras |
| **Opportunist** ("whatever another weapon hit last") | Same problem — an aura has no aim point to redirect. | ❌ refused on auras |

**Refusals are honest and enforced at socket time**, exactly like
Velocity and Extension in the Amplifier class (`gemSupportsDelivery`) —
the gem cannot be socketed there, so it never lies. That mechanism already
exists and needs no new code.

Vigilance and Breach Priority as inner-edge modulation are the strongest
result here: they turn a Targeting gem into a real spatial decision on a
weapon that has no aim, and they interact directly with 6D-0's reach fix.

## 2. What ships

Seven gems. **Scattershot is cut** (umbrella §4) — every other gem in the
class is a strategy and that one is the absence of one; it reads as a
downgrade from nearest-wins rather than a trade.

| Gem | Targets | New state? |
|---|---|---|
| **Threat Priority** | the highest-mass coagulant | no |
| **Field Priority** | the densest field region | no |
| **Breach Priority** | the deepest incursion toward the core | no |
| **Vigilance** | only outside the perimeter | no |
| **Fixation** | stays on one target until it dies | per-weapon target id |
| **Triage** | the *weakest* coagulant | no |
| **Opportunist** | whatever another weapon hit most recently | **yes** — a shared last-hit record |

## 3. Mechanism

**One Targeting gem per weapon, enforced structurally.** The pipeline
already makes this natural: a Targeting gem *replaces* `acquire`, and you
cannot replace it twice. Socketing a second one is refused at socket time
with the same machinery as an illegal archetype.

**Threat Priority already exists.** Lance's `highestMassPoint()`
(`systems/targeting.ts`, 6C-2) is exactly this gem, hardcoded as the
weapon's identity. The gem must route through that same helper, and
Lance's own acquire should be re-expressed as "Threat Priority, built in"
rather than a parallel implementation — otherwise the two drift.

**New acquire functions needed** in `systems/targeting.ts`:
`densestFieldPoint()` (Field Priority), `deepestIncursionPoint()` (Breach),
`weakestCoagulantPoint()` (Triage), `outsidePerimeterPoint()` (Vigilance).
Each mirrors `highestMassPoint()`'s existing shape, including its
nearest-frontier fallback — **a weapon that does nothing for the first
ninety seconds is the failure 6C-2 already fixed once**, and every new
acquire inherits that fallback rather than rediscovering the problem.

**Opportunist** needs `state.lastHitPoint` (position + time), written by
`clearAt` or by each deliver. It is the only new state in the batch.

## 4. Tests

1. **Every gem is legal on exactly the archetypes it has a reading for**,
   and illegal on the rest — asserted per gem per archetype, so a future
   archetype (a seventh `DeliveryKind`) can't silently inherit a legality
   nobody chose. This is the guard the 6C `'beam'` work established.
2. **No Targeting gem is silently inert** — for each gem × each legal
   weapon, socketing it must change the acquired point (or the aura's
   damage distribution) versus not having it. **This is the test that
   would have caught the dead-gem class**, and it is the batch's most
   important guard.
3. **At most one Targeting gem per weapon**, refused at socket time.
4. **Every new acquire falls back** rather than returning null forever on
   an empty early-run field.
5. **Lance's identity is preserved** — Lance with no gems still targets
   highest-mass, after being re-expressed through the shared helper.

## 5. Order of work

1. Test 2's harness first (it fails for every gem before any exist).
2. The four new acquire functions + Lance's re-expression.
3. The five aura-legal readings (inner-edge modulation for Vigilance and
   Breach; focus-damage for Threat/Triage/Fixation).
4. The two refusals, via the existing `gemSupportsDelivery` path.
5. Opportunist's shared last-hit record, last — it is the only new state.

## 6. Risks

- **Vigilance and Breach as inner-edge modulation are a new mechanism**,
  not a target swap. They are the most interesting thing in the batch and
  the most likely to need a second pass after playtest.
- **Fixation vs the Priming gem is a deliberate anti-synergy** (one
  rewards focus, the other rewards spreading fire). That is a feature, but
  it should be legible in the copy or it will read as a bug.
- **Opportunist's shared record is a write from `clearAt`**, the hottest
  function in the game. It must be a single assignment, not an allocation.

## 7. As-built delta

**Shipped 2026-08-11.** Built largely as planned, with two real
deviations found while implementing — both narrow the plan's own table
rather than contradicting it, and both are recorded here rather than
silently reinterpreted (`CLAUDE.md`'s ground-truth protocol: raised, not
decided unilaterally, though these are implementation-level findings
within the scope of building this very batch, not disputes with an
already-shipped decision).

**Deviation 1 — Vigilance is also refused on `orbital` (Blades).** The
plan's §1 table lists Vigilance as real on every aura. Found while
implementing: Blades' orbit radius already floors at `perimeter + margin`
(`tuning/weaponGeometry.ts`'s `towerCenteredRadius`, Decision 16) — the
blade's own center is structurally never inside the perimeter. "Only
outside the perimeter" would therefore be a guaranteed no-op on Blades,
not a real choice — exactly the silent-inert failure §4 test 2 exists to
catch, just caught during the build instead of after. Vigilance now
refuses `orbital` the same way Field Priority and Opportunist refuse
`orbital`/`pulse`/`ring` — three refusals total, not two.

**Deviation 2 — Breach Priority's aura reading is a focus-damage bonus,
not a literal inner-edge pull.** §1's table describes it as "the aura's
inner edge is pulled inward, prioritising whatever got closest" — the
mirror of Vigilance's outward push. But a plain disc hit's inner edge is
already 0; there is nothing to pull further inward. Implemented instead as
bonus damage to whichever coagulant within the aura's radius is closest to
the tower — mechanically the same `focusTarget`/`focusBonus` machinery as
Threat Priority/Triage/Fixation, just keyed on proximity instead of mass.
This keeps the *thematic* mirror (Vigilance ignores the near field; Breach
Priority especially rewards it) without inventing a second mechanism.

**What shipped:**

1. **`types.ts`**: `TargetingGemKey` (7 keys), folded into `GemKey`.
2. **`tuning/gems.ts`**: `TARGETING_GEM_DEFS`, `isTargetingGem`, and every
   dispatch function (`gemDesc`/`gemGenericDesc`/`gemName`/`gemIcon`/
   `gemSupportsDelivery`/`ALL_GEM_KEYS`) extended to cover the class —
   card pool and inventory UI needed no changes beyond this, confirming
   `systems/cards.ts`'s pool-building is genuinely gem-class-agnostic.
3. **`systems/gemSockets.ts`**: `gemLegalFor` refuses a second Targeting
   gem on the same weapon, alongside its existing archetype/duplicate
   checks.
4. **`systems/targeting.ts`**: `highestMassPoint` refactored onto a new
   shared `bestCoagulant(state, x, y, maxRange, isBetter)` loop (behaviour
   unchanged, confirmed by Lance's existing tests still passing unmodified)
   plus four new acquire functions — `weakestCoagulantPoint`,
   `densestFieldPoint`, `deepestIncursionPoint`, `outsidePerimeterPoint` —
   each mirroring `highestMassPoint`'s nearest-frontier fallback except
   `outsidePerimeterPoint`, which returns `null` on purpose when nothing
   outside the perimeter qualifies (that's the gem working, not the
   "does nothing for 90 seconds" failure the others guard against).
5. **`systems/targetingGems.ts`** (new): the dispatch layer.
   `targetingAcquire(key, maxRangeFor, defaultAcquire)` wraps a weapon's
   ACQUIRE stage; `auraTargetingReading(state, key, originX, originY,
   radius)` gives the self-centered reading (a `ClearShape` for Vigilance,
   or a `focusTarget`/`focusBonus` pair for the other four legal-on-aura
   gems). Fixation's per-weapon lock (`state.fixationTarget`) is shared
   between both paths so a weapon's ACQUIRE-stage and aura-stage readings
   (were it ever legal on both, which no weapon currently is) couldn't
   drift.
6. **`grid/clear.ts`**: `ClearOptions.focusTarget`/`focusBonus` — a
   reference-equality bonus multiplier in the coagulant loop, no second
   damage path. `state.lastHitPoint` written (mutated in place, not
   reallocated) unconditionally at the top of every `clearAt` call, for
   Opportunist.
7. **`state.ts`**: `lastHitPoint`, `fixationTarget`, and three new
   `ShockwaveRing` fields (`vigilanceFloor`, `focusTarget`, `focusBonus`) —
   Shockwave's own damage happens per-tick in `systems/shockwave.ts`, not
   in its pipeline's `deliver`, so its aura reading is computed once at
   ring creation and carried on the entity rather than recomputed per
   tick.
8. **Every weapon wired**: `bolt`/`chain`/`poison`/`missile`/`fission`
   swap `acquire: frontierAcquire` for `acquire:
   targetingAcquire(key, ..., frontierAcquire)`; `lance`'s `lanceReady`
   routes its own `highestMassPoint` call through the same wrapper — "Threat
   Priority, built in," per the plan, now literally true rather than a
   parallel implementation; `frost`/`immolation`/`blades` call
   `auraTargetingReading` directly in `deliver`; `shockwave` computes it
   once at ring creation and `systems/shockwave.ts`'s tick loop reads the
   stored fields, clamping the travelling band's inner edge to
   `vigilanceFloor` (usually redundant with the ring's own perimeter-
   floored start, real once Implosion sends it travelling back inward).

**Tests:** legality matrix (all 7 gems × 6 archetypes, `tuning/gems.test.ts`);
the four new acquire functions plus their fallback behaviour
(`systems/targeting.test.ts`); the full dispatcher — every gem kind, both
paths, Fixation's persistence and re-target-on-death, Opportunist's
recency window (`systems/targetingGems.test.ts`, new file); the
at-most-one-per-weapon socket-time refusal (`systems/gemSockets.test.ts`);
and end-to-end wiring proofs in each weapon's own test file
(`bolt`/`frost`/`immolation`/`blades`/`lance`/`systems/shockwave`) —
Threat Priority/Triage's focus bonus tested as a **paired with/without-gem
mass-loss comparison**, not a loss-*ratio* comparison across different
masses (an early draft of these tests compared ratios and failed
correctly — a smaller coagulant loses a much larger fraction of its own
mass than a bigger one even with zero bonus, since a hit's absolute
damage is roughly mass-independent, so the ratio was measuring that
confound instead of the gem's actual effect). 731 tests pass; `tsc
--noEmit` clean.

**Not done this session, per the owner's instruction:** no live/browser
playtest — same departure as 6D-0's as-built delta records, continued
through this batch. 6D-1 was built immediately after 6D-0 without the
playtest 6D-0's own plan called for in between.
