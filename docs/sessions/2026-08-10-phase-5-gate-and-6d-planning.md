# Session record — 2026-08-10 (evening, second machine)
## The Phase 5 gate passes, and Phase 6D grows from "19 gems" into a four-batch balance-and-honesty pass

**Type:** review + playtest debrief + planning. No code shipped.
**Participants:** project owner + Claude.
**Outcome:** the Phase 5 gate closed (Decision 87); Phase 6D fully
planned as four sub-batches, all greenlit; **four structural defects found
by reading tuning constants against shipped code**, none of which were
visible from the design documents.

> **Why this file exists.** The batch that was scoped as "add 19 gems"
> ended as "fix the difficulty curve, fix the aura weapons, fix six
> shipped gems that don't work, then add 16 gems." Every one of those
> additions came from checking a number rather than accepting a document.
> The *method* is the transferable part, and this session is the clearest
> example of it the project has.

---

## Table of contents

1. [The gate](#1-the-gate)
2. [The playtest report, and what the constants said](#2-the-playtest-report-and-what-the-constants-said)
3. [The aura finding, and one wrong answer on the way](#3-the-aura-finding-and-one-wrong-answer-on-the-way)
4. [The dead-gem audit](#4-the-dead-gem-audit)
5. [The owner's correction: named, not designed](#5-the-owners-correction-named-not-designed)
6. [Two traps caught before the build](#6-two-traps-caught-before-the-build)
7. [What was settled](#7-what-was-settled)
8. [What's next](#8-whats-next)

---

## 1. The gate

The Phase 5 gate — open since 5C, moved three times (after 5C → 6A → 6B →
6C) — ran against the post-6C build and **passed on both verdicts**:

- *"Is enhancement a decision or a slider?"* → **a decision.** The
  socketing loop is sound as designed. Closed.
- **The 65-gem count** → **go, unchanged**, so 6D ships its full slate.
  Trimming, and slicing 6D into a Targeting-only 6D-1 to judge first, were
  both offered and declined.

Recorded as Decision 87. The bugs that same playtest found had already
shipped separately as Decision 86.

## 2. The playtest report, and what the constants said

The owner's report: *"the game resists and is a bit too difficult at the
start but later on it's way too easy"* — later calibrated to *"like 10
percent too hard at the start."*

Reading `tuning/` confirmed this is structural, not coefficient noise.
**Every threat axis is a ramp that flattens:**

| Axis | Start → end | Stops climbing |
|---|---|---|
| Ambient infection | 1.0× → 3.1× | t = 560s |
| Event frequency | 18s → 7s interval | t = 420s |
| Coagulant mass | inherits ambient | inherits the cap |
| **Armour** | `maturity × 20`, maturity caps at 1 | immediately |

Player power is uncapped: levels, +45%-each Amplifier gems across five
sockets × three weapons, 40 extensions, three core slots.

**This is the same finding as the 2026-08-05 playtest** — which measured
player power scaling 17–21× against the infection's 3.1× and concluded
"no value of `CONTACT_SCALE` was right at both ends." It was never fixed;
it was absorbed into the rework, which changed *what generates* the threat
without changing the fact that its escalation terminates.

**The 2026-08-10 difficulty pass made the reported symptom worse, and
predictably.** It raised each axis's *base* 30–40% while explicitly
preserving ramp shape (both `growth.ts` and `events.ts` say so in
comments). Raising the base of a plateauing curve makes the start harder
and leaves the plateau exactly as far below the player. That is precisely
"too hard at the start, too easy later."

## 3. The aura finding, and one wrong answer on the way

The owner reported the aura weapons (Blades, Immolation, Frost) as so weak
they're avoided, then added two constraints: they should be *stronger by
default* because taking them is a risk, and *"if I run all aura weapons I
die."*

**The first answer was wrong and is recorded because it was wrong.** The
plan initially proposed raising Frost's and Shockwave's damage. Then
`clearAt` was read properly: it applies `power` **per cell**, so radius is
not a divisor — a bigger radius removes strictly more mass. Ranking level-1
field throughput (`power × radius² ÷ cooldown`):

| Weapon | Lv1 throughput | vs Bolt |
|---|---|---|
| Immolation | ~136,000 | **7.4×** |
| Frost | ~50,000 | 2.7× |
| Bolt | ~18,400 | 1.0× |
| Blades | ~12,200 | 0.7× |

**Two of the three "weak" weapons already out-clear the projectiles at
level 1 by a wide margin.** The damage buff was aimed at a stat that was
already winning, and was withdrawn.

The actual cause is location. `systems/growth.ts:72-79`: ambient growth is
not a front creeping inward — density rises **everywhere at once**, at a
rate ramped by distance from the core, `((d - perimeter) / outerSpan)^0.6`,
floored at `CREEP_RAMP`:

| Distance | Local ambient rate |
|---|---|
| 100px (Immolation, Blades) | 0.056 |
| 115px (Frost) | 0.096 |
| 250px | 0.31 |
| 400px | 0.49 |
| 1000px | 0.91 |

And `towerCenteredRadius()` floors every aura at `perimeter + margin`,
with `PERIMETER` fixed at 90 since Decision 38. **Orbiting Blades' radius
is 105px at level 1, at level 8, and at level 12** — its `perLevel: 2`
term has never once cleared the floor. Immolation clears its own only at
level 7.

**The aura weapons are parked in the one annulus the design guarantees is
nearly empty**, and `applyCellDamage` early-returns on any cell below
0.001 density. They are not under-powered; they are aimed at vacuum. An
all-aura deck dies because it never engages.

So the fix is **reach**, via the `base`/`perLevel` terms
`TowerCenteredReach` exists to allow (*"the anchor is a FLOOR, not a
lock"*) — DECISIONS #16 and documented prototype bug #5 untouched. Blades
alone also needs damage-side help (16px hit disc, level-1 blade count),
being the one aura genuinely below Bolt.

## 4. The dead-gem audit

The owner asked for the review to cover **all** shipped support gems, not
just the Multishot example they'd raised. Audited against code rather than
descriptions:

- **Fork, Chaining, Bounce and Ricochet are wired into Bolt Turret
  alone.** `systems/resolveOpts.ts` exposes `projectileFlags()`; exactly
  one weapon module imports it. `chain.ts` and `missile.ts` push
  projectiles with no flags at all. `tuning/gems.ts:158` discloses these
  as *"projectile archetype only"* — **the reality is one weapon of ten.**
- **Multishot and Formation divide damage by emission count
  unconditionally**, making them **exactly zero** on Blades and a
  **downgrade** on Frost.
- **Six of twenty gems** are dead or worse on most of the roster.

The sharp version, and the reason this became its own batch: the gem
descriptions are not merely undisclosed, they are **wrong**. Socket Fork
into Frost and the screen promises a split that cannot happen. `gems.ts`'s
own comment argues against disclosing the gap in the copy because it
*"would read as an unfinished-game admission mid-run"* — defensible when
the gap was one batch old and scheduled, not defensible as a shipped
state.

**A gem description is a purchase decision.** Copy that describes intent
rather than behaviour is a bug with a UI.

## 5. The owner's correction: named, not designed

Mid-session, after the first plan draft:

> *"because you planned the balance phase and gem reality phase without
> actually thinking through what that means."*

Correct, and it changed the outcome. 6D-0 and 6D-3 existed as headings
with a sentence each. Designing them properly is what produced §3's
withdrawal of the damage buff (the first draft would have shipped it) and
§7a's finding that most of the "needs `clearAt` to report kills" blocker
is avoidable — every aura weapon already knows its own hit position, and
6A-2's deferred-emission queue already exists.

**The pattern is worth naming for future sessions:** a batch heading is
not a plan, and this project's own history (5A's pre-refactor audit found
six flags; 5C found a real bug in 5B's plumbing; 6C's cost argument was
half wrong) says the checking is where the findings are.

## 6. Two traps caught before the build

**Unbounded armour degenerates.** The owner's call was to raise armour and
let it scale with time, unbounded. But
`effectivePower = max(power - armor, power × 0.15)` — as armour grows
without limit, **every weapon converges on exactly 15% of its damage.** The
floor stops being a safety net and becomes the only term that matters:
weapon damage stops distinguishing anything, and Penetration stops working
because it subtracts from a value already past the floor. Lance reaches the
floor around 25 minutes, Chain's forks around 8. Raised per `CLAUDE.md`'s
ground-truth protocol rather than applied; the owner chose to bound it and
carry the unbounded half of the curve with ambient/event escalation, which
drives coagulant count and mass and has no such degeneracy.

**Targeting gems would have shipped dead on the aura weapons.**
`weapons/pipeline.ts:28`, written back in Phase 5A, says it outright:
*"Omitted for self-centered weapons (Blades, Frost, Immolation)... a weapon
with no acquire stage has nothing for a Targeting gem to replace."* All
seven Targeting gems would have been dead on four of ten weapons —
**the same defect as §4, pre-baked into the pipeline and scheduled to
repeat in the very next batch.** Resolved as five real aura readings
(Vigilance and Breach Priority modulate the aura's *inner edge*, a genuine
spatial choice on a weapon with no aim; Threat/Triage/Fixation add focus
damage) plus two honest refusals (Field Priority and Opportunist would
duplicate the Homing gem).

## 7. What was settled

| Question | Call |
|---|---|
| Difficulty shape | **Unbounded slow multiplier**, no cap |
| The opening | **~10% easier**, not a rollback — and re-judge after the aura fix, which is itself a large early buff |
| Weapon spread | **Both ends** — nerf Chain Bolt and Fission, raise the weak |
| Chain Bolt's nerf | **Both levers** (~40%): damage *and* fork cap |
| Aura weapons | **Stronger by default**; fix is reach, not damage |
| Armour | Raise **and** time-scale, but **bounded** — degeneracy argument accepted |
| Conditional gems | **9, not 11** — Shatter and Sterilizer cut as duplicates of shipped 6B extensions; Corrosion kept because armour now matters |
| Targeting gems | **7, not 8** — Scattershot cut; 5 aura readings + 2 honest refusals |
| 6D-3 scope | **Full**, including the `clearAt` return change |

**The catalogue-vs-extensions audit is a new check nobody had run.** 6B's
own review checked candidate *extensions* against shipped *gems* and found
six duplicates. Nobody checked the reverse afterwards, so three catalogued
gems had quietly been shipped under extension names.

## 8. What's next

**Phase 6D, four sub-batches, all greenlit, in this order:**

1. **6D-0** — the balance-shape pass (`docs/plans/phase-6d0-balance-shape.md`).
   Tuning only. **Playtest before proceeding** — its result changes what
   the others should be.
2. **6D-1** — 7 Targeting gems (`phase-6d1-targeting-gems.md`).
3. **6D-2** — 9 Conditional gems (`phase-6d2-conditional-gems.md`).
4. **6D-3** — the gem-reality fix (`phase-6d3-gem-reality.md`). Largest of
   the four; touches `clearAt`.

The umbrella (`phase-6d-conditional-targeting-gems.md`) carries the
findings and the reasoning; the four above carry the builds.

**No code was written this session.** Everything above is planning and
three doc commits.
