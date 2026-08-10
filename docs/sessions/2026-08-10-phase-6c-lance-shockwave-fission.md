# Session record — 2026-08-10
## Phase 6C: Lance, Shockwave, Fission Charge — the shape system, the beam archetype, and a gate that moved a third time

**Type:** planning + design conversation + implementation, continuing
directly from the same-day Phase 6B session.
**Participants:** project owner + Claude.
**Outcome:** Phase 6C complete — three new weapons, twelve real
extensions, `clearAt` generalized to non-disc damage shapes
(`ClearOptions.shape`), `'beam'` added as a sixth `DeliveryKind`, and the
Phase 5 gate moved a third time to run after this batch instead of after
6B. Decisions 81–85.

> **Why this file exists.** Two of the plan's own claims turned out to be
> wrong once checked properly — one about game design (why Shockwave's
> damage shape should exist at all), one about implementation cost (why
> the shape system was necessary). Both were caught by the owner asking
> a direct question rather than accepting the plan's first draft, and
> both corrections changed what got built. That negotiation belongs here,
> per `docs/PROGRESS.md`'s own convention (Decision 37).

---

## Table of contents

1. [Picking up from 6B](#1-picking-up-from-6b)
2. [Two plan documents, four questions, three answers as recommended](#2-two-plan-documents-four-questions-three-answers-as-recommended)
3. [The gate moves a third time](#3-the-gate-moves-a-third-time)
4. [The cone question](#4-the-cone-question)
5. [The withdrawn performance argument](#5-the-withdrawn-performance-argument)
6. [Implementation](#6-implementation)
7. [Verification](#7-verification)
8. [What's next](#8-whats-next)

---

## 1. Picking up from 6B

Phase 6B (two socket lines, 28 extensions) shipped earlier the same
session. The owner asked to plan 6C next — Lance, Shockwave, and Fission
Charge, per the roadmap's own batch table — and to write both 6C-1 and
6C-2 as separate documents, greenlighting both together with full
autonomy once the plans were settled, the same shape 6B's own
split-then-unsplit request had taken.

Reading the code against the design surfaced two findings the roadmap's
own §9½ visual-cost table had gotten wrong:

- **Shockwave was priced as free** — *"reuses the pulse renderer, once
  it's a list."* It doesn't. `NovaFx` is a fixed-radius flash that fades
  in place; Shockwave's own design (*"a ring travels outward from the
  core, damaging everything it passes through"*) needs a radius that
  *grows*, with the damage arriving progressively — a persistent
  simulation entity, not a decoration.
- **The `render/novaFx.ts` single-slot bug §9½ warns about had already
  been fixed** in 5B-6 — `state.novaFx` was a list well before this
  session, so the warning was stale and the risk it named was already
  discharged.

## 2. Two plan documents, four questions, three answers as recommended

Both plans (`phase-6c1-shockwave-fission.md`, `phase-6c2-lance.md`) were
written against an umbrella (`phase-6c-lance-shockwave-fission.md`)
carrying four open questions. All four were answered in one pass:

| Question | Recommended | Owner's answer |
|---|---|---|
| Does the gate run before 6C? | Yes, run it first | **No — build 6C first, gate after** |
| Nine extensions or twelve? | Twelve | Twelve |
| One batch or two? | Split: 6C-1 then 6C-2 | Split |
| Is the Extension gem legal on `'beam'`? | Refuse | **Allow, with beam's own duration reading** |

Two went against the recommendation, and both were better for it — see
§3 and the umbrella plan's own Finding 5 for the beam-legality
reasoning (refusing would have left `'beam'` the only archetype with a
hole in the Amplifier table, and put a lingering-line extension
(Afterglow) next to a gem the game insisted beams couldn't have).

## 3. The gate moves a third time

The roadmap had already settled the gate at "after 6B" the previous day
(2026-08-09). Raising it again rather than assuming it was still correct
— per `CLAUDE.md`'s ground-truth override protocol, which exists exactly
for "this looks like a decision, check before touching it" — surfaced
the stronger argument: 6C takes the roster to ten weapons against three
deck slots, which makes *"specialise or generalise"* a real, unavoidable
question in a way a three-weapon deck (where every weapon is always
equipped) cannot. That is the same reasoning that moved the gate the
first two times, applied again.

Named and accepted as a real cost, not waved away: the gate is also the
go/no-go on the 65-gem count, and 6D (the next batch) is gems — if the
gate finds the count wrong, 6C's twelve extensions will already exist.
Mitigated, not eliminated, by extensions living on their own socket line
since Decision 77 — they don't depend on the gem count directly.

## 4. The cone question

Mid-review, the owner asked directly: *"why would a shockwave do
donut-shaped damage? I feel like it would be a pulse from the core
outwards that does damage in a disc. But that's pretty much Immolation.
So can we make it into a cone maybe?"*

Worked through properly rather than defended reflexively: the band is
delivery, not effect. The ring travels, so at any single instant it can
only damage what it's currently crossing — but summed over the ring's
whole life, the swept bands are contiguous, and the net result is
exactly the full disc the owner pictured. The owner's *intuition about
the outcome* was correct; the donut is how a travelling entity delivers
that outcome without re-hitting the near field on every tick.

The "redundant with Immolation" instinct was aimed one weapon over —
Immolation is a *thin ring at a fixed radius, permanently on*; the thing
an instant Shockwave disc would actually duplicate is **Frost Nova**,
the game's existing instant-disc pulse. The travelling ring is what
keeps Shockwave distinct from Frost: damage visibly arrives outward over
time, and its *Knockback* extension becomes a shove that travels rather
than a uniform push.

The cone itself was checked against the catalogue and declined — it is
already Solvent Sprayer's shape (`phase-5-6-arsenal.md` §7.13, 6E) and
close to Cauterizer's sweeping arc beam (§7.12); taking it here would
spend that visual vocabulary a batch early and add an aiming stage §7.9
deliberately did without (*"no targeting decision, no direction to be
wrong about"*). Kept as a travelling ring — Decision 85.

## 5. The withdrawn performance argument

Also raised directly, once the shape-system cost was on the table: *"do
you think it's better to make those weapons do damage in a different
shape?"* — i.e., why not just fake the ring and the beam with many small
disc `clearAt` calls instead of teaching the function new geometry.

Checking that honestly cost one of the plan's own arguments. The
original write-up claimed a radius-300 ring with a 10px band needed
~190 `clearAt` calls per sim tick — cited as one of two reasons sampling
wasn't viable. Recomputed properly: the band is ~47px thick at the
proposed speed, so the sampling discs are ~23px radius, roughly 57 of
them around the ring, each scanning ~25 cells — about 1,400 cell visits
a tick, negligible. **The performance argument was simply wrong and is
withdrawn**, recorded in both the plan and Decision 83 rather than
quietly dropped.

What survives, and is sufficient on its own: `gemValueFromRemoved()` is
`Math.round(removed * 1.3)` with an 0.08 minimum threshold *per call* —
splitting one hit across many small calls rounds each toward zero, so a
sampled beam would be the hardest-hitting weapon in the game and pay
almost no XP, silently. A cheaper fix existed for just that problem (a
flag on `clearAt` to skip its own XP block, let the caller sum and credit
once) but the owner chose the fuller shape-system build anyway, weighing
that Cauterizer's own beam (6E) is a third consumer already in the
catalogue — the cost amortizes across three weapons, not two.

## 6. Implementation

Both batches were greenlit together; built as one continuous pass.

**6C-1** — `ClearOptions.shape` first, disc-only refactor proven against
the full 589-test suite before the annulus shape was added (the plan's
own non-negotiable constraint); then Shockwave (`weapons/shockwave.ts`,
`systems/shockwave.ts`, `render/shockwave.ts` — a `ShockwaveRing` entity,
damage applied once per sim tick to the band swept since the last one,
render radius computed continuously from `state.time` so the visual
stays smooth despite the tick-quantized damage) and Fission Charge
(`weapons/fission.ts`, reusing `spawnClusterSubmunitions()` —
parameterized with `scatterDist`/`childPowerShare` rather than
duplicated, defaulting to Missile's original constants so Cluster
Warhead is provably unaffected); eight extensions.

**6C-2** — `'beam'` on `DeliveryKind` plus the two gem-legality calls
(Velocity excluded for free; Extension given its own duration reading);
the capsule shape (reusing 6C-1's system); `highestMassPoint()`
targeting (`systems/targeting.ts`, with a nearest-frontier fallback so
the weapon isn't dead for a run's first ninety seconds); Lance's own
charge-and-fire pipeline (not `cooldownReady` — it owns its charge
bookkeeping so the renderer can draw a live target line, re-acquiring
every tick while charging rather than once at the start); four
extensions.

**One design addition arrived after the plan was written.** Asked how
to telegraph the charge, the owner proposed *"charge particles or an
increasing lance beam colour aura around the core"* — better than the
plan's original line-only tell, since a target line alone goes dark
whenever no coagulant exists yet (the exact "does nothing for ninety
seconds" failure the acquire fallback was built to avoid). Landed as
three layers: a core aura that works with no target on the field,
particles that orbit rather than drift inward (drifting inward is this
game's own established idiom for XP pickup — colliding with it would
make the particles unreadable as anything else), and the target line,
now demoted from "the only tell" to "the one that adds *where*."

**Chain Fission's recursion** (Fission's own extension letting
submunitions split once more) is bounded by a generation counter
(`fissionGen`) checked against the *parent's* generation at the moment a
split is granted — a child can only grant a further split when its own
parent's generation was zero, so a grandchild's children (generation 3)
can never happen, not merely "shouldn't in practice." The same
termination-by-construction discipline Decision 75's Salvo `armAt` fix
used, applied to a different mechanism.

## 7. Verification

637/637 tests, typecheck clean, build clean. Live-verified with the
Browser pane actually compositing frames this session — the
`document.visibilityState === 'hidden'` workaround Decisions 75/76/80
all needed was not required here, for the first time since it was
discovered. A temporary `window.__debugState` bridge was still used, not
for visibility but to force a specific weapon/coagulant scenario rather
than wait on natural spawns (all three weapons set to level 5, a
5000-mass coagulant placed in range) — removed before commit, production
bundle hash confirmed byte-identical before and after.

Confirmed directly through the running game, not only the test suite:
the Extension gem's socket highlighting lit Shockwave and Lance's gem
lines but stayed dark on Fission's, live in the loadout screen; Velocity
showed the exact opposite pattern (lit only Fission, dark on Shockwave
and Lance) — both directions of the `'beam'` gem-legality table
confirmed through real clicks, not just assertions. All three new
weapons confirmed damaging a coagulant directly: mass dropped from 5000
to 4942 over an observed window, with Lance's `beamFx` spawning exactly
at the coagulant's position and `lanceCharge.target` matching it. Zero
console errors throughout.

## 8. What's next

**The Phase 5 gate**, for the third and (per the owner's own reasoning
in §3) most legible time — the roster is now large enough, and the deck
small enough, that "specialise or generalise" is an unavoidable question
rather than a hypothetical one. No blockers. `docs/plans/
phase-6-roadmap.md` §3's gate row has been moved below 6C's rows to
match.
