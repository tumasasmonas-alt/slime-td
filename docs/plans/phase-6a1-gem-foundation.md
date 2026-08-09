# Phase 6A-1 — the gem foundation and the Amplifier class

**Status:** ✅ **Shipped 2026-08-09, greenlit in full alongside 6A-2 with
owner autonomy. Committed and pushed.** See DECISIONS.md #74 and "What
changed during implementation" below.

**What this is.** The first half of Phase 6A, split on the owner's call
after a pre-build review found the batch larger than 4C was when 4C was
split. 6A-1 makes gems **exist, be granted, be socketed, and change a
number.** 6A-2 makes them **do interesting things**.

The seam is deliberate: 6A-1 alone is playtestable as *"sockets work and
my numbers move"*, which is most of what the Phase 5 gate needs from the
gem side, and it lands the whole foundation before a single behavioural
gem is authored against it.

**Source:** `docs/plans/phase-6-roadmap.md` §3 (the batch this splits);
`docs/plans/phase-5-6-arsenal.md` §4 (the pipeline), §5 (sockets and
duplicates), §6 (attributes), §9A (the six Amplifier gems), §9½ (visual
cost), §11 (the card pool), §12 (settled calls 13/14/17/22/23);
`docs/plans/phase-5b-framework.md`; Decisions 40, 70, 71, 72.

---

## Table of contents

