# Phase 4A — the maturity field

**Status:** implemented, awaiting the project owner's playtest. Written
2026-08-07, greenlit and built the same day.
**Source design:** `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
§6 (two-layer field) and §7 (maturity: scar, not age); Decisions 25, 26.
**Scoping conversation:** 2026-08-07, recorded in the session log.

> **Read §7 in full before touching this.** The first version of this
> mechanic was age-based and wrong; the reasoning for the inversion is the
> whole content of that section. The one-line summary that must survive:
> **the battlefield hardens, the wilderness stays soft.**

---

## 1. What 4A is

A second `Float32Array` over the grid, tracking *quality of ground* as
distinct from *quantity of slime*. Decision 25's split:

| Layer | Is | Consumed by |
|---|---|---|
| `growth` (exists) | Quantity of slime. The horde's fuel. | Weapons **and** coagulant formation |
| `maturity` (new) | Quality of the ground. Terrain. | **Nobody** |

Maturity accrues where the player actually clears, so a hardened ring
grows exactly where they fight — under their own guns, metered by their
own success, thickening for as long as they survive. The wilderness, which
weapons structurally cannot reach (`nearestFrontierPoint` pins the
engagement zone to the inner edge of the slime), stays soft forever except
for a hard-capped global age drift.

---

## 2. Agreed scope decisions (2026-08-07)

Settled with the project owner before planning:

1. **4A ships a deliberately crude placeholder visual**, not the real
   two-axis system (4B). A field state with no visual is the exact mistake
   `frozen` already represents — still an open bug two phases later — and
   without *something* on screen neither the owner nor Claude can playtest
   4A at all. BACKLOG's own process finding says the "signature visual is
   part of the mechanic" rule should scope to any mechanic with a
   world-space effect, not just weapons.
2. **Virgin ground's growth ceiling drops below 1.0; mature ground reaches
   1.0.** The owner's framing: undisturbed slime has no reason to harden —
   it never had to fight. **But note what this lever actually does:** only
   undisturbed ground ever reaches its ceiling (the kill zone is being
   cleared constantly), so this is effectively a *behemoth-size dial*, not
   a kill-zone-durability dial. Kept modest (0.85) so §6's "high density +
   low maturity" quadrant — bright thick slime, big soft coagulants —
   survives. Incidental benefit: it is a non-scripted lever on the
   behemoths-too-early problem deferred as Decision 62.
3. **Events inject to full density regardless of maturity.** Owner's call:
   veins and blooms bring full-thickness slime. Thematically the infection
   pushing hard rather than seeping; mechanically it makes vein-fed ground
   the densest in the game, which reinforces §11's "the vein delivers fresh
   mass close" and keeps events as the behemoth pump per Decision 28.
4. **Bloom's maturity payload stays in 4C**, not 4A. Decision 48 and the
   comment in `tuning/events.ts` both say 4A; §17 says 4C. §17 is right and
   both of the others need correcting. Reasons: 4A already changes clear
   resistance globally and stacking bloom-hardening on top makes the gate
   unreadable; bloom's actual job is manufacturing spawn sites for armoured
   types, which is 4C content.
5. **Maturity is quantized into buckets**, forced by performance — see §5.
6. **Tune conservatively.** See the risk in §7.

---

## 3. Data model

**`Grid` (`src/state.ts`)** gains two arrays:

```ts
maturity: Float32Array;   // 0..1, quality of ground
matBucket: Int8Array;     // 0..3, quantized — dirty-set gating + placeholder render
```

Both zero-initialised in `buildGrid()` (`src/grid/grid.ts`). Cost: ~52 KB
for the Float32Array plus ~13 KB for the Int8Array over 150×86. Negligible.

**New `src/tuning/maturity.ts`** — all constants first-pass and
deliberately gentle:

| Constant | Proposed | **As built** | Meaning |
|---|---|---|---|
| `MATURITY_MAX` | `1.0` | `1.0` | Hard cap |
| `SCAR_PER_DENSITY` | `0.06` | **`0.15`** | Maturity gained per unit density removed |
| `AGE_CEILING` | `0.33` | `0.33` | §7's low ceiling — global age can never approach a wall |
| `AGE_RATE` | `0.0009 /s` | `0.0009 /s` | ~6 min to reach the ceiling |
| `MATURITY_DECAY` | `0.010 /s` | **`0.0015 /s`** | ~11 min from full back down to the age floor |
| `MATURITY_TOUGHNESS` | `0.5` | `0.5` | Yield reduction at full maturity |
| `MATURITY_YIELD_FLOOR` | `0.4` | `0.4` | Nothing is ever unclearable |
| `CEILING_VIRGIN` | `0.85` | **replaced** | → `CEILING_VIRGIN_FRAC = 0.75` |
| `CEILING_MATURE` | `1.0` | **replaced** | → `CEILING_MATURE_FRAC = 1.0` |
| `REGROWTH_SLOWDOWN` | `0.5` | `0.5` | Ambient rate multiplier at full maturity |
| `MATURITY_BUCKETS` | `4` | `4` | §6's four maturity steps |

Helper functions in the same file, so every formula lives beside its
constants: `growthCeiling(maturity, threshold)`,
`regrowthRateMult(maturity)`, `maturityYieldMult(maturity)`,
`ageFloorAt(elapsedSeconds)`, `maturityBucket(maturity, ageFloor)`.

> **Four constants/signatures changed during implementation**, all for
> reasons that only surfaced by running the thing. See §10.

### The age floor — why it's global, not per-cell

§7 wants both a slow global age drift *and* passive decay of scarring.
Naively these fight: decay pulls every cell to 0, age pushes every cell up,
and the wilderness settles wherever the two rates happen to cross.

Resolved by making age a **floor** rather than a gain:

```
ageFloor(t) = min(AGE_CEILING, AGE_RATE * t)      // one scalar per tick
maturity    = max(ageFloor, maturity - MATURITY_DECAY * dt)
```

Scarring pushes a cell above the floor; decay returns it to the floor, not
to zero. The wilderness rises to its capped floor and stays there; the scar
ring heals back down to it. Satisfies §7 exactly, needs no per-cell age
state, and costs one scalar computation per tick.

---

## 4. Behaviour changes

**Scar gain — `grid/clear.ts`.** Inside the existing grid-cell loop, every
cell that loses density gains `SCAR_PER_DENSITY × removed` maturity, capped
at `MATURITY_MAX`. *You scar what you clear.* No new loop — it rides the
loop already running.

**Clear resistance — `grid/clear.ts`.** The existing multiplier
(`clamp(1.3 - dens, 0.12, 1.3)`, which despite its name scales the amount
*removed*) gains a maturity term:

```
yield = clamp(1.3 - dens, 0.12, 1.3) * maturityYieldMult(maturity)
maturityYieldMult(m) = max(1 - MATURITY_TOUGHNESS * m, MATURITY_YIELD_FLOOR)
```

The floor is Decision 44's guarantee restated for terrain: a bad matchup,
never a brick wall.

**Ambient growth — `systems/growth.ts`.** Two changes, both reading the
cell's maturity: the convergence target becomes `growthCeiling(maturity)`
instead of a hard `1`, and the rate is scaled by
`regrowthRateMult(maturity)`. Mature ground grows *slower to a higher
ceiling* — a durability threat, not a speed threat, per §7's explicit
reasoning that speeding up the kill zone would be unfair since it's the one
place the player is forced to fight.

**Events — `systems/events.ts`.** `injectAt` keeps converging toward `1`,
explicitly unchanged, per scope decision 3. Worth a comment saying so, since
it will otherwise look like an oversight next to the ambient change.

**Decay — new `src/systems/maturity.ts`.** One pass per sim tick over all
cells, decaying toward the age floor and updating `matBucket`/`dirty` on
bucket change. Its own module rather than folded into `growth.ts`, per
CLAUDE.md's one-system-per-module rule. Wired into `systems/tick.ts`
alongside `applyAmbientGrowth`. Cost: one extra 12,900-cell pass at
5.5 ticks/sec, the same order as the growth pass already running.

**Formation — no change, deliberately.** `floodFillMass` drains `growth`
and never touches `maturity`, which *is* Decision 25's "the horde eats mass
but not maturity." Gets a test asserting it rather than a code change.

---

## 5. Rendering, and the performance constraint that forces bucketing

Maturity decays on **every cell every tick**. If it fed the rendered colour
continuously, every cell would go dirty every tick — the dirty-set
optimisation would collapse from tens of cells to all 12,900, and
`flushDirtyCells` would go from microseconds to ~6ms per tick.

So maturity is quantized into `MATURITY_BUCKETS` (4) steps, and cells are
marked dirty only on **bucket** change — exactly the pattern `growth`
already uses via `cellBucket`. Slow decay then crosses a boundary rarely.
This looks like a 4B visual decision but is forced by 4A performance, and
it happens to be what §6's "4 maturity steps" wanted anyway.

**Placeholder visual:** in `flushDirtyCells`, after the existing bucket
circle is filled, overlay a circle at alpha proportional to `matBucket`.
Crude, unmistakably temporary, and enough to see the ring form. The real
two-axis system (density → thickness, maturity → colour and texture) stays
4B, along with the palette-collapse fix.

> **As built: neon green, not the planned dark overlay.** The dark version
> shipped first and was invisible — see §10. The project owner's call on
> keeping green: *"we can keep it green for a placeholder to identify it's
> working."*

---

## 6. Tests

Invariants over mechanisms, per Decision 20 — an outcome test survives a
retune that a "sampled at radius X" test would not.

1. **The wilderness never calcifies.** The core inversion, as an outcome
   test: run the real sim with a weapon firing, assert cells far from the
   tower stay at or below `AGE_CEILING` while cells in the kill zone climb
   above it. This is the one test that would catch a regression back to
   age-based maturity.
2. **You scar what you clear** — clearing a cell raises its maturity.
3. **Repeated clearing of one spot yields progressively less per hit.**
4. **Nothing is ever unclearable** — even at `MATURITY_MAX`, a hit still
   removes density (the yield floor).
5. **Decay heals** — a scarred cell left alone returns toward the age
   floor, and never below it.
6. **Maturity is bounded** — never exceeds `MATURITY_MAX`, never drops
   below the current age floor.
7. **Formation drains mass but not maturity** (Decision 25).
8. **Virgin ground tops out below 1.0** under ambient growth alone; fully
   mature ground reaches 1.0.
9. **Events inject to full density regardless of maturity** (scope
   decision 3).
10. **Dirty-set gating** — a maturity change too small to cross a bucket
    does not mark the cell dirty.

---

## 7. Risks

**The designed counters do not exist yet — this is the main one.** §7's
build tension is *"range gets you fresh mass, penetration gets you through
your own callus."* Penetration is a Phase 5 gem; range upgrades are Phase
5/6. So in 4A the player's only answer to their own callus is raw DPS. The
design record already flags this as its risk #4 (*"the scar ring might feel
oppressive"*) and points at the 4C gate.

**Mitigation: tune gently and expect to crank it later.** Better to ship a
scar ring that is too subtle and raise it at 4C than to ship one that makes
the game miserable with no counterplay available. Every constant in §3 is
picked on that basis.

**Secondary:** the virgin-ceiling change shrinks every behemoth in the game
(the formation flood-fill sums `growth`). Intended, per scope decision 2,
but it needs watching at the gate — the wilderness's design role is to be
the big-mass reservoir, and this trims it.

**Minor:** the top colour bucket becomes a scarred-ground signature, while
Decision 46 renders coagulants in that same bucket. Probably a legibility
win, but 4B should look at it when it reworks the palette.

---

## 8. Out of scope — deliberately

| Item | Where it belongs |
|---|---|
| Bloom's maturity payload | 4C (scope decision 4) |
| Coagulant armor derived from maturity | 4C — the term already exists from Decision 44 at ~0 |
| Wave 2 coagulant types reading maturity | 4C |
| Real two-axis visuals, palette-collapse fix | 4B |
| Does calcified tissue block projectiles? | Open question 4 — prototype at the 4C gate |
| Event frequency retune | BACKLOG, best done alongside 4C |

---

## 9. Order of work

1. Data — `Grid.maturity` / `Grid.matBucket`, `buildGrid()`,
   `tuning/maturity.ts` with its helpers.
2. `systems/maturity.ts` — age floor, decay pass, bucket/dirty updates.
   Tests 5, 6, 10.
3. `grid/clear.ts` — scar gain and the yield multiplier. Tests 2, 3, 4.
4. `systems/growth.ts` — maturity-dependent ceiling and rate. Test 8.
5. `systems/events.ts` — confirm and comment full-ceiling injection. Test 9.
6. `systems/tick.ts` — wire the decay pass in. Test 1 (the outcome test)
   and 7.
7. Placeholder render in `flushDirtyCells`.
8. Live browser verification — watch a ring actually form around the
   tower, and confirm the wilderness stays visibly soft.
9. Docs — Decision entries, session log, correct Decision 48 and the
   `tuning/events.ts` comment to say 4C.

---

## 10. What changed during implementation

Four corrections, none of which were visible from the plan. Recorded
because the *pattern* matters more than the individual fixes: **every one
was found by running the game, and none by the test suite** — three of them
had passing tests written against the broken behaviour.

**(a) `MATURITY_DECAY` 0.01 → 0.0015, `SCAR_PER_DENSITY` 0.06 → 0.15.**
The mechanic produced literally zero net scarring anywhere on the grid,
under every loadout tested. Diagnosed via the debug-harness methodology
from Decision 59: maximum grid-wide maturity came out *exactly equal to the
age floor* in both a 400s max-weapons run and a weak-weapon run to death —
nothing had climbed above baseline at all. Decay ran flat every tick while
scar gains arrive tiny and *sparse*, and a cleared cell goes quiet almost
immediately (it drops below `threshold`, stops being a valid frontier
target, and nothing fires at it again until regrowth). Decay was winning by
an order of magnitude. **The original outcome test passed anyway**, because
it hit the same cell every single tick — gain landing as often as decay
always wins, regardless of either rate. Replaced with a version that leaves
realistic gaps between hits.

**(b) `growthCeiling` became threshold-relative** — the serious one, caught
in the project owner's playtest (*"top left area all black, the slime never
was there"*). `grid.threshold` runs to 0.94 and `cellBucket` renders
nothing while `growth <= threshold`, so an absolute 0.85 virgin ceiling
made **22.3% of the arena — 2,876 cells — permanently unrevealable**.
Measured directly in-browser. Expressed as a fraction of each cell's
headroom *above its own threshold*, any positive value guarantees
`ceiling > threshold`, so the failure is impossible by construction rather
than avoided by picking a lucky number.

**(c) Ambient growth must only ever add.** Fell out of fixing (b): the
ceiling was being treated as a target to converge *to*, so ambient growth
would have clawed vein/bloom-injected full-thickness slime back down within
a few ticks — silently undoing scope decision 3 every time an event fired.
Now a cell at or above its ceiling is skipped entirely.

**(d) Rate and ceiling had to be decoupled.** Also from (b): with the
logistic term normalized against remaining headroom, mature ground's larger
headroom exactly cancelled its slower rate — measured as *identical*
regrowth speed, collapsing §7's "slower, to a higher ceiling" into "same
speed, higher ceiling." Normalizing against full density instead makes
`regrowthRateMult` control speed and `growthCeiling` control the stopping
point, independently.

**(e) The placeholder had to be neon green, not dark.** Not a tuning
miss — a structural one. Scarring concentrates exactly where the player
clears, and cleared cells have growth bucket 0, so there is no slime circle
underneath. Measured: **64% of all scarred cells sat on bucket-0 ground**,
i.e. black drawn on black. The remainder was dark-on-dark maroon. A
placeholder has to be legible against the *empty* background, not just
against slime. Neon green also appears nowhere else in the game, so it
can't be mistaken for finished art — though note Caustic Cloud is
`#c9ff8a`, the same family; they're distinguishable in practice (blocky
grid cells vs. a smooth rimmed circle) but worth revisiting if it confuses
during playtest.
