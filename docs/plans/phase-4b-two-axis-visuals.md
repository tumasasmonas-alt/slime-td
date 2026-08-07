# Phase 4B — the two-axis visual system

**Status:** ✅ implemented 2026-08-07, playtested and accepted (*"looks
nice, I like the more colour gradient"*). Written, greenlit and built the
same day. One as-built delta — see §10.
**Source design:** `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
§6 (the two-layer field, visual encoding); Decision 25.
**Scoping conversation:** 2026-08-07, with the project owner.

> **The job, in the owner's words:** *"this phase should make it so that
> the slime is readable by colours and states, and maturity and denseness
> can be told apart."* Not a visual overhaul — that's Phase 9. Legibility.

---

## 1. What 4B is

§6's promise: **5 density steps × 4 maturity steps = 20 distinct visual
states from two axes, none hand-authored.** This is the real answer to the
playtest finding that "5 density levels isn't enough" — not more buckets, a
second dimension.

The constraint §6 is emphatic about, and the one thing that can sink this:

> **The channels must stay strictly separated.** Thickness must mean *only*
> mass; colour must mean *only* hardness. If they bleed into each other, 20
> states read worse than 5.

4B also absorbs three things that are the same code:

- **The palette-collapse bug** — 5 density buckets currently read as ~3
  (`#5c2430`/`#8a2f42` are both dark maroons, `#ff3f68`/`#ff7590` both
  bright pinks). Density drives a ~10× resistance swing, so this is a
  tactical readout the player can't currently read.
- **`frozen` has no visual at all** — a 2-second mechanic invisible since
  Phase 2, and the precedent that forced 4A to ship a placeholder rather
  than ship blind (Decision 63). It has sat unfixed across three phases.
- **4A's neon-green placeholder** gets replaced.

---

## 2. Agreed scope decisions (2026-08-07)

1. **Colour now, texture at the Phase 9 overhaul.** §6 wants mature ground
   "matte, fibrous, crystalline/plated." Real per-cell texture in Canvas 2D
   at 13px either multiplies draw calls (fighting the dirty-set
   optimisation 4A already had to respect) or needs pre-rendered variants
   per state, which is silly at 20 states. The right implementation is a
   single full-screen noise pass masked by maturity, drawn once per frame —
   a different rendering architecture, and genuinely overhaul-scale. Colour
   alone delivers 4B's stated goal, and texture layered on a correct colour
   system later is purely additive.
2. **`frozen` is in**, as a rim rather than a fill, so it can't compete
   with the two axes. Owner: *"you have to, looking at it without knowing,
   tell 'yeah that's ice, it's frozen'."*
3. **Calcified ground is white-ish, not dark.** This supersedes a §6
   detail — see §3 below, which is the one thing in this plan that needed
   the owner's explicit sign-off.
4. **Coagulants stay as they are.** Claude flagged a possible ambiguity
   (Decision 46 renders them in the top density bucket, which maturity now
   also drives); the owner disagreed and the concern is dropped.

---

## 3. The §6 supersession: calcified is pale, not dark

§6 says mature ground is dark — verbatim *"Mature = dark, desaturated,
matte"*, and its table reads *"Dark thin crust"* / *"Dark thick crust — the
worst ground in the game."* **4B ships it pale instead**, on the project
owner's instruction, recorded here as a deliberate supersession per the
ground-truth protocol (Decision 22) rather than an oversight.

Three reasons it's the right call, the first of which is new evidence §6
could not have had:

1. **Dark maturity rebuilds the bug 4A just fixed.** Measured on a
   max-weapons run: **64% of all scarred cells sit on *cleared* ground**,
   which is black. That is exactly why 4A's dark placeholder was invisible.
   Shipping "mature = dark" would reproduce that failure at ship quality.
2. **§7 needs scarring legible on bare ground.** It wants the arena to
   become *"a legible record of the run"* where *"a veteran reads a
   screenshot and knows how long the run has been going"* — tree rings.
   That requires reading scar on cleared ground, which rules out dark.
3. **§6 is arguably self-inconsistent.** It also specifies
   *"crystalline/plated at the top,"* and crystalline/plated reads pale and
   mineral, not dark.

