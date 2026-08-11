# Session record — 2026-08-11
## Three 6D batches in one pass, no playtest between any of them — and the two bugs the tests caught anyway

**Type:** implementation, three batches back to back.
**Participants:** project owner + Claude.
**Outcome:** 6D-0, 6D-1 and 6D-2 all shipped, committed and pushed
separately (`4c211f0`, `3e4fbe8`, `e6ff7d2`). Decisions 88–91. 828 tests
pass, `tsc --noEmit` clean. **6D-3 was not in scope for this pass and was
unbuilt as of this file's original writing.** A follow-up session the
same day picked it up and shipped its Steps 1–3 (`bf30eb8`, Decision 92)
— see §6's update below; Steps 4–5 are still open.

> **Why this file exists.** Two things happened here that the next
> session needs and that a status file can't carry. First, the owner
> overrode a gate their own plan had insisted on, deliberately and for a
> stated reason — that override is now a standing risk on three shipped
> batches, and the reasoning behind it matters more than the fact of it.
> Second, the batch that was supposed to be the cheapest of the three
> (6D-2, "nine multipliers, most of the machinery already exists")
> contained the session's only serious bug, and it was invisible to
> typecheck, invisible to 823 passing tests, and invisible to any test
> that checked one boundary at a time.

---

## Table of contents