1. [What the owner settled](#1-what-the-owner-settled)
2. [The review finding that shaped this batch](#2-the-review-finding-that-shaped-this-batch)
3. [Delivery archetypes — the enabling structure](#3-delivery-archetypes--the-enabling-structure)
4. [`weaponMods` — the per-weapon modifier lookup](#4-weaponmods--the-per-weapon-modifier-lookup)
5. [The six Amplifier gems](#5-the-six-amplifier-gems)
6. [Gems as cards, inventory, and sockets](#6-gems-as-cards-inventory-and-sockets)
7. [Deleting the legacy passives](#7-deleting-the-legacy-passives)
8. [Modules touched](#8-modules-touched)
9. [Tests](#9-tests)
10. [The three questions, settled](#10-the-three-questions-settled)
11. [Order of work](#11-order-of-work)
12. [6A-2, in outline](#12-6a-2-in-outline)
13. [Risks](#13-risks)

---

## 1. What the owner settled

Six calls, 2026-08-09, all made before any code.

| # | Call | Consequence |
|---|---|---|
| 1 | **Split 6A into 6A-1 and 6A-2.** | This document is 6A-1. §12 outlines 6A-2. |
| 2 | **Gems reinterpret per weapon where possible** — rather than a legality whitelist, or socketing inert. | Multishot on Frost means *an extra pulse*, not a refused socket and not a dead gem. §3 is how this is made affordable. |
| 3 | **Size gem values large enough to compensate** for the deleted global passives. | §5's numbers are set against the old maxed passives rather than at face value. §7 has the arithmetic. |
| 4 | **A gem card opens the socket picker on pick.** | §10 Q1. Avoids rebuilding the *"cards appear to do nothing"* failure. |
| 5 | **The bundle card waits for 6A-2.** | §10 Q2. Six gems cannot form a package worth offering. |
| 6 | **The HUD's `DMG`/`SPD` become one overall-DPS readout.** | §10 Q3 / §10a — the owner's own answer, and better than the three options offered. |
| 7 | **Immolation Ring's missing visual folds into 6A** (moved up from 6B, 2026-08-09): a bright green ring/circle at its radius around the core, matching how it actually works — a periodic purge on a tower-centred radius. | Closes the oldest open item on the BACKLOG (open since the Phase 2 port) in the batch that's already touching every weapon's render path for the DPS/gem work. 6B still owns Immolation's three balance gaps and its real extensions — only the visual moves. |

**Call 2 was chosen against a cost warning that turned out to be
overstated, and the correction matters.** It was presented as costing
"18 × 20 authored meanings — exactly the N × M cost the pipeline exists
to avoid." That framing assumed reinterpretation happens **per weapon**.
Reading the seven shipped weapons back, it does not: it happens per
**delivery archetype**, of which there are five today and roughly a dozen
across the full 18-weapon catalogue. Several gems (Overclock most
obviously) collapse to one implementation across every archetype. The
owner's call is the better game *and* is affordable; the objection was
against a cost that isn't real.

---

## 2. The review finding that shaped this batch

The Phase 6 roadmap called 6A *"the cheapest possible batch to prove the
architecture on"*, citing §9½'s visual-cost table — 17 free, 3 modifier,
0 new. **That is a rendering measure and says nothing about behaviour
implementation cost.** Mapping all fourteen Behaviour gems onto where
they would actually be implemented:

| Where it really lives | Gems | Count |
|---|---|---|
| **Stage 3 (DELIVER)** — where §4's table assumes *all* of them live | Multishot, Formation | 2 |
| **Firing cadence** — needs deferred-emission state that doesn't exist | Echo, Barrage | 2 |
| **RESOLVE** — the stage 5A deliberately deferred | Splash, Overflow, Kickback, Priming | 4 |
| **Projectile flight/impact** — outside the four-stage model entirely | Pierce, Fork, Chaining, Homing, Ricochet, Bounce | 6 |

The arsenal plan's §4 says Behaviour gems *"multiply stage 3 emissions —
one function."* **That holds for 2 of 14.**

**This is not 5A being wrong**, and it should not be read as such. 5A
deferred RESOLVE with an explicit and correct reason — no gem existed to
prove it against, and generalizing blind was the over-built-abstraction
risk the plan itself flags. 6A is simply where that bill comes due. The
error was in the *estimate*, made by reading a rendering table as if it
were an implementation table, and it was caught before any code rather
than halfway through authoring twenty gems.

**The Amplifier class, by contrast, is genuinely O(1) in weapons** — it
needs one shared piece of structure (§4) and then each gem is close to a
line. 5A's bet pays off exactly where the plan predicted it would. That
is why 6A-1 is the Amplifier class: it is the honest test of the
pipeline's central claim, and it is the half that is actually cheap.

---

## 3. Delivery archetypes — the enabling structure

**`WeaponDef` gains one field**, and it is what makes call 2 affordable:

```ts
export type DeliveryKind =
  | 'projectile'   // travels, then impacts
  | 'orbital'      // bodies circling the tower
  | 'pulse'        // instant self-centred burst
  | 'cloud'        // persistent area placed at a point
  | 'ring';        // persistent self-centred standing area
```

| Archetype | Weapons today | Full-catalogue additions (6C–6G) |
|---|---|---|
| `projectile` | Bolt, Chain, Missile | Mortar, Fission Charge |
| `orbital` | Blades | — |
| `pulse` | Frost | Shockwave, Repulsor |
| `cloud` | Poison | Solvent, Mycelium |
| `ring` | Immolation | Resonance Coil |
| *(6C+ only)* | — | `beam` (Lance, Cauterizer), `summon` (Antibody), `tag` (Marker) |

**A gem reinterprets across archetypes, not weapons.** So Multishot is
one function with a five-way switch, not seven hand-written cases — and
the eleven weapons arriving in 6C–6G mostly land in archetypes that
already have a reading, inheriting every gem's behaviour for free. That
is the same property §9½ celebrated for rendering, applied to behaviour.

**Where a gem genuinely has no reading for an archetype**, it declares
that archetype unsupported and is never offered as a card for those
weapons nor socketable into them — so §11's *"never offer a dead card"*
still holds structurally. Call 2 makes this the **exception rather than
the rule**: the first move is always to find the honest reinterpretation,
and refusal is the fallback when there isn't one. In the Amplifier class
there are no refusals at all — all six read on all five archetypes.

---

## 4. `weaponMods` — the per-weapon modifier lookup

**The one piece of shared structure the whole gem system stands on.**

Today every weapon reaches for a global: `damageMult(state)` in six
`deliver` functions, `atkSpeedMult(state)` inside `cooldownReady`. Those
are whole-game multipliers with no notion of *which* weapon is asking —
which is exactly what a socketed gem needs them to have.

```ts
// systems/weaponMods.ts (new)
export interface WeaponMods {
  damage: number;     // multiplier
  rate: number;       // multiplier on fire rate (divides cooldown)
  area: number;       // multiplier on radii
  duration: number;   // multiplier on cloud/freeze/effect lifetimes
  velocity: number;   // multiplier on projectile speed
}

export function weaponMods(state: GameState, key: WeaponKey): WeaponMods;
```

It reads that weapon's socketed gems and folds them into one struct.
Every call site that currently reads a global passive multiplier reads
this instead, keyed by its own weapon.

**Why a struct rather than five functions:** a weapon's `deliver` needs
several of these at once, and one lookup that walks the socket list once
is both cheaper and harder to get inconsistently wrong than five walks.
It is also the natural place for 6A-2's additions and for Phase 6C+
gems to land without touching any weapon.

**Cache-free on purpose.** Sockets change only from the inventory screen,
never per frame, so a memo would be optimising a walk over at most five
entries against a correctness risk (a stale cache after a socket change
is a silent wrong-damage bug). Revisit only if profiling says so —
`systems/passives.ts` has done the same uncached walk since Phase 2
without ever appearing in a profile.

---

## 5. The six Amplifier gems

Per §9A, and each reads on all five archetypes.

| Gem | Effect | Archetype reading |
|---|---|---|
| **Amplifier** | +45% damage | Identical everywhere — `mods.damage`. |
| **Overclock** | +40% fire rate | Identical everywhere. `ring`/`cloud` read it as tick frequency; `orbital` as orbit speed. |
| **Expansion** | +30% area | `projectile` → impact radius; `orbital` → orbit radius; `pulse`/`ring` → radius; `cloud` → cloud radius. |
| **Extension** | +40% duration | `cloud` → cloud life; `pulse` → freeze duration; `ring` → burn persistence. `projectile`/`orbital` → no duration term, so **this is the class's one refusal** — not offered for them. |
| **Velocity** | +35% travel speed | `projectile` → speed; `orbital` → orbit speed; others have nothing that travels — **refused**. |
| **Attunement** | +3% damage per enhancement point invested in *this* weapon | Identical everywhere. The gem that argues with the build rather than adding to it (§9A). |

**On the values — these compensate deliberately, per the owner's call 3.**
The arithmetic they are set against is in §7. They are a **first draft
whose job is to keep the run's feel continuous across the passive
deletion**, not a balance pass — that is Phase 8, and the project's
standing posture (*"tune it gently"*) applies. Expect them to move.

**Attunement is the one to watch in play.** At +3%/point a weapon with 15
points invested gets +45% from it, matching Amplifier — and it *rewards
the specialise-vs-spread decision the socket ladder exists to create*,
which makes it the single most informative gem in this batch for the
Phase 5 gate's actual question. If enhancement still reads as a slider
with Attunement in the pool, that is a strong signal.

**Two duplicate rules apply and both are already settled** (§5, call 17):
the same gem may sit in several *different* weapons, never twice in one.
Cards grant gem **instances**, so three Amplifiers means having found
three.

---

## 6. Gems as cards, inventory, and sockets

Three pieces, and the third is the one 5C explicitly left unbuilt.

### 6a · A new card kind

```ts
| { kind: 'gem'; gemKind: GemKey }
```

Pooled in `buildWeaponSidePool()` alongside extensions and offered only
when it could actually be used — per §11's no-dead-card rule, a gem card
is offered only if **some** decked weapon has a free socket the gem is
legal for. It grants a `GemInstance` into `state.gemInventory`
(`nextGemId` already exists for this).

### 6b · Inventory

Already in `state.ts` since 5B — `gemInventory: GemInstance[]`,
`nextGemId`. `GemInstance.kind` is currently typed `string` with a
comment saying a real union replaces it wholesale in 6A. **This is that
moment**: it becomes `GemKey`.

### 6c · Socketing UI — the gap 5C left open

5C shipped socket dots as **read-only affordances**, in its own words
*"empty, labelled affordances rather than functioning picks."* There is
no way to put a gem in a socket. **Without this, the Phase 5 gate cannot
ask its question**, so it is core scope here rather than polish.

The interaction, built into the existing inventory overlay:

- **An empty socket dot is clickable** → opens a picker listing the
  legal, unsocketed gems in inventory for that weapon (filtered by
  archetype legality and the no-duplicates rule).
- **A filled socket is clickable** → unsockets, returning the gem to
  inventory. Non-destructive, matching call 13's *"no destructive respec,
  ever"* and `withdrawPoints()`'s existing behaviour exactly.
- **An unsocketed-gem count** shows somewhere on the screen, so a gem
  sitting unused is visible rather than forgotten.

`renderInventory()` already does a full rebuild on every change (5C's
documented choice), so a socket change is one more re-render — no
diffing, consistent with what is there.

---

## 7. Deleting the legacy passives

`damage` and `atkSpeed` are the last two passives on the pre-5B
mechanism. `systems/cards.ts` already names them as *"the one deliberate
exception to 'everything routes through sockets now'"*, held over
precisely until Amplifier and Overclock exist as real gems. **6A-1 is
what makes them exist, so they go in the same batch** — shipping both
mechanisms at once would mean two parallel systems for the same two
stats, and the gate immediately after would be judging a doubled-up
economy.

**What actually leaves the game, stated plainly:**

| | Old (passive, maxed) | New (gem, one weapon) |
|---|---|---|
| Amplifier | **+80% damage, every weapon** | +45% damage, one weapon |
| Overclock | **+72% fire rate, every weapon** | +40% fire rate, one weapon |

Those two together were roughly a **3× global DPS multiplier** available
to any run that took the cards. That is a large amount of power leaving,
and the owner's call 3 is to size the gems up rather than let the drop
land raw.

**It does not fully compensate, and it should not.** A three-weapon deck
can now hold at most one Amplifier per weapon rather than +80% on all
three at once, and sockets are contested with extensions the whole way up
the ladder. The intended direction is exactly this: **power moves from
flat, unconditional passives to build decisions**. Some net reduction is
the point.

**Flag it loudly at the gate.** If the game feels weaker after 6A-1,
that is the expected consequence of a deliberate change and not evidence
that the socket economy has failed. Recorded here so a gate reading has
the context — the same posture the 5B plan took toward known-thin gate
results.

`PASSIVE_DEFS` keeps `maxHp`/`regen`/`armor`/`pickup`/`xpGain`, which are
the five core gems and stay on their own track (call 22).

---

## 8. Modules touched

| Module | Change |
|---|---|
| **`tuning/gems.ts`** | **New.** `GEM_DEFS` — the six Amplifier gems, each with archetype support and per-archetype description text. |
| **`systems/weaponMods.ts`** | **New.** §4's lookup. Pure, no DOM, fully unit-testable. |
| **`systems/gemSockets.ts`** | **New.** Socket/unsocket, legality, duplicate rules. Pure, separate from the DOM per the systems/ui split `systems/cards.ts` established. |
| **`types.ts`** | `GemKey` union; `DeliveryKind`. |
| **`tuning/weapons.ts`** | `WeaponDef.delivery` on all seven; `maxLevel` **stays** for now (its deletion is 6B's, per the roadmap — not smuggled in here). |
| **`systems/cards.ts`** | The `'gem'` card kind, pooled with legality gating. |
| **`systems/passives.ts`** | `damageMult`/`atkSpeedMult` deleted; callers move to `weaponMods`. |
| **`weapons/*.ts`** (7) | `damageMult(state)` → `mods.damage`; `cooldownReady` takes the weapon's rate mod. Mechanical, one line each. |
| **`ui/inventory.ts`**, **`ui/weaponRow.ts`** | Clickable sockets, the gem picker, the unsocketed count. |
| **`ui/upgradeCards.ts`** | Render the gem card with **per-archetype description text** (§12's flagged load-bearing item), and open the socket picker on pick (§10 Q1). |
| **`ui/hud.ts`** | `DMG`/`SPD` replaced by a single overall-DPS readout (§10a). `ARMOR`/`PICKUP`/`XP`/`PTS` stay — those are genuinely still global. |
| **`grid/clear.ts`** | Accumulate destroyed mass into the DPS rolling window (§10a). Update pass only, never a draw call. |
| **`state.ts`** | `GemInstance.kind` narrows to `GemKey`; the DPS rolling-window accumulator. |

---

## 9. Tests

Invariants, per Decision 20.

| Test | Invariant |
|---|---|
| **A gem is never socketed twice in one weapon** | Call 17's rule, enforced structurally rather than by the UI. |
| **The same gem type may sit in several different weapons** | The other half of call 17 — a test that would fail on an over-strict fix to the one above. |
| **Unsocketing returns the gem to inventory** | No destructive respec (call 13). Conservation: gems in sockets + gems in inventory is constant across any socket/unsocket sequence. |
| **`withdrawPoints` closing a socket still returns gems** | 5B's existing behaviour, now with real gems in play for the first time — the path that was untestable when it was written. |
| **No gem card is offered that cannot be socketed anywhere** | §11's no-dead-card rule, over a randomised sweep of deck and socket states. |
| **`weaponMods` returns identity for a weapon with no gems** | The "changed nothing" baseline — catches a mod accidentally applying globally. |
| **A gem socketed in weapon A does not change weapon B's mods** | The single most important test in the batch. The whole per-weapon model is this property. |
| **Every gem has a description for every archetype it supports** | Enumerated over `GEM_DEFS × DeliveryKind`. Directly guards §12's *"cards appear to do nothing"* failure, which is a **description** bug in this project's own history. |
| **Every weapon in `WEAPON_DEFS` declares a `delivery`** | Catches a 6C-era weapon added without one, which would otherwise silently miss every gem. |

---

## 10. The three questions, settled

All three answered by the owner 2026-08-09, before any code.

**Q1 — When a gem card is picked, does it socket immediately or land in
inventory?** ✅ **Picking opens the socket picker inline.** Taken
literally, §5 would have a player pick "Amplifier", see nothing change,
and need a second screen to get any effect — **the 2026-08-05 "cards
appear to do nothing" failure mode rebuilt**, in the project that named
it. Instead the pick shows the picker immediately, same reasoning 5C used
for its Manage Loadout button (*"just got a point is exactly when you
want to spend one"*), and the player chooses which weapon receives it —
so the build decision stays the player's rather than being auto-assigned.
Dismissing without socketing drops the gem to inventory, so nothing is
ever lost (call 14).

**Q2 — Does the bundle card ship in 6A-1 or 6A-2?** ✅ **6A-2.** Six
Amplifier gems cannot form a package worth offering; *"Amplifier +
Overclock"* teaches nothing a single card doesn't. Same reasoning that
deferred it out of 5B, where it would have bundled placeholders.

**Q3 — What happens to the HUD's `DMG`/`SPD` readout?** ✅ **Replaced by
a single overall-DPS readout** — the owner's own answer, and better than
any of the three options offered.

### 10a · The DPS readout, and the tension it resolves

The `DMG`/`SPD` lines exist because of a real playtest finding — *"upgrade
cards gave no visible confirmation of what they changed"* (BACKLOG
*Done*). So the obvious worry about replacing them with a **measured**
number is that measured DPS does not jump the instant a gem is socketed,
which is exactly the confirmation the line was built to give.

**That worry is already answered, and by 5C.** The inventory screen shows
live per-weapon stat lines that update the moment a socket changes —
immediate, specific, and per-weapon, which is strictly better
confirmation than a global multiplier ever was. The confirmation job has
moved. That frees the HUD line to do the thing it could never do before:
report **what the core is actually accomplishing**, which is the number
a player in a fight actually wants and the one that survives eighteen
weapons.

**Implementation:** a rolling-window measure sourced from `clearAt` —
the single choke point every damage path in the game already routes
through (Decision 42's whole point, and the reason eighteen weapons
against seven coagulant kinds was never a compatibility matrix).
Accumulate in the update pass, never in a draw call (the rule three
prototype bugs came from breaking — Decisions 4 and 7), and decay over a
few seconds so the number reads as a live rate rather than a
run-cumulative total.

**Measure mass destroyed, not damage requested.** Resistance, armour and
maturity all sit between a weapon's damage number and what it actually
removes, and this readout is worth having precisely *because* it shows
that gap — a build whose nominal damage doubled but whose real output
barely moved against a hardened scar ring is a thing the player should be
able to see. It also makes the readout meaningful for the no-damage
support weapons arriving in 6F, which have a nominal DPS of zero.

---

## 11. Order of work

| # | Step | Done when |
|---|---|---|
| 1 | `DeliveryKind` + `WeaponDef.delivery` on all seven. | Typecheck clean; no behaviour change. |
| 2 | `systems/weaponMods.ts` with an identity implementation (no gems yet). | Unit-tested; game behaviour identical. |
| 3 | Move all seven weapons off `damageMult`/`atkSpeedMult` onto `weaponMods`. Delete the two passives and their cards. | **The power drop lands here**, isolated and reviewable on its own. |
| 3b | Replace the HUD's `DMG`/`SPD` with the overall-DPS readout (§10a) — `clearAt` accumulation, rolling window, update-pass only. | Reads a live rate; visibly drops when fighting hardened ground. Lands *before* step 4 so the drop in step 3 is measurable rather than inferred. |
| 4 | `tuning/gems.ts` + `GemKey`, the six Amplifier gems, wired into `weaponMods`. | A hand-socketed gem provably changes one weapon's numbers. |
| 5 | `systems/gemSockets.ts` — socket/unsocket/legality/duplicates. | Pure, tested, no UI. |
| 6 | Socketing UI in the inventory screen. | A gem can be socketed and unsocketed by clicking. |
| 7 | The `'gem'` card kind + per-archetype descriptions, **opening the socket picker on pick** (§10 Q1) — reusing step 6's picker rather than building a second one. | A gem card grants, prompts, and sockets in one motion; dismissing drops it to inventory. |
| 8 | Immolation Ring's visual — a bright green ring drawn at its tower-centred radius, matching `weapons/immolation.ts`'s actual burn radius so the visual and the hitbox agree. | Visible around the core whenever Immolation Ring is decked; no console errors. |
| 9 | **Verify live** — socket an Amplifier, watch the stat line and actual damage move; unsocket it; withdraw points to force a socket closed and confirm the gem returns; confirm no gem card appears with no legal home; confirm Immolation Ring's ring renders and matches its radius. | Zero console errors; typecheck and build clean. |

**Step 3 is the one to be careful with.** It is a real power change to a
playable game, touching all seven weapons, and it is deliberately its own
step so it can be played *before* gems exist to mask it. If the game
feels wrong there, that is information about the drop, uncontaminated by
anything else in the batch.

---

## 12. 6A-2, in outline

Planned properly when 6A-1 closes; recorded now so the split's far side
isn't a blank.

- **The RESOLVE stage**, finally built — with four real gems (Splash,
  Overflow, Kickback, Priming) proving it, which is the condition 5A set
  for building it at all.
- **Projectile behaviour flags** on the `Projectile` entity — `pierce`,
  `forks`, `chains`, `homing`, `bounces` — generalizing
  `systems/projectiles.ts` out of its `p.type === 'chain'` switch. Six
  gems ride this.
- **Deferred emissions** for Echo and Barrage.
- **Multishot and Formation**, the two that genuinely are stage-3
  functions.
- **The bundle card** (Q2), with enough gems to bundle.

Then **6B** (incumbent extensions, Immolation's visual and balance fixes,
`maxLevel` deleted), then **the Phase 5 gate**.

---

## 13. Risks

**1. Step 3's power drop is judged in isolation and may read as "the game
got worse."** That is the honest cost of the passive→gem move and the
reason it gets its own step. The mitigation is sequencing and
expectation-setting, not a number.

**2. The compensating gem values are guesses.** +45%/+40%/+30%/+40%/+35%
are set to keep a focused weapon near its old ceiling, not derived from
anything measured. Every phase since 4A has retuned its first-draft
constants after running the game; assume these will too.

**3. Reinterpretation could still creep.** Five archetypes is affordable;
the discipline is that a gem's behaviour switches on **archetype**, never
on `WeaponKey`. The moment a gem needs to know it is looking at Bolt
specifically, that is the N × M cost arriving after all, and it should be
raised rather than written.

**4. Attunement makes the gate's question sharper — and could make it
harder to read.** It rewards concentration, so it partly *manufactures*
the "specialising is worth it" answer the gate is trying to measure
independently. Worth remembering when reading the result: a gate that
says "specialising feels good" needs checking against whether that is the
socket ladder or just Attunement.

**5. Socketing UI is the first genuinely interactive thing in the
inventory screen.** 5C's screen only ever rendered and incremented. A
picker, legality filtering and unsocket-to-inventory is more state than
that screen has carried, and 5C's own history — finding a real bug in 5B
the moment a button became its first live caller — is the precedent for
expecting something to surface here.

---

## What changed during implementation

Built as planned, close to the letter — the archetype abstraction, the
`weaponMods` struct, all six Amplifier gems, sockets/inventory, and the
DPS readout all shipped as designed. Two deltas worth recording:

**`WeaponDef.stats()` needed a `mods` parameter that the original plan
didn't call out.** It was pure `(lvl) => string`, so once gems existed to
socket, the inventory screen's live stat line had nothing to read them
from — a real, if narrow, gap in the plan's own module list. Fixed by
widening the signature to `(lvl, mods = IDENTITY_MODS)` and threading
`weaponMods(state, key)` through `ui/weaponRow.ts`. Verified live: Bolt
Turret's line moved from "15 pwr" to "22 pwr" after one Amplifier gem
(15 × 1.45 = 21.75 → 22). See DECISIONS.md #74.

**Immolation Ring's missing visual was folded in on the owner's request**
after this plan was written but before the batch shipped — not part of
the original §1 scope, added when the owner greenlit the full build:
*"Immolation ring has no visual make a bright green circle where
imolation ring siths aroud the core. Fold this fix into 6A."* Shipped as
`render/immolationRing.ts`, a persistent `#39ff6a` stroke at
`immolationRadius(lvl, perimeter) * mods.area`. See DECISIONS.md #75.

Live verification also surfaced that the Browser pane wasn't compositing
frames this session (`document.visibilityState === 'hidden'`) — worked
around with a temporary debug harness (`window.__debugTick`/
`window.__debugState`, modeled on Decision 59's precedent), removed
before commit with a byte-identical bundle hash confirming clean removal.

495/495 tests (final count, combined with 6A-2), typecheck clean, build
clean. **Committed and pushed alongside 6A-2** — see DECISIONS.md #74.

---

*Planned 2026-08-09, shipped 2026-08-09. §10's three questions were
settled the same day; DECISIONS.md #74 records the shipped decision.*
