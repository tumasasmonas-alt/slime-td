# Phase 6B-2 — the 28 extensions, and the four mechanisms under them

**Status:** ✅ **Shipped 2026-08-10**, in the same pass as 6B-1 (the
owner greenlit both together with full autonomy rather than gating them
separately). The content half of 6B. Its shared context — the
vocabulary fix, the two findings, the settled questions, the extension
framework — lives in **`docs/plans/phase-6b-incumbent-extensions.md`**
and is not repeated here. This document is the implementation detail:
what each of the four new mechanisms actually is in code, and what each
weapon module gains.

**Two things this plan got wrong, both caught by this batch's own
outcome tests before reaching the browser** (Decision 80):

- **Shatter Core's `shatter` field was specified ambiguously** — §2
  calls it "the damage multiplier," which the first implementation took
  literally (`opts.shatter` applied directly). Every extension's actual
  *value* (0.3/0.45/0.6) was authored as a `+X%` bonus fraction, matching
  every sibling field in the codebase — applied literally, a level-1
  Shatter Core hit dealt 70% *less* damage, the opposite of the card's
  own description. Fixed to `1 + opts.shatter` in `grid/clear.ts`.
- **Chill Field's duration was specified as a `max()` against the base
  freeze** (§2's own worked example). The base (`FREEZE_DURATION = 2.0`)
  always exceeds every one of Chill Field's own values (0.4–0.8s), so a
  `max()` makes the extension a silent no-op — caught by its own outcome
  test, fixed to add instead (`weapons/frost.ts`).

Both are the exact failure mode this project's tests exist to catch
before a playtest does — see Decision 20 ("guard bugs with tests,
prefer the invariant over the mechanism").

**Precondition:** 6B-1 ships first — the two socket lines, the
`EXTENSION_DEFS` catalogue, `systems/extensions.ts`, and the UI. 6B-2
adds no plumbing; it is content plus four contained mechanisms.

**The tables of 28** (name, effect, level curve, channel) are in the
umbrella plan's §6 and are the authority on *what* each extension does.
This document says *how*.

---

## Table of contents

1. [A finding that changes three of the 28](#1-a-finding-that-changes-three-of-the-28)
2. [Mechanism 1 — coagulant chilling](#2-mechanism-1--coagulant-chilling)
3. [Mechanism 2 — the coagulant armour debuff](#3-mechanism-2--the-coagulant-armour-debuff)
4. [Mechanism 3 — regrowth suppression](#4-mechanism-3--regrowth-suppression)
5. [Mechanism 4 — the ring's second radius](#5-mechanism-4--the-rings-second-radius)
6. [New state and options, in one place](#6-new-state-and-options-in-one-place)
7. [Per-weapon touchpoints](#7-per-weapon-touchpoints)
8. [Order of work](#8-order-of-work)
9. [Tests](#9-tests)
10. [Risks](#10-risks)

---

## 1. A finding that changes three of the 28

🔴 **Three extensions, as written in the catalogue, would be silently
non-functional — and it is prototype bug #5's exact failure mode.**

`CLAUDE.md`'s own sharp-edge list:

> Tower-centered weapon radii must never be smaller than `perimeter`;
> use `towerCenteredRadius()`. Getting this wrong made a whole weapon
> silently non-functional in the prototype.

`bladeRadius`, `frostRadius` and `immolationRadius` all floor at
`perimeter` for that reason — the infection arrives *at* the perimeter,
so anything inside it sweeps empty space. Three of the 28 describe a
**second, inner** ring:

| Extension | As catalogued | Why it breaks |
|---|---|---|
| Immolation · **Second Ring** | "a second concentric ring" — read as inner in this plan's own first draft | An inner ring sits inside the perimeter, where there is no tissue |
| Blades · **Counter-Rotation** | "a second ring spinning the other way" | Same, if the second ring is placed inward |
| Frost · **Chill Field** | "at 60% of nova radius" | Same — 60% of a perimeter-floored radius is inside the safe zone |

**The fix is uniform and costs nothing: every second ring goes outward.**

- **Second Ring** → a concentric ring at **1.4×** the main radius.
- **Counter-Rotation** → the reversed-spin blades orbit at **1.25×**.
- **Chill Field** → the aura sits at the nova's **own** radius, not a
  fraction of it.

This is also better content than the inward reading: a *wider* burning
perimeter and a *wider* counter-rotating ring both mean more ground
covered, which is what the player expects from the card's name. The
inward version would have been a card that reads well, sockets fine,
and does nothing — *"cards appear to do nothing"* (2026-08-05) wearing
its third hat.

**Guarded by the existing test, extended.** `tuning/weaponGeometry.test.ts`
already enumerates every tower-centred radius function against the
perimeter floor — the test written in 5A specifically to close this blind
spot. Every new radius introduced here joins that enumeration rather than
getting a bespoke test.

---

## 2. Mechanism 1 — coagulant chilling

**Carries:** Frost · *Shatter Core*. **Closes:** the umbrella plan's
finding 2 (Frost's freeze does nothing to coagulants).

### The shape

```ts
// state.ts — Coagulant
chilledUntil: number;   // state.time past which the chill has lapsed; 0 = never chilled

// grid/clear.ts — ClearOptions
chill?: number;         // seconds of chill this hit applies to coagulants it touches
shatter?: number;       // damage multiplier against an already-chilled coagulant
```

`systems/extensions.ts` puts `chill` on Frost's `ClearOptions` whenever
Shatter Core is socketed, alongside the `freezeDuration` Frost already
passes; `shatter` is set by the same extension at its level's value.

### Where it is read

**In `clear.ts`'s coagulant loop, not in `frost.ts`** — the card says a
chilled coagulant takes bonus damage *from any source*, so the read has
to live at the one damage path (Decision 42: `clearAt` is the only
damage path, and stage 4 "may add new `ClearOptions`; it may not add a
second damage path"). One multiplier, applied beside the existing
`primingMult`:

```ts
const chilled = c.chilledUntil > state.time;
const shatterMult = chilled && opts.shatter ? opts.shatter : 1;
```

Setting and reading in the same loop has one ordering rule worth stating:
**a hit that applies chill does not itself benefit from it.** Read the
flag before writing it, or Frost silently doubles its own damage and
Shatter Core stops being a setup card at all.

### Visual

A chill rim on the coagulant, reusing `#bfe9ff` — the colour Phase 4B
already established for frozen cells (Decision 66). Per Decision 11 as
amended by the BACKLOG's own process finding (*"the rule should be
scoped to any mechanic with a world-space effect, not just weapons"*), a
state the player must see to play around gets a visual in the batch that
creates it, not in Phase 9.

---

## 3. Mechanism 2 — the coagulant armour debuff

**Carries:** Poison · *Corrosive*. Also the read half of Missile ·
*Bunker Buster*, which needs no debuff of its own but reads the same
effective-armour value.

### The shape

```ts
// state.ts — Coagulant
armorDebuff: number;       // fraction stripped, 0..1
armorDebuffUntil: number;

// grid/clear.ts — ClearOptions
armorShred?: number;       // fraction to strip, and for how long (fixed 2s)
armorScaled?: number;      // Bunker Buster: +this much damage per point of armour
```

### Where it is read

`clear.ts` already computes:

```ts
const effectivePower = Math.max(power - c.armor, power * COAGULANT_ARMOR_FLOOR);
```

`c.armor` becomes an `effectiveArmor(c, state.time)` helper —
`c.armor * (1 - activeDebuff)`. **The floor stays.** Arsenal plan §12.3
settled this explicitly for Penetration and it applies identically here:

> Penetration cannot push past Decision 44's armor floor.

Corrosive strips armour; it does not remove the floor. A coagulant with
all its armour shredded still takes at most the floor-limited hit, so
armour never becomes irrelevant — it becomes *answerable*, which is the
coverage gap the design asked a weapon to fill.

Bunker Buster reads the same effective value in the opposite direction:
more armour, more damage. The two compose correctly and interestingly —
Corrosive *reduces* what Bunker Buster scales on, so running both on one
target is deliberately mediocre. That is a real interaction, not a bug,
and it belongs in the record before someone "fixes" it.

---

## 4. Mechanism 3 — regrowth suppression

**Carries:** Frost · *Rime*, and Immolation · *Ash*. **Reused by:**
Cauterizer (6E), whose sterilisation is this primitive turned into a
weapon's identity.

### The shape

Two `Float32Array`s on `Grid`, sized like the existing `frozen`:

```ts
regrowMult: Float32Array;    // 1 = normal; <1 while suppressed
regrowTimer: Float32Array;   // seconds remaining
```

Separate from `frozen` on purpose: `frozen` is binary and total (growth
stops), suppression is partial and graded. Folding them would mean
either losing the gradation or reinterpreting an existing field that
`systems/growth.ts`, `grid/slimeLayer.ts` and `clear.ts` all already
read — the kind of overloading that produced the "passive hiding a
weapon" problem (Decision 70).

### Where it is read and decayed

`systems/growth.ts` **already iterates every cell and already decays
`frozen` in that loop.** Suppression decays in the same pass and
multiplies the same growth term — no new loop, two more array reads per
cell.

**This is the one performance-sensitive change in 6B-2.** The 3C playtest
found a real 5–10fps stretch (Decisions 54–59), and the growth pass is
the hot path. Mitigation: the timer array is checked first and short-
circuits (`if (regrowTimer[i] > 0)`), so the multiply is paid only on
suppressed cells, which are a small fraction of the field. Measured
before the batch is called done, not assumed — Decision 60's precedent.

### Written by

A new `ClearOptions.suppressRegrowth?: { mult: number; seconds: number }`,
set by Rime (on cells whose freeze it accompanies) and Ash (on every cell
the ring burns).

---

## 5. Mechanism 4 — the ring's second radius

**Carries:** Immolation · *Second Ring*, and *Flare*.

The smallest of the four, and the only one whose cost is in the **render
layer** rather than a system.

`weapons/immolation.ts` currently does one `clearAt` at
`immolationRadius(lvl, perimeter) * mods.area` and pushes one `novaFx`.
It gains:

- **Second Ring** — a second `clearAt` at **1.4×** that radius (§1), at
  the level's power fraction.
- **Flare** — every 4th tick, one further `clearAt` at 1.8× plus its own
  `novaFx`, using the existing tick counter Overcharge introduces
  (`state.weaponShots`), so no second counter is needed.

`render/immolationRing.ts` currently draws one stroke from
`state.weapons`/`state.grid` directly. It gains a second stroke when
Second Ring is socketed, reading the same radius function — **the render
must not compute its own radius**, or the visual and the damage drift
apart, which is the exact desync 6A-2 refused to risk when it declined
to wire Homing into this weapon.

**A note for 6F/6I, recorded now:** giving the ring a shared,
non-tower-assumed origin is what would let Homing and Multishot finally
work on Immolation (BACKLOG). 6B-2 does *not* do that — it adds radii,
not origins — so that entry stays open and stays honest.

---

## 6. New state and options, in one place

Every field 6B-2 adds, so a reviewer can see the whole surface at once.

| Where | Field | For |
|---|---|---|
| `Grid` | `regrowMult`, `regrowTimer` | Rime, Ash |
| `Coagulant` | `chilledUntil` | Shatter Core |
| `Coagulant` | `armorDebuff`, `armorDebuffUntil` | Corrosive |
| `GameState` | `weaponShots: Partial<Record<WeaponKey, number>>` | Overcharge, Flare |
| `GameState` | `bladeStreak: number[]` | Serration |
| `GameState` | `lastCoagulantDeathAt: number` | Bladestorm |
| `ClearOptions` | `chill`, `shatter` | Shatter Core |
| `ClearOptions` | `armorShred`, `armorScaled` | Corrosive, Bunker Buster |
| `ClearOptions` | `suppressRegrowth` | Rime, Ash |
| `Projectile` | `reacquire`, `proximityFuse`, `cluster`, `splitArcAt`, `hopGrowth`, `finalHopMult`, `densityBias` | Bolt / Chain / Missile extensions |

`lastCoagulantDeathAt` is one line in `splatterOnDeath()`, which is
already the single place a coagulant dies.

**None of these are read per-frame across the whole field except the two
`Grid` arrays**, which §4 covers. The rest are per-entity or per-weapon
and cost nothing measurable.

---

## 7. Per-weapon touchpoints

| Weapon | Module work | New mechanism needed |
|---|---|---|
| **Bolt** | Heavy Slug is pure `mods` (no code). Twin Barrel offsets a second emission origin; Overcharge reads a shot counter; Tracking Rounds sets `reacquire` and `systems/projectiles.ts` re-runs `nearestFrontierPoint` on a cadence | none |
| **Chain** | All four are per-projectile fields consumed inside `projectiles.ts`'s existing `chain` branch — `hopGrowth`/`finalHopMult` modify `CHAIN_DAMAGE_DECAY`'s application, `densityBias` weights `findNextChainHop`, `splitArcAt` spawns one branch via `spawnForks`'s return-children shape | none |
| **Missile** | Proximity Fuse and Cluster Warhead are `projectiles.ts` missile-branch additions; Salvo reuses 6A-2's deferred-emissions queue; Bunker Buster is a `ClearOptions` field | mechanism 2 (read half) |
| **Blades** | Counter-Rotation adds an outward reversed ring (§1); Serration reads/writes `bladeStreak`; Bladestorm reads `lastCoagulantDeathAt`; Whirl scales `HIT_RADIUS` briefly per blade | none |
| **Frost** | Chill Field is a per-tick freeze write at the nova's own radius; Shatter Core sets `chill`/`shatter`; Rime sets `suppressRegrowth`; Freeze Duration is pure `mods` | mechanisms 1, 3 |
| **Poison** | Corrosive sets `armorShred` on the cloud's tick; Lingering Spores adds outward drift (the `homing` drift field 6A-2 added is the precedent); Twin Canister spawns a second differently-shaped cloud; Cloud Radius is pure `mods` | mechanism 2 |
| **Immolation** | Second Ring and Flare per §5; Backdraft samples density around the ring before its `clearAt`; Ash sets `suppressRegrowth` | mechanisms 3, 4 |

**Four of the 28 need no code at all** — Heavy Slug, Freeze Duration,
Cloud Radius, and (once `mods` carries a negative `rate`) nothing else.
That is the framework paying for itself, and it is the number to check
6B-1's design against: if it comes out lower than four, the `mods`
channel was built too narrow.

---

## 8. Order of work

| # | Step | Why here |
|---|---|---|
| 1 | The three outward-radius corrections (§1) into `EXTENSION_DEFS`' data, and every new radius added to `weaponGeometry.test.ts`'s enumeration | The guard goes in before the content that needs it, not after. |
| 2 | **Bolt, Chain, Missile** — 12 extensions, all on existing channels (Bunker Buster's `armorScaled` is one new `ClearOptions` field) | The honest test of 6B-1's framework. If twelve extensions land without touching the growth pass, the framework holds. |
| 3 | Mechanism 1 — coagulant chilling, with its visual | Smallest of the three remaining; one field, one read, one rim. |
| 4 | Mechanism 2 — the armour debuff, with the floor test | Second smallest; the floor is the part to get right. |
| 5 | Mechanism 3 — regrowth suppression, **with a measurement** | The only performance-sensitive change (§4). Measured before moving on. |
| 6 | Mechanism 4 — the ring's second radius, render included | |
| 7 | **Blades, Frost, Poison, Immolation** — 16 extensions | Content on top of steps 3–6's primitives. |
| 8 | Full verification — 28 outcome tests, table completeness, live in-browser | |

Mechanisms land **before** the content that depends on them and each is
tested alone, so a failure is attributable to one change rather than to
whichever of sixteen extensions was being written at the time.

---

## 9. Tests

Beyond the umbrella plan's §10:

- **One outcome test per extension**, shaped "socket it, run the weapon,
  assert the outcome moves in the stated direction." Not "assert the
  field was set" — Decision 20's invariant-over-mechanism rule, and the
  only shape that would have caught 6A-2's `spawnForks` bug.
- **Every new tower-centred radius is in `weaponGeometry.test.ts`'s
  enumeration** and clears the perimeter floor at every level (§1). This
  is the batch's most important single test.
- **A hit that applies chill does not benefit from it** (§2's ordering
  rule) — an invariant that reads as a nitpick and is actually the
  difference between a setup card and a stealth damage doubler.
- **Corrosive cannot push damage past `COAGULANT_ARMOR_FLOOR`** (§3) —
  the constraint arsenal §12.3 settled, pinned so a later "why is armour
  still mattering" retune can't quietly remove it.
- **Suppression decays to exactly 1.0** and never leaves a cell
  permanently slowed — the field-state equivalent of a leak, and
  invisible in play until a run goes long.
- **A growth-pass benchmark** before and after mechanism 3, recorded in
  the as-built delta. Not a pass/fail test; a number in the record, per
  Decision 60.

---

## 10. Risks

**1. Sixteen extensions ride four mechanisms that do not exist yet.** If
one mechanism is wrong, four extensions are wrong with it. §8's ordering
is the mitigation — each mechanism is built and tested with no content
on top of it.

**2. The growth pass is the hot path and 6B-2 adds to it.** §4. The 3C
playtest is the precedent for how this goes wrong, and a measurement is
scheduled rather than an assumption.

**3. `clear.ts` gains four new `ClearOptions` fields**, on top of the
five 6A-2 added. That function is now the junction for every damage
modifier in the game. It is still one damage path (Decision 42 holds),
but it is getting wide, and *"a second damage path"* will start to look
tempting around 6E. Worth naming now: the answer stays no, and if the
option struct is genuinely unwieldy the fix is grouping the fields, not
forking the function.

**4. Three of the 28 were non-functional as designed** (§1) and were
caught by reading a `CLAUDE.md` sharp-edge note, not by a test. There
may be a fourth. The perimeter-floor enumeration is the systematic
answer; the batch should not rely on having noticed.

---

*Written 2026-08-10. Plan only. Shared context, the settled questions
and the tables of 28 are in
`docs/plans/phase-6b-incumbent-extensions.md`; the as-built delta goes
at the top of this file when 6B-2 ships.*
