# Session record — 2026-08-06
## The arsenal shape, and the coagulant mechanism

**Type:** design session. No code was written.
**Participants:** project owner + Claude.
**Outcome:** the layer *below* yesterday's design — how the arsenal is
actually structured, and how coagulants actually work in code. Every open
question from the 2026-08-05 record is now closed. Phase 3A is unblocked.

> **How this relates to the previous session.**
> `2026-08-05-slime-and-arsenal-rework.md` settled *what the game is*: the
> field as economy, coagulants as the threat, maturity as scar, the
> conservation rules, the roster, the phase plan. It left the mechanism
> deliberately open and flagged coagulant formation as the single real
> technical unknown in the project.
>
> **This session settles the mechanism.** Read the 2026-08-05 record
> first — this one assumes it and does not restate it.

---

## Table of contents

1. [What this session had to close](#1-what-this-session-had-to-close)
2. [The arsenal, as the owner described it](#2-the-arsenal-as-the-owner-described-it)
3. [Weapon levels leave the card pool](#3-weapon-levels-leave-the-card-pool)
4. [Gem bundles](#4-gem-bundles)
5. [Spontaneous coagulation](#5-spontaneous-coagulation)
6. [The formation algorithm](#6-the-formation-algorithm)
7. [What a coagulant *is*: one mass, two containers](#7-what-a-coagulant-is-one-mass-two-containers)
8. [Armor](#8-armor)
9. [Targeting, movement, rendering](#9-targeting-movement-rendering)
10. [The perimeter](#10-the-perimeter)
11. [Ideas considered and rejected](#11-ideas-considered-and-rejected)
12. [What is now settled, and what 3C still needs](#12-what-is-now-settled-and-what-3c-still-needs)

---

## 1. What this session had to close

The 2026-08-05 record ended with four open questions and one named risk.
Going in, an audit separated *decided* from *discussed but never decided*,
because the owner asked directly whether coagulant formation had been
settled.

**The honest answer was: the design was complete, the mechanism was
untouched.** Yesterday settled what triggers formation (events only), what
determines identity (four field readings), where mass comes from and goes
(the four conservation rules), what it looks like (the five-beat formation
visual), and which types ship first. It settled nothing about:

- how "contiguous mass in a region" is actually computed
- what a coagulant is as a data structure
- whether it has HP, and how weapons damage it
- how weapons target it before Threat Priority exists in Phase 5
- what it looks like in transit, as opposed to during formation
- every number

That gap is what this session filled, plus the arsenal structure the owner
laid out at the top.

---

## 2. The arsenal, as the owner described it

The owner opened by describing the weapon system in their own words, and
it matched §13 of the previous record almost exactly:

> You choose which weapons to bring before the game starts. You begin with
> only a few basic weapons. Playing earns currency, which opens an unlock
> screen for new weapons you can slot into your turret pre-run. During a
> run, only the weapon-specific extensions for weapons you actually brought
> are in the card pool, plus support gems. This makes the game a build
> maker.

Three things came out of comparing that against what was written.

**It confirmed open question #2 by implication.** The owner described
currency buying *unlocks* and never mentioned permanent stat upgrades.
That question had been recorded as "recommendation: unlocks only, never
explicitly confirmed" — the reasoning being that permanent stats compound
the exact 17–21× scaling problem the whole rework exists to fix. Confirmed
explicitly this session. **Decision 39.**

**It quietly dropped weapon levels from the card pool** — see §3.

**It said "all support gems" are in the pool**, which collided with §14's
plan to spend currency on gem *types*. Resolved in §4.

---

## 3. Weapon levels leave the card pool

The previous record's run layer was "weapon levels, weapon-specific
extensions, and support gems." The owner's description had only the last
two.

### Why the owner's version is better

| | With level cards | Without |
|---|---|---|
| What a card is | Sometimes a build decision, sometimes a flat treadmill step | **Always** a build decision |
| Where power comes from | Level, plus what you bolted on | Entirely what you bolted on |
| Pool quality | Diluted with filler | Every card means something |

It is also more PoE-shaped, which is the stated reference: a level-20 gem
in PoE is power, but the interesting part is always the support links.

**And it kills a shipped bug at the root.** The playtest's "cards appear to
do nothing" finding was caused by static and plateauing *level* card
descriptions (`bladeCount(7) === bladeCount(8)`). Remove level cards and
that entire failure mode has nowhere to live.

### The hole it opens, and the fix

Without levels the pool has no floor. A run where the pool keeps offering
gems for a weapon you don't want has no guaranteed payout, and a level-up
that gives nothing feels bad.

The owner proposed the fix in the same message: **enhancement points.**

> A level point per level-up (or every other), and in the inventory screen
> there is a +/- next to each weapon to raise or lower its level. Raw basic
> stat increase, separate from cards.

Agreed and refined. **Decision 40.**

**The +/- is the best part of it.** Freely reassignable enhancement is
mid-run respec, which this game specifically wants: the threat model
shifts across a run (wilderness behemoths early → armoured close-range
late), so pulling points off one weapon and into another that answers the
new pressure is a real, earned adaptation. It also gives the inventory
screen a reason to be opened more than once, which it otherwise lacks.

**Three refinements agreed:**

- **One point every level, not every other.** Tune the per-point magnitude
  instead — magnitude is a smooth dial, rate is a lumpy one, and every
  level-up giving *something* is the whole reason the mechanic exists.
- **A point buys one scalar, not a stat bundle.** `clearAt` already takes a
  single `power` argument that drives how much is removed. Feeding
  enhancement into that keeps the meaning legible ("this weapon hits
  harder") and stops enhancement from competing with gems, which are where
  speed, multishot and pierce live.
- **Freely reassignable, no diminishing returns to start.**

### The collapse risk, accepted knowingly

With free reassignment and no diminishing returns, the optimal play is
always "dump everything into whichever weapon has the most gems socketed."
That is a slider, not a decision.

Shipping it that way anyway, because the owner's framing — *"just raw
basic stat increase"* — is a legitimate job. Enhancement is the **pacing
floor**, not the build; the build lives in cards and sockets. Flagged for
the playtest gate. If it does collapse into a slider, the fix is
diminishing returns per weapon rather than a hard cap, so spreading gains
value without a wall.

---

## 4. Gem bundles

The owner rejected unlocking support gems one at a time:

> Unlocking them one by one is a drag. What if we bundle support gems, and
> the player spends currency to unlock a bunch in one purchase? That would
> make purchases feel more impactful.

Agreed. **Decision 41.**

**Bundles are thematic, not random.** "Ballistics Package: Multishot,
Pierce, Velocity" reads as *I unlocked a playstyle*. Three random gems
reads as a loot box. Same purchase, completely different feeling — and the
themed version teaches the game, because a new player reads the bundle
name and immediately has a build idea.

### The rejected extension

Claude proposed going further: make the bundle the unit of *decking* as
well as of unlocking, so a pre-run deck is N weapons + M gem bundles. The
argument was that it bounds the card pool permanently, however many gems
ship over the project's life.

**The owner rejected it, and the reasoning is better:**

> No — after you unlock the gem bundle you can get it in game, no questions
> asked. That makes the build more interesting.

Locking gems behind deck slots means a combination you did not foresee at
deck time is unreachable, which cuts against discovery. Unlocked gems
being universally live means builds can emerge mid-run from what the game
offers, which is the more interesting game. Simpler for the player, too.

### The consequence, recorded rather than solved

The gem half of the card pool grows every time the project ships a new
gem, and unlike weapons it is not deck-bounded. Fine at 15 gems, a problem
at 60.

Not a decision needed now. If it bites, the fix is a filter on the *pool*
rather than on unlocks — cards only offer gems that fit a weapon actually
being run. In BACKLOG.

**The owner raised the sharper version of the same worry:** not pool size
but *bad luck* — never being offered an armor-penetration gem in a run
where it is exactly what you need. And proposed a fix:

> An "orbital trade ship" where the player could actually buy the gems they
> want using score points.

Recorded as an idea, not a decision. It is a genuinely good answer to
autoshooter card variance — a deterministic escape hatch against RNG,
paid for with a resource the player earns by playing well. It needs its
own design pass (what score points are, whether it competes with meta
currency, whether it appears mid-run or between runs) and that belongs
with Phase 6/7, not now. In BACKLOG.

---

## 5. Spontaneous coagulation

The owner pushed back on events being the *only* trigger:

> I feel like what triggers formation should not be only events. There
> could be a possibility of random coagulation — unexpected sparking. Rare,
> but it would prevent long stretches of no enemies forming.

Agreed as an idea for later, with guard rails. In BACKLOG, not a decision.

**Why it is probably needed.** Veins and blooms rotate on a timer, and any
timer-driven system has dead air by construction. A low-rate background
spark is the standard fix, and the owner's instinct — that the game will
otherwise have empty stretches — is likely right.

**Why it is dangerous.** It is Decision 28's problem restated. The
wilderness is ~76% of the arena and saturates in ~46 seconds; anything
that lets standing mass self-ignite at scale gives behemoths on tap from
minute one. That arithmetic does not change just because the trigger is
random instead of mass-based.

**The framing that keeps it compatible:**

> **Events set the rhythm. Spontaneous sparks set the floor.**

It must never be a meaningful *fraction* of what spawns — only a minimum
below which the arena is never silent.

**Guard rails agreed:**

- A hard **global rate limit**, not a per-region probability. Per-region
  probability multiplied by a large saturated wilderness is exactly how
  §9's failure happens.
- The **same bounded mass check** as event formation, so a spark can never
  produce anything bigger than the local field justifies.
- A **bias toward distant sites**, so a spontaneous spark reads as a long
  dramatic charge rather than an ambush the player could not have seen
  coming.

---

## 6. The formation algorithm

Named as the project's one real technical unknown in the previous record:
*"'contiguous mass in a region' needs flood-fill or sampling, per event,
inside the tick budget."*

### The risk was overstated

Grounded against the actual code this session. The grid is
**150 × 86 = 12,900 cells** at 13px, ticking at `SIM_TICK` (~0.18s,
~5.5 ticks/sec).

**Formation is a per-event-moment cost, not a per-tick cost.** A vein
sheds a coagulant every second or few. So the question is one search per
formation, not one per tick — and a breadth-first flood over the *entire*
grid is a few hundred microseconds of Float32 reads. The frame budget was
never the problem.

**The real problem is a design problem wearing an algorithm costume.** An
unbounded flood-fill across saturated wilderness returns *the entire
wilderness* as one contiguous region. That is §9's arithmetic expressed in
code. So the algorithm has to be bounded, and **the bound is where the
design lives.**

### The agreed structure: two things, two jobs

**Decision 43.**

#### (a) A coarse density index — for *choosing* where things form

A separate, read-only side array summing revealed density over each 4×4
block of cells: ~38 × 22 ≈ **836 entries**, refreshed each tick at roughly
6% of a full grid pass. Negligible next to what the tick already does.

It answers "where is mass banked right now" in one lookup instead of a
12,900-cell scan. Bloom placement, behemoth site selection and spontaneous
sparking all need exactly that question answered, and without the index,
answering it means searching — which is where the cost genuinely would
have been.

> **Clarification that mattered.** The owner initially read this as
> downsizing the simulation grid, and objected — correctly — that the dense
> grid is what makes the slime read as *liquid* rather than as pixels.
>
> **Nothing about the game grid changes.** It stays 150 × 86 at 13px, fully
> simulated and fully rendered. The index is a table of contents beside the
> map, never rendered, never simulated from. The map is still the map.

#### (b) A bounded flood-fill — for *executing* formation

From the spark point, flood outward through **revealed** cells only
(`growth > threshold` — documented prototype bug #3 discipline, never raw
density), stopping at a hard radius cap of ~180px (≈14 cells, so ~600
cells worst case) and a cell-count cap. Sum `growth` over what it reached.
That sum is the mass available.

**The radius cap is the entire design.** It makes "contiguous mass" mean
"mass inside a formation footprint," which is what §10 meant anyway — the
crater is hundreds of pixels across, not thousands. Size then emerges from
**how full that footprint is**:

| Footprint state | Result |
|---|---|
| Saturated wilderness | Max mass → Behemoth |
| Half-cleared near field | Little mass → Mote |

Exactly Rule 4, with no spawn table, and **behemoth size is capped by
construction rather than by tuning.**

**Free bonus: the flood-fill result *is* the crater shape.** Drain the
cells it reached and the hollow is organically shaped to the field,
following the vein pattern. No separate crater geometry to author.

### Rejected: summed-area table

More elegant on paper — O(1) queries over arbitrary rectangles — but it
only pays off at thousands of region queries per second. This game needs a
handful. Not worth the invalidation complexity against a field that
changes every tick.

---

## 7. What a coagulant *is*: one mass, two containers

The best question of the session, and the one where the existing code
already contained the answer.

### The principle

> **Coagulants have no HP. Mass is the only currency, and it lives in two
> containers: the grid, and entities.**

**Decision 42.**

```
Coagulant {
  x, y
  mass        // this IS the hp, the arrival damage, and the XP on death
  armor       // see §8 — ships at ~0 for Wave 1
  kind        // derived at formation: mote | congealer | behemoth
  speed
  seeds[]     // blob render seeds, generated at formation
}
```

Radius from mass: `r = k · √mass`, so area is proportional to mass. **A
behemoth is big because it is big.**

### Why it works: they are dense slime that walks

`clearAt` already contains this:

```
resistance = clamp(1.3 - dens, 0.12, 1.3)     // dense tissue ~10x tankier
radiusPx  *= clamp(1.25 - baseDensity, 0.4, 1.25)  // and shrinks the bite
```

If a coagulant's local density is high by definition, feeding it through
the same formula produces a tanky enemy with **no new mechanic at all**. A
behemoth is hard to kill for two compounding reasons that both already
exist in the codebase: it is dense (high resistance per hit) *and* it is
massive (a lot of total mass to chew through).

### The refactor

Split `clearAt` into a damage half and a reward half. The damage half
currently loops grid cells; it gains a second loop over coagulants
overlapping the hit disc, applying the **same** falloff and resistance
maths, subtracting from `mass` instead of from `growth[i]`. Both loops
contribute to one `totalRemoved`.

### What that buys, all automatic

- **Decision 31 satisfied by construction.** XP tracks destroyed mass
  wherever it is, because it is literally the same accumulator. The risk
  premium is one multiplier on the coagulant portion.
- **Rule 2 is automatic** — damage dealt is mass permanently destroyed,
  because there is nowhere else for it to go.
- **Rule 1** is the flood-fill draining grid cells and summing into `mass`.
- **Rule 3** is dumping `mass` back into grid cells inside the perimeter on
  arrival.
- **Mass is conserved across the entire game as one number.** Grid →
  coagulant → destroyed, or grid → coagulant → grid. That is an invariant a
  test can assert, which is exactly the invariant-over-mechanism guard
  Decision 20 argued for.
- **Every weapon works on them unmodified**, including ones nobody has
  designed yet, because everything routes through `clearAt`.

### The one constraint

**Coagulants must not be composited into the world grid.** They stay
entities. Putting them in the grid would mean they scar terrain as they
walk (Phase 4A), and the code would lose any way to tell coagulant from
ground.

---

## 8. Armor

Raised by the owner: *"keep in mind the entities will have some armor
value, I don't know how it will slot in."*

**Decision 44.**

### Rejected: percentage reduction

`removeAmt *= (1 - armor)` is the tempting form. Rejected because it scales
every build down equally — it is not a question, just a bigger health bar
— and at high armor it trends toward immunity, which is precisely the
"your main weapon does nothing and it feels awful" risk flagged as open
question #4 in the previous record.

### Agreed: flat reduction on `power`, with a floor

```
effectivePower = max(power - armor, power * 0.15)
```

This says something specific:

> **Armor makes many small hits worthless and leaves big hits nearly
> intact.**

A weapon landing 18 tiny pokes per second is shut down by a Sclerotic; a
weapon landing one big hit punches through almost unaffected. That makes
the counter language already written into the roster *mechanical* rather
than flavour — Behemoth answered by "burst, single-target," Sclerotic
answered by "penetration."

### Three things fall out for free

- **A Penetration support gem becomes obvious and load-bearing.** It
  subtracts from armor: useless against soft targets, essential against
  hard ones. A genuinely situational gem, which is rare and valuable.
- **It is a natural corrective to the Blades problem.** Blades at level 8
  fires ~18 `clearAt` calls/sec and was identified as simultaneously the
  top DPS *and* a gem printer. Flat armor reduction stops
  many-small-hits from being universally correct — without nerfing a
  single number.
- **The 15% floor guarantees nothing is ever immune.** A bad matchup,
  never a brick wall. That is the guard that stops open question #4 from
  biting.

### Sequencing

The armor field ships in Wave 1 at **~0** — Mote, Congealer and Behemoth
are all low-maturity by definition. It only starts mattering in 4C, when
maturity picks the type. Building the term now with a zero value costs
nothing and means Wave 2 needs no damage-path refactor.

---

## 9. Targeting, movement, rendering

### Targeting — unchanged

**Decision 45.** Default behaviour stays nearest-thing-wins; Threat
Priority remains a Phase 5 gem that *changes* the default rather than
introducing targeting as a concept.

Implementation: `nearestFrontierPoint` currently scans 48 sectors of the
frontier raycast. It gains a pass comparing against coagulant *surfaces*
(`dist − radius`) and returns whichever is nearer.

Coagulants become just another thing that is close — which is exactly what
§9 of the previous record predicted. A dirty near field means the guns are
chewing motes while the behemoth walks in, and that pressure emerges with
no special-casing anywhere.

### Movement — straight line

Straight line to the core, `speed` per coagulant. One seam to leave in
place from day one even though it is a Wave 2 concern: a hook where the
Carrier can later feed off the field it crosses. Cheap to leave, annoying
to retrofit.

### Rendering — into the slime layer, in the slime palette

**Decision 46.**

**The identity risk is real.** The instant mass detaches from the field it
can stop reading as slime and start reading as a monster, and the game's
whole look depends on it not doing that.

**The fix: draw coagulants into the slime layer, in the slime palette** —
not as a separate sprite layer on top. A coagulant's density maps to a
bucket colour exactly like a grid cell does, so a behemoth renders as the
brightest, densest slime in the game. Which is *true* — it literally is
the densest slime in the game. Same material, same lighting. It reads as
the field getting up and walking.

**The blob shape** — the cheap trick that looks expensive: 5–9 seed
circles of varying radius scattered within the body radius, all filled
flat in one colour. Overlapping flat circles merge into a lumpy organic
silhouette automatically — no metaballs, no blur filter, no per-pixel
work. Each seed gets a slow orbital drift and a `sin(t·f + phase)` radius
wobble so it breathes. One inset, slightly lighter fill supplies the wet
highlight.

**Seeds are generated at formation and stored on the entity — never
lazily inside a draw call.** That is the exact bug class that bit the
prototype three separate times (Decisions 4 and 7); `bubbleSeeds` was this
precise mistake.

**Wave 2 comes nearly free.** Blastoma is the same renderer with more
seeds and less overlap — visibly a bag of blobs rather than one blob,
which is exactly what it needs to communicate. Sclerotic is the same
shapes in the mature palette with flatter, plated edges.

The owner's note: *"we will probably have to polish the look later
anyway."* Agreed — this is the shipping approach for 3C, not the final
art.

---

## 10. The perimeter

The 🔴 question that blocked Phase 3A. **Decided: fixed for now, revisit
in Phase 8.** **Decision 38.**

It currently shrinks 100 → 45 via `TIERS_LIST`, which Decision 33 strips of
mechanical weight. Options were fixed, an independent time curve, or
breach-driven.

Fixed wins because the perimeter's job in the new model is much smaller —
it is the line where breach splatter starts bleeding the core, not the
primary difficulty lever. A time curve re-adds a scripted difficulty lever
the rework exists to make emergent; breach-driven fits the consequence
philosophy best but is an untested feedback loop with spiral risk, and
adding it *before* the horde exists means tuning it against a threat model
that is not there yet.

**3A is unblocked.**

---

## 11. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **Weapon levels as cards** | Dilutes the pool with treadmill filler and is the root cause of the "cards do nothing" bug. Replaced by enhancement points, which keep every card a build decision. |
| **Gem bundles as the deck unit** | Would bound the card pool permanently, but locks out combinations the player did not foresee at deck time. Owner's call: unlocked gems are universally live, because emergent mid-run builds are the more interesting game. |
| **Percentage armor reduction** | Scales every build down equally — a bigger health bar, not a question — and trends toward immunity. Replaced by flat reduction on `power` with a 15% floor. |
| **Summed-area table for region queries** | O(1) arbitrary-rectangle queries, but only pays off at thousands of queries/sec against a handful needed. Invalidation complexity not worth it on a field that changes every tick. |
| **Unbounded flood-fill for contiguous mass** | Returns the entire saturated wilderness as one region — §9's arithmetic in code form. Fixed by the radius cap, which is where the design actually lives. |
| **Compositing coagulants into the world grid** | Elegant (weapons would hit them for free) but they would scar terrain as they walk in Phase 4A, and nothing could distinguish coagulant from ground. |
| **Coagulants with separate HP** | Redundant. Mass already carries hit points, arrival damage and XP value; a second number would need manual syncing with all three and would break mass conservation. |
| **Perimeter on an independent time curve** | Re-adds a scripted difficulty lever the rework exists to remove. |
| **Perimeter breach-driven** | Best philosophical fit but spiral-prone, and untunable before the horde exists. Revisit in Phase 8. |

---

## 12. What is now settled, and what 3C still needs

### Settled

Everything named as open in the 2026-08-05 record:

| Was open | Now |
|---|---|
| 🔴 What drives the perimeter | Fixed (D38) — **3A unblocked** |
| Currency: stats or unlocks? | Unlocks only (D39) |
| Formation algorithm | Bounded flood-fill + coarse index (D43) |
| What a coagulant is in code | Mass-as-HP entity, one damage path (D42) |
| How weapons damage them | `clearAt`, unmodified formula (D42) |
| How weapons target them | Nearest-thing-wins, surface distance (D45) |
| Armor | Flat reduction with a floor (D44) |
| Movement | Straight line, Carrier hook left in (D42) |
| Rendering | Slime layer, slime palette, seed blobs (D46) |
| Card pool composition | Extensions + gems only; levels become enhancement points (D40) |
| Gem unlocks | Themed bundles (D41) |

Still deferred by design: `frozen`'s fate (Phase 5) and whether calcified
tissue blocks projectiles (prototype in Phase 4).

### What 3C still needs

**Numbers.** All of them — mass thresholds per size class, formation
radius and duration, transit speed, arrival damage and mass, splatter per
class, coagulants shed per event, the `k` in `r = k·√mass`, the risk
premium. The owner's instruction: *"every number will be up to you, then
we'll tweak it if needed."* That is what the 3C playtest gate exists for,
and the agreed dials remain arrival speed and arrival mass.

**Two tests worth writing first**, both invariants rather than mechanisms:

1. **Mass conservation** — total mass in grid + entities changes only by
   the amounts weapons destroy and growth adds. Catches every economy bug
   in one assertion.
2. **`contact.test.ts`'s "undefended core dies"**, carried through intact.
   It survives this redesign and is the best available proof the rework did
   not break lethality.
