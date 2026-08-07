# Session record — 2026-08-07 (later)
## Phase 4A: the maturity field, and four bugs the tests couldn't see

**Type:** planning + implementation.
**Participants:** project owner + Claude.
**Outcome:** Phase 4A built. The terrain layer exists; the arena now
hardens where the player fights.

> **Why this file exists.** The implementation itself was close to the
> plan. What earned a record is the *debugging*: four separate defects, all
> found by running the game, **none** found by the test suite — and three
> of them had passing tests written against the broken behaviour. That
> pattern is the transferable lesson, not the individual fixes.

---

## Table of contents

1. [Scoping, before any code](#1-scoping-before-any-code)
2. [The age floor — the one piece of design §7 left open](#2-the-age-floor--the-one-piece-of-design-7-left-open)
3. [Bug 1: the mechanic did nothing at all](#3-bug-1-the-mechanic-did-nothing-at-all)
4. [Bug 2: 22% of the arena went permanently black](#4-bug-2-22-of-the-arena-went-permanently-black)
5. [Bugs 3 and 4: two corollaries of the ceiling fix](#5-bugs-3-and-4-two-corollaries-of-the-ceiling-fix)
6. [Bug 5: the placeholder was invisible by construction](#6-bug-5-the-placeholder-was-invisible-by-construction)
7. [What the test suite couldn't see, and why](#7-what-the-test-suite-couldnt-see-and-why)
8. [Ideas considered and rejected](#8-ideas-considered-and-rejected)

---

## 1. Scoping, before any code

Claude reviewed §6/§7 and flagged five things before planning. The owner
settled each:

| Question | Call |
|---|---|
| 4A has no visual until 4B — ship blind? | **No.** Crude placeholder now. A field state with no visual is exactly the mistake `frozen` still represents, unfixed, two phases later. And without it neither party can playtest 4A at all. |
| Should virgin ground's ceiling drop below full? | **Yes.** Owner's framing: *"undisturbed slime has no reason to harden — it never had to fight."* |
| Bloom's maturity payload — 4A or 4C? Docs contradicted each other. | **4C.** 4A already changes clear resistance globally; stacking bloom-hardening on top makes the gate unreadable. Decision 48 and `tuning/events.ts` both corrected. |
| Maturity bucketing? | Forced by performance, so yes — see below. |
| Calcified tissue blocking projectiles (open question 4)? | Not now. 4C gate. |

**One thing Claude got wrong in the framing and corrected mid-scoping.**
The ceiling was pitched as a kill-zone durability lever. It isn't: the kill
zone is cleared constantly and never sits *at* its ceiling, so only
undisturbed ground ever reaches one. The ceiling is therefore effectively a
**behemoth-size dial** (formation sums `growth` over its footprint) — which
is fine, and incidentally a non-scripted lever on the behemoths-too-early
problem deferred as Decision 62, but it needed saying honestly rather than
being sold as something it wasn't.

**Bucketing is a performance constraint wearing a visual costume.**
Maturity decays on every cell every tick. Feeding a raw float to the
renderer would mark all 12,900 cells dirty every tick and collapse the
dirty-set optimisation. Quantizing to 4 steps and gating on *bucket* change
is the same pattern `growth` already uses — and happens to be exactly what
§6's "4 maturity steps" wanted anyway.

---

## 2. The age floor — the one piece of design §7 left open

§7 asks for both a slow global age drift *and* passive decay of scarring,
without saying how they coexist. They don't, naively: decay pulls every
cell toward 0, age pushes every cell up, and the wilderness settles
wherever the two rates happen to cross — a value nobody chose.

Resolved by making age a **floor** rather than a gain:

```
ageFloor(t) = min(AGE_CEILING, AGE_RATE · t)     // one scalar per tick
maturity    = max(ageFloor, maturity − decay · dt)
```

Scarring pushes a cell above the floor; decay returns it *to* the floor,
never below. The wilderness rises to its capped floor and stays; the scar
ring heals back down to it. Satisfies §7 exactly, needs no per-cell age
state, and costs one scalar per tick instead of a second array.

---

## 3. Bug 1: the mechanic did nothing at all

First verification run — using the harness approach the owner had
prescribed during the Decision 59 lag investigation (*"write a specific
test, remove level ups, give core all the weapons at max level"*) — came
back with maximum grid-wide maturity **exactly equal to the age floor.**
Not "low." Equal. Nothing had climbed above baseline anywhere, in a 400s
max-weapons run *or* a weak-weapon run to death.

**Cause:** `MATURITY_DECAY` was sized against the wrong mental model —
"100s from full (1.0) to the floor," which sounds reasonable in isolation.
But real scar gains are tiny *and sparse*: a fraction of a percent per hit,
arriving every second or two as weapons cycle and the frontier moves. Decay
ran flat every tick regardless. It won by an order of magnitude.

There's a second-order reason the gaps are worse than they look: **a
cleared cell goes quiet almost immediately.** It drops below `threshold`,
stops being a valid frontier target, and nothing fires at it again until
ambient regrowth — already slowed twice for pacing (Decision 57) — pushes
it back into range.

**Fix:** decay 0.01 → 0.0015/s (~11 minutes full-to-floor, matching the
timescale runs actually run on rather than one weapon's cooldown), scar
gain 0.06 → 0.15. Post-fix: max-weapons run reaches 0.97 maturity with a
real ring, ~95% of the grid still untouched wilderness; the starting
loadout stays gentle.

---

## 4. Bug 2: 22% of the arena went permanently black

Found by the owner's playtest, not by Claude: *"there was still unpopulated
areas by the slime, like top left area all black... it followed initial
coral structure but never actually filled the area. Feels like a bug."*

It was, and it was a regression introduced by 4A. `grid.threshold` runs up
to **0.94** (`clamp(1 - vein, 0.045, 0.94)`), and `cellBucket` renders
nothing at all while `growth <= threshold`. The virgin ceiling had been
implemented as an **absolute** 0.85 — below that cap. Measured directly in
the browser: **2,876 cells, 22.3% of the arena, could never be revealed by
ambient growth.** The field could only fill where threshold happened to
fall under 0.85, which is precisely the coral vein pattern the owner
described seeing.

**Fix:** express the ceiling as a fraction of each cell's headroom *above
its own threshold*. Then `ceiling > threshold` holds for every cell at any
positive fraction — **the failure becomes impossible by construction rather
than avoided by picking a lucky number.** Set to 0.75 rather than higher
because `cellBucket` quantizes that same headroom into 5 steps; at 0.8+
virgin ground would land in the top bucket anyway and the mechanic would be
visually inert.

Verified after the fix: **zero permanently-stuck cells**, with the
remaining black confirmed to be genuinely mid-fill (threshold 0.94, ceiling
0.985, growth still climbing).

---

## 5. Bugs 3 and 4: two corollaries of the ceiling fix

Both surfaced only because fixing bug 2 broke existing tests, which is the
one case this session where the suite did useful work.

**Ambient growth was clawing density back down.** The ceiling was being
treated as a target to converge *to*, so a cell above it would be pulled
down. Since events inject full-thickness slime on purpose (the owner's
scope decision), **every vein and bloom would have been silently undone
within a few ticks of landing.** Ambient now only ever adds; a cell at or
above its ceiling is skipped entirely. The ceiling caps what ambient *grows
to*, not what a cell may hold.

**Rate and ceiling were cancelling each other out.** With the logistic term
normalized against remaining headroom, mature ground's larger headroom
exactly offset its slower rate — a test measured the two regrowth speeds as
*identical* to the last decimal. §7's "slower, to a higher ceiling" had
quietly become "same speed, higher ceiling." Normalizing against full
density instead makes `regrowthRateMult` own speed and `growthCeiling` own
the stopping point, independently.

---

## 6. Bug 5: the placeholder was invisible by construction

The owner reported it twice: *"still cannot see the scarring tissue."*

Not a tuning miss. **Scarring's natural habitat is cleared ground** — it
accrues exactly where the player clears, and cleared cells have growth
bucket 0, so no slime circle is drawn beneath them. The placeholder was a
dark overlay at low alpha. Measured on a max-weapons run: **64% of all
scarred cells sat on bucket-0 ground.** Black drawn on black. The remaining
36% was dark-on-dark maroon and barely better.

Now neon green, at the owner's suggestion and kept at their request
(*"we can keep it green for a placeholder to identify it's working"*). It
appears nowhere else in the game, so it can't be mistaken for finished art.

**The generalisable rule** — sharper than the existing process finding that
a signature visual belongs to any mechanic with a world-space effect:

> It is not enough for the visual to exist. It has to be legible **in the
> state the mechanic actually produces.**

---

## 7. What the test suite couldn't see, and why

Five defects, zero caught by tests before they shipped. Worth dwelling on,
because three of them had *passing tests written against the broken
behaviour*:

- **The scar-accumulation test hit the same cell every single tick.** Gain
  landing as often as decay always wins, whatever either rate is — the test
  could not distinguish a working balance from a broken one. Replaced with
  a version that leaves realistic gaps between hits, which fails against the
  old constants.
- **The ceiling tests asserted convergence to a named constant**, so they
  happily confirmed convergence to a value that made a fifth of the map
  invisible. Replaced with the invariant that actually matters: *every cell,
  at every threshold the generator can produce, eventually crosses its own
  reveal threshold.*
- **Nothing tested the placeholder at all**, because "is it visible" is not
  a property a unit test has access to.

This is Decision 52's lesson recurring — *"shape/visual bugs need eyes on
the running game, not just an assertion on a derived number"* — and the
methodology the owner prescribed for Decision 59 is what made all of it
tractable: a deterministic debug harness with XP disabled and max weapons,
so the worst case reproduces on demand instead of being hunted through
noisy real-time play. It has now paid for itself three separate times.

---

## 8. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **Ship 4A with no visual, per §17's phase split** | A field state nobody can see is the `frozen` mistake, still open two phases later. Neither party could playtest 4A at all. Crude placeholder instead; real two-axis system stays 4B. |
| **Per-cell age accumulation** | Fights passive decay — every cell settles wherever the two rates happen to cross. Replaced by a shared age *floor*: one scalar per tick, no second array, and §7's intent satisfied exactly. |
| **Absolute growth ceiling (0.85 / 1.0)** | Below `grid.threshold`'s 0.94 cap, so 22.3% of the arena became permanently unrevealable. Threshold-relative makes that impossible by construction. |
| **Virgin ceiling fraction of 0.8+** | `cellBucket` quantizes headroom into 5 steps; at 0.8+ virgin ground lands in the same top bucket as scarred ground and the mechanic is visually inert. |
| **Normalizing regrowth against remaining headroom** | Mature ground's larger headroom exactly cancels its slower rate — measured identical. Collapses "slower, to a higher ceiling" into "same speed." |
| **Dark overlay for the maturity placeholder** | Invisible: 64% of scarred cells sit on cleared (black) ground. A placeholder must be legible against the empty background, not just against slime. |
| **Armor derived from maturity in 4A** | The term exists from Decision 44 at ~0 and it's tempting, but it's 4C's job. 4A is already playtestable without it. |