1. [The instruction, and the gate it overrode](#1-the-instruction-and-the-gate-it-overrode)
2. [6D-0 — tuning only, but four pre-existing tests knew the old numbers](#2-6d-0--tuning-only-but-four-pre-existing-tests-knew-the-old-numbers)
3. [6D-1 — two refusals the plan's table didn't have](#3-6d-1--two-refusals-the-plans-table-didnt-have)
4. [6D-2 — the bug that passed every existing test](#4-6d-2--the-bug-that-passed-every-existing-test)
5. [The test-shape mistake, made twice](#5-the-test-shape-mistake-made-twice)
6. [What's next, and what's owed](#6-whats-next-and-whats-owed)

---

## 1. The instruction, and the gate it overrode

The owner's instruction was explicit and covered all three batches up
front:

> *"Proceed with all of them, comitting pushing and updating the docs in
> between of each. Do not to live testing as part of the test suite for
> these particular stages, only typecheck and vite test."*

With a stated constraint behind it: *"We are aproaching weekly limit so
we have to be incrimental."*

**This overrides `phase-6d0-balance-shape.md` §8's own final step** —
*"Playtest before 6D-1. This batch is the one whose result changes what
the others should be."* That instruction was written by the previous
session for a specific reason: 6D-0 moves the aura weapons' reach from
~105px out to 165–210px, and 6D-1's whole aura-targeting design assumes
that move actually lands them somewhere with mass in it. If 6D-0's
numbers turn out wrong, 6D-1's five aura gem readings are built on top of
a wrong assumption.

The override is legitimate — it is the owner's call, made knowingly,
with a real constraint behind it. It is recorded as Decision 88 rather
than quietly absorbed **because the risk it creates outlives the session
that accepted it.** Three batches are now shipped and none has been seen
running. The specific thing to re-check if a playtest goes badly: 6D-0's
reach numbers and 6D-1's aura readings are a *pair*, and moving one
without re-reading the other is how this compounds.

**Docs were updated and committed between each batch, per the second
half of the instruction** — three separate commits, each carrying its
own plan as-built delta, decision entries, and PROGRESS update.

## 2. 6D-0 — tuning only, but four pre-existing tests knew the old numbers

The batch itself went exactly as planned: unbounded ambient/event
escalation replacing two curves that plateaued at t=560s/t=420s while
player power never did; the opening ~10% softer; the aura reach fix
(Immolation base 66→190, Frost 115→210, Blades 64→165, plus Blades'
`HIT_RADIUS` 16→26 and level-1 blade count 1→2); Chain Bolt and Fission
nerfed, Shockwave buffed; armour raised 20→35 with a bounded time term.

**Two things worth carrying forward:**

**The armour bound narrowed while being implemented.** The plan said
"capped where the best-hitting weapon still keeps ~50% of its damage."
Writing the test made the missing qualifier obvious: `+35` over 15
minutes gives a 70-point cap, which holds that promise for Lance **at
level ≥3** (power ≥140, twice the cap) — not at level 1. A Lance left
unlevelled all run against late-game armour falls below 50%. That's the
same edge case a flat-armour model wouldn't have promised anything about
either, so it was recorded in the plan's as-built delta and scoped into
the test's own name rather than pretending the guarantee was universal.

**Four pre-existing tests hardcoded numbers this batch moved**, and the
fix direction mattered. `weapons/blades.test.ts` asserted
`bladeNextHit[1]` was `undefined` (true when `bladeCount(1)` was 1, false
now it's 2), and its Whirl-flare area test used a fixed grid too small to
contain a 165px orbit. `weapons/immolation.test.ts` had two extension
tests built around a 200×200px arena the new 190px base reach no longer
fits inside. **All four were fixed by updating the test to the new
reality — giving the immolation tests a bigger grid — not by shrinking
the reach back to fit the test.** Worth naming because the opposite
instinct is available and quietly wrong.

## 3. 6D-1 — two refusals the plan's table didn't have

The Targeting gems shipped as designed: seven gems, a new dispatch layer
(`systems/targetingGems.ts`) with `targetingAcquire()` wrapping every
weapon that aims and `auraTargetingReading()` giving the four
self-centred weapons an honest reading instead of a refusal. Lance's own
targeting is now literally "Threat Priority, built in" — routed through
the same wrapper as everything else, so the two can't drift.

**Two deviations, both found by implementing rather than reviewing:**

**Vigilance is refused on `orbital` too.** The plan's §1 table listed it
as real on every aura. But Blades' orbit already floors at
`perimeter + margin` (Decision 16's `towerCenteredRadius`) — the blade's
own centre is *structurally* never inside the perimeter, so "only outside
the perimeter" is a guaranteed no-op there. **This is precisely the
silent-inert defect the whole batch exists to prevent**, and it was one
table row away from shipping inside the fix for it. Three refusals now,
not two.

**Breach Priority's aura reading became a focus-damage bonus.** The plan
described it as "the aura's inner edge pulled inward" — the mirror of
Vigilance's outward push. A plain disc hit's inner edge is already 0.
There is nothing to pull. Reimplemented as bonus damage to whichever
coagulant inside the aura is closest to the core, reusing the same
`focusTarget`/`focusBonus` machinery as Threat Priority/Triage/Fixation.
The thematic mirror survives (Vigilance ignores the near field; Breach
Priority especially rewards it) without a second mechanism.

## 4. 6D-2 — the bug that passed every existing test

**The batch billed as "two of nine need no new mechanism at all"
contained the session's only serious defect.**

`systems/resolveOpts.ts` turns a weapon's socketed Conditional gems into
a `ClearOptions`-shaped object. Every weapon already spreads that object
onto whatever it creates. That half worked on the first attempt, and it
is the half that looks like the whole job.

The other half: **weapons whose damage happens later, via a travelling
entity, read that entity back at impact time through a hardcoded field
list.** `systems/projectiles.ts` (two call sites), `systems/clouds.ts`,
`systems/shockwave.ts` — each names five or six fields explicitly,
because each was written before the fields this batch added existed. None
of the nine new fields was on any list.

**Result: Bolt, Chain, Missile, Fission Charge, Poison and Shockwave —
six of ten weapons — would have carried a socketed Conditional gem all
the way to the moment of impact and silently dropped it.** Frost,
Immolation, Blades and Lance were fine: all four call `clearAt` directly
inside `deliver`, with no entity in between to lose anything.

**Why nothing caught it:**

- `tsc --noEmit` was clean. TypeScript's structural typing doesn't flag a
  property that gets spread onto an object and then never read back out —
  there is no error to raise; the data is simply present and unused.
- All 823 tests passed. Every one of them tested a single boundary: does
  the weapon set the field (yes), or does `clearAt` honour the field when
  handed it directly (yes). **The gap lives strictly between those two
  questions.**

It was found by writing the plan's own §5 test 3 — *"no gem is a silent
no-op on any archetype"* — as an actual **spawn-then-impact** test:
construct a projectile carrying the field, run `updateProjectiles`, check
the coagulant took more damage than an identical one without it. That
test failed immediately.

Fixed by centralising the eleven fields (the nine new ones, plus
`armorIgnoreCap`/`armorShred` which Penetration and Corrosion reuse) into
one shared `ConditionalGemFields` interface in `state.ts`, extended by
`ProjectileBase`/`CausticCloud`/`ShockwaveRing`, and forwarding the full
set at all four consuming call sites. Regression guards added in all
three consumer test files.

**The transferable rule, now Decision 91's closing paragraph:** *a field
reaching an entity at spawn time is not evidence it reaches `clearAt` at
resolution time.* Any future `ClearOptions` field meant to work on the
deferred-entity weapons needs that checked explicitly — setting it in the
weapon file proves nothing.

**A smaller thing recorded alongside it (Decision 90):** Penetration and
Corrosion reuse fields that Lance's Piercing Core and Poison's Corrosive
already write. Every weapon spreads the gem-derived object *last*, so on
a weapon carrying both the gem and the matching extension, **the gem wins
outright rather than the two stacking.** Not a bug — no no-op, no crash —
but not additive either, and worth knowing before assuming otherwise.

## 5. The test-shape mistake, made twice

Worth naming because it happened in two different batches, in two
different files, with the same root cause.

**In 6D-1**, the first draft of the focus-bonus tests compared *loss
ratios* between two coagulants of different mass: does the 500-mass one
lose a bigger fraction of itself than the 200-mass one? It failed — and
correctly. A hit's absolute damage is roughly mass-independent, so a
smaller coagulant always loses a much larger fraction of its own mass,
**with or without any bonus at all.** The test was measuring that
confound, not the gem.

**In 6D-2**, three tests repeated the shape against different axes:
mature-vs-virgin ground for Virulence, dense-vs-sparse for Saturation,
high-vs-low mass for Giant-Slayer. Each failed for the same structural
reason — each of those axes already has an *independent* pre-existing
term pushing the other way (`maturityYieldMult` penalises mature ground;
`resistance` penalises dense ground), so the comparison conflates the
gem's effect with a term that has nothing to do with it.

**The fix in every case is the same: compare the identical target
with the gem against without it,** rather than two different targets with
the gem. The gem's actual claim is always "this hit lands harder than the
same hit would have" — never "this target dies faster than that one."

## 6. What's next, and what's owed

**Owed: a playtest.** Three batches, none verified by play. The
specific thing to watch, in priority order:

1. **Do the aura weapons now engage at all?** 6D-0's whole premise is
   that they were aimed at vacuum. If Blades/Frost/Immolation still feel
   dead, the reach numbers moved too little; if they now trivialise the
   opening, they moved too much and §3's separate 10% opening cut should
   be the first thing reverted (it's two constants).
2. **Does the late game still flatten?** The unbounded escalation is the
   fix for "way too easy later." If it now spikes instead, the
   `LATE_GROWTH_PER_MINUTE` rate (1.05/min) is the single lever.
3. **Do the Targeting gems read as real choices**, particularly the five
   aura readings — those are the most invented part of the batch and the
   likeliest to need a second pass.
4. **Does anything trivialise the curve when stacked?** Nine Conditional
   multipliers compound, and 6D-2's own §7 flagged this specifically.

**Update — 6D-3 Steps 1–3 shipped in a follow-up session the same day**
(`bf30eb8`, Decision 92, `phase-6d3-gem-reality.md` §10's as-built delta):
`projectileFlags` wired into Chain/Missile/Fission, `clearAt`'s
`ClearResult` return, and real Fork/Chaining/Bounce/Ricochet readings on
every weapon they're legal on (previously Bolt Turret alone). **Steps 4
and 5 are still open** — Multishot/Formation's unconditional damage
division (still a zero on Blades, a downgrade on Frost) is the one
defect from the original audit not yet fixed, plus the gem-copy/test-
matrix/doc cleanup pass. That follow-up session was cut short by the same
weekly-limit constraint as this one, at a clean, fully-tested checkpoint
(888 tests, `tsc --noEmit` clean) rather than mid-step.

**No blockers.** Tree is clean, everything pushed to `main`.