---

## 4. The palette

Two channels, mapped to two genuinely independent perceptual dimensions.

**Density → alpha.** On a black background alpha *is* thickness, which is
§6's "opacity, mass" reading directly. Even steps, which is what fixes the
collapse — the current ramp's *unevenness* is why 5 buckets read as 3.

| Density bucket | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Alpha | 0.25 | 0.45 | 0.65 | 0.83 | 1.0 |

**Maturity → hue and saturation.** A "drying and hardening" ramp:

| Maturity bucket | Colour | Reads as |
|---|---|---|
| 0 — fresh | `#ff3f68` | hot pink, wet — the existing slime identity, preserved |
| 1 | `#e8806f` | coral, warming |
| 2 | `#d8b49a` | clay, desaturating |
| 3 — calcified | `#f0e8dc` | bone |

**Bare scarred ground** (density bucket 0, maturity > 0) draws the maturity
colour at a low alpha — `0.12 / 0.20 / 0.30`. This is what makes the tree
rings legible and what replaces the neon green.

> Deliberately kept **below** the lowest slime alpha (0.25), so bare ground
> can never read as "more" than thin slime. It's terrain, not tissue.

**Frozen** — a rim stroke in `#bfe9ff`, which is Frost Nova's existing
colour, so the game already carries that visual language. A rim rather than
a fill keeps it off both axes. Visually binary (frozen / not), which also
makes it cheap — see §5.

**Where it lives:** a new `src/tuning/palette.ts`, replacing
`BUCKET_COLORS` in `grid/grid.ts`. The palette is now two-dimensional and
will grow again at the Phase 9 overhaul, so it earns its own file under the
existing `tuning/` convention. Both current consumers
(`grid/slimeLayer.ts`, `render/coagulants.ts`) move over; `BUCKET_COLORS`
is deleted rather than left as a dead export.

**Coagulants** become `MATURITY_COLORS[0]` at full alpha — fresh slime at
maximum density, which is exactly what Decision 46 says they are ("the
brightest, densest slime in the game"). Same appearance as today, sourced
correctly.

---

## 5. The dirty-set, and why `frozen` is cheap

4A established the rule: anything feeding the rendered colour must be
quantized, and cells marked dirty only on a *quantized* change — otherwise
the dirty set becomes the whole grid every tick and `flushDirtyCells` goes
from microseconds to milliseconds.

Density and maturity are already bucketed and already mark dirty correctly.
`frozen` is a continuously-decrementing float, so it needs the same
discipline — but it renders as a **binary** state, so the quantization is
just `frozen > 0`, and only the two transitions matter:

- **Freezing** — `grid/clear.ts` sets `frozen`; mark dirty only if it was
  previously 0.
- **Thawing** — `systems/growth.ts` decrements it; mark dirty only on the
  tick it reaches 0.

A frozen cell counting down mid-freeze marks nothing. No new state needed
either — both sites already have the before and after values in hand.

Note `systems/growth.ts`'s frozen branch currently `continue`s before any
dirty handling, so the thaw case is a real (small) change to that path, not
just an addition.

---

## 6. Tests

Rendering itself isn't unit-testable, but the palette's *invariants* are —
and they're where the collapse bug actually lived.

1. **Density alphas are monotonically increasing**, with a minimum gap
   between adjacent steps. The direct regression guard for the collapse:
   the old palette failed precisely because adjacent steps were too close.
2. **Adjacent maturity colours are perceptually distinct** — assert a
   minimum distance between neighbours, so a future retune can't
   accidentally recreate "5 buckets read as 3" on the other axis.
3. **Palette lengths match their bucket counts** — `MATURITY_COLORS` has
   `MATURITY_BUCKETS` entries, density alphas cover every bucket
   `cellBucket` can return. Guards a silent `undefined` fill if either
   count is ever changed.
4. **All alphas are within [0, 1].**
5. **Bare-scar alphas are strictly below the lowest slime alpha** — the
   "terrain never reads as more than tissue" invariant from §4.
6. **Freezing a cell marks it dirty; thawing marks it dirty; a frozen cell
   ticking down without thawing does not.** The dirty-set discipline from
   §5, which is the one part of 4B that could quietly cost frame time.

---

## 7. Risks

**Maturity distinction compresses at the lowest density.** At alpha 0.25 on
black, bone reads ≈`rgb(60,58,55)` and hot pink ≈`rgb(64,16,26)` — both
dark, distinguishable mainly by neutral-vs-red cast. Judged acceptable
because §6's own table makes both of those states low-stakes ("faint pink
film — nothing" / "dark thin crust — little payoff"), and the distinction
that matters is at high density. Flagged rather than solved; if it reads
badly, the lever is raising the lowest alpha.

**Numbers will need in-browser tuning, and that's expected, not a
failure.** Every 4A constant that mattered was wrong on first write and
only diagnosable by looking at the running game (see that plan's §10). The
same will be true here — §8 budgets a tuning pass rather than pretending
the first values will hold.

**Small:** this is the first change to touch the shipped slime look since
the port. If the new palette reads *worse* than the current one despite
being more correct, that's a legitimate outcome to catch at the gate — the
old `BUCKET_COLORS` values are in git.

---

## 8. Order of work

1. `src/tuning/palette.ts` — density alphas, maturity colours, bare-scar
   alphas, frozen rim. Tests 1–5.
2. `grid/slimeLayer.ts` — compose fill from (density bucket → alpha,
   maturity bucket → colour); bare-scarred-ground branch; frozen rim.
   Remove the 4A neon-green placeholder.
3. `render/coagulants.ts` — source from `MATURITY_COLORS[0]`.
4. `grid/grid.ts` — delete `BUCKET_COLORS`.
5. `grid/clear.ts` + `systems/growth.ts` — frozen dirty-marking on the two
   transitions only. Test 6.
6. **Live verification and a tuning pass** — confirm all four §6 quadrants
   are distinguishable on screen, the scar ring reads, and freeze is
   identifiable without being told. Expect to adjust numbers here.
7. Docs — decision entries, session log, PROGRESS/BACKLOG (closing the
   palette-collapse and frozen-visual bugs).

---

## 9. Out of scope — deliberately

| Item | Where it belongs |
|---|---|
| Texture (matte / fibrous / crystalline) | Phase 9 visual overhaul — scope decision 1 |
| Coagulant rendering changes | Not needed; owner's call (scope decision 4) |
| Wave 2 coagulant types reading maturity | 4C |
| Bloom's maturity payload | 4C |
| Does calcified tissue block projectiles? | Open question 4 — prototype at the 4C gate |
| Frost Nova's own near-invisible ring | Phase 9 (separate BACKLOG bug from `frozen`) |
| Event frequency retune | BACKLOG, alongside 4C |

---

## 10. What changed during implementation

**One delta, and the plan's own test caught it.** §4 specified bare-scar
alphas of `0.12 / 0.20 / 0.30` while also stating the rule that they must
sit below the thinnest slime alpha (`DENSITY_ALPHA[1]` = 0.25). Those two
statements contradict each other at the top bucket — 0.30 > 0.25. Writing
test 5 from §6 ("bare-scar alphas are strictly below the lowest slime
alpha") failed immediately on the plan's own numbers.

Fixed the constants, not the test: `0.1 / 0.16 / 0.22`. Worth recording
because it is the first time this project's tests caught a defect *before*
it reached the browser rather than after — the four 4A bugs and the 4B
palette collapse all needed eyes on the running game. The difference is
that this invariant was stated explicitly in the plan and was therefore
mechanically checkable; "is it visible" never has been.

**Everything else shipped as planned.** Verified live at 300s with maxed
weapons: maturity buckets `[12142, 538, 198, 22]` (full range reachable),
1,153 frozen cells rendering their rim, no console errors.

**Noted for later, not fixed:** the project owner's read on the shipped
palette — *"I think scars will have to have a different colour, but we will
see later."* The clay/bone ramp works but may not be the final answer for
scarring specifically. In BACKLOG; the palette is one file now, so it's a
cheap change whenever it's revisited.
