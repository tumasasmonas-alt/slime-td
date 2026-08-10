# Phase 6B — two socket lines, and the incumbents' 28 extensions

**Status:** ✅ **Shipped 2026-08-10, greenlit with full autonomy
("Greenlit with full autonomy... Go ahead granted").** §8's six
questions were settled the same session this plan was written; the
owner then greenlit both 6B-1 and 6B-2 together rather than reviewing
each build separately, so both landed in one pass (Decisions 77–80)
despite the umbrella plan's own §9 keeping them as an ordering within
one batch rather than two. Two real bugs were caught by the batch's own
outcome tests before reaching the browser and are recorded in Decision
80 and `docs/plans/phase-6b2-extension-content.md`'s own delta — neither
was anticipated by this document. 589/589 tests (up from 513, 76 new),
typecheck clean, build clean, verified live (methodology note below).

**What this batch is.** Two things, split into two sub-batches:

- **6B-1** rebuilds the loadout screen's sockets into **two separate
  lines per weapon** — extensions and support gems no longer share, a
  deliberate reversal of `phase-5-6-arsenal.md` §5 that restores
  **Decision 32**'s original intent.
- **6B-2** replaces the single `'placeholder'` *Prototype Mount* with
  **28 real extensions** — four per weapon across the seven incumbents.

Plus the two standing cleanups parked here since 5A: Immolation Ring's
missing `WEAPON_DAMAGE_SCALE` pass, and `WeaponDef.maxLevel`'s deletion.

**This document is the umbrella plan and 6B-1's own plan** — shared
context (the vocabulary fix, the findings, the settled questions, the
framework) plus everything 6B-1 builds. **6B-2 is planned in full
separately:** `docs/plans/phase-6b2-extension-content.md`. Same shape
6A used, one document per sub-batch.

**Why it matters beyond its own content.** The Phase 5 gate runs
immediately after, and it was moved here twice for one reason: a weapon's
sockets hold *either* an extension *or* a gem, and until both are real
content the gate's question — *is enhancement a decision or a slider?* —
cannot be asked honestly. 6B finishes that precondition, and 6B-1
changes the shape of the question itself.

**Source:** `docs/plans/phase-6-roadmap.md` §3; `phase-5-6-arsenal.md`
§5, §7, §11, §15; Decisions 32, 40, 70–76; the code at `3e5399f`.

---

## Table of contents

1. [A vocabulary fix, first](#1-a-vocabulary-fix-first)
2. [6B-1 — two socket lines](#2-6b-1--two-socket-lines)
3. [What ships, and what does not](#3-what-ships-and-what-does-not)
4. [Two findings from reading the catalogue against shipped code](#4-two-findings-from-reading-the-catalogue-against-shipped-code)
5. [The extension framework](#5-the-extension-framework)
6. [The 28](#6-the-28)
7. [The two cleanups](#7-the-two-cleanups)
8. [The six questions, and how the owner settled them](#8-the-six-questions-and-how-the-owner-settled-them)
9. [Order of work](#9-order-of-work)
10. [Tests](#10-tests)
11. [Risks](#11-risks)

---

## 1. A vocabulary fix, first

**"Pool" has been doing two unrelated jobs across the design docs, and
it caused a real miscommunication during this plan's own review.**

- The **card pool** — what a level-up offers: extensions, core gems,
  support gems (`systems/cards.ts`).
- The **socket pool** — `phase-5-6-arsenal.md` §5's own heading for
  "extensions and gems compete for the same sockets on a weapon."

The owner diagnosed it directly: *"I think what happened is a
miscommunication as I misunderstood because we call a pool offered on
level up and a pool of sockets the same."* A review question about
sockets read as a question about cards, and a whole exchange went past
each other before either side noticed.

**From here: "card pool" and "sockets". Never "socket pool."** 6B-1
renames §5's heading and the handful of ambiguous comments in
`systems/cards.ts` and `tuning/sockets.ts` as part of its work — cheap,
and this is the second time vocabulary has cost this project a round
trip (the first was "passive" hiding a weapon for three phases, Decision
70).

**Nothing about the card pool changes in this batch.** It offers
extensions, core gems and support gems; a specific extension is offered
only while it is unowned or can still be levelled; at level 3 it leaves
permanently. That is the owner's 5B rule, reaffirmed unchanged during
this review, and every 6A-3 behaviour around it stands.

---

## 2. 6B-1 — two socket lines

### 2.1 · The change

Every weapon gets **two independent socket lines**:

| Line | Capacity | Opens on |
|---|---|---|
| **Extensions** | 0 → 1 → 2 | 0–4 / 5–9 / 10+ points invested |
| **Support gems** | 1 → 2 → 3 → 4 → 5 | 0 / 3 / 8 / 15 / 24 points invested (**unchanged**) |

An extension can only enter the extension line; a gem can only enter the
gem line. A fully-invested weapon holds **2 extensions + 5 gems = 7**,
against 5 total today.

**The capacity increase is intended, not a side effect** — the owner's
own words: *"for the consequence this was intended from the start."* It
is recorded here as a deliberate design position rather than carried to
the gate as a risk.

### 2.2 · Why it reverses §5, and what that supersedes

`phase-5-6-arsenal.md` §5 argued for one shared line, and §15 lists
separate lines in its rejected table — *"two UIs, two rules, and it
removes the specialise vs. generalise question that shared sockets ask
for free."* That argument is now overruled by the owner, and the reason
is the one §5 traded away:

**With four extensions designed per weapon and two slots to hold them,
the contest is permanent.** Under the shared line it was not. The socket
ladder gives 3 sockets at 8 points and 5 at 24, so from 8 points on, a
weapon could hold every extension it had, and from 24 it held all of
them *plus* two gems. §5 saw that and defended it — *"deep investment
buying the end of a tradeoff is a payoff, not a design leak"* — but that
is precisely the shape the Phase 5 gate exists to catch, and it is the
opposite of what Decision 32 set out to build.

**This restores Decision 32 rather than departing from it.** That
decision, from the 2026-08-05 rework, reads:

> PoE-style: weapon slots (unlocked with currency), **per-weapon
> extension slots**, universal support gems. […] **Deliberately more
> extensions than slots**, so the choice is contested — that is what
> makes the inventory screen earn its existence.

**Two record-keeping items fall out, both disclosed rather than fixed
quietly** (`CLAUDE.md`'s ground-truth protocol):

1. `phase-5-6-arsenal.md` §5 **superseded a clause of Decision 32 in
   2026-08-08 without recording it**, and revision 3's own summary
   claims *"No decision is superseded — zero."* That claim is wrong on
   this point. Decision 32 gets the supersession note it never got, and
   then a second note saying 6B-1 restores it.
2. §15's rejected-ideas row for separate socket lines gets a
   "**reversed 2026-08-10**" annotation rather than being deleted — the
   argument it records is still the honest cost of this change, and a
   future reader should see the trade, not just the outcome.

### 2.3 · What it touches

| Module | Change |
|---|---|
| `tuning/sockets.ts` | `socketCount` → `gemSocketCount`; new `extensionSlotCount(points)` on thresholds `[5, 10]` |
| `systems/sockets.ts` | `occupiedSlots`/`freeSlots` split per line; `withdrawPoints` evicts from whichever line's threshold was crossed downward |
| `systems/gemSockets.ts` | `socketGem` checks gem capacity, `socketExtension` checks extension capacity — they stop sharing `freeSlots` |
| `ui/weaponRow.ts` | One undifferentiated dot row becomes two labelled lines |
| `ui/inventory.ts` | Placing-mode highlight lights the correct *line*, not the whole row |

**The UI is a net win, not a cost.** Today a selected extension lights
every empty dot on a legal weapon; with two lines it lights only the
line it can actually enter. That is strictly clearer than what 6A-3
shipped, and 6A-3's whole existence was a socketing-clarity fix.

### 2.4 · The exact API, and the wart it deletes

```ts
// tuning/sockets.ts
const GEM_SOCKET_THRESHOLDS = [0, 3, 8, 15, 24] as const;   // unchanged, renamed
const EXTENSION_SLOT_THRESHOLDS = [5, 10] as const;          // new

export function gemSocketCount(pointsInvested: number): number;       // 1..5
export function extensionSlotCount(pointsInvested: number): number;   // 0..2

// systems/sockets.ts — occupiedSlots()/freeSlots() are replaced, not widened
export function freeGemSlots(state: GameState, key: WeaponKey): number;
export function freeExtensionSlots(state: GameState, key: WeaponKey): number;
```

`systems/gemSockets.ts`'s two entry points each consult their own line —
`socketGem` gates on `freeGemSlots`, `socketExtension` on
`freeExtensionSlots`. Nothing else in either module changes: legality
(`gemLegalFor`'s archetype check, `extensionLegalFor`'s weapon binding)
is orthogonal to capacity and stays exactly as 6A-1/6A-3 wrote it.

**`withdrawPoints` gets simpler, not harder.** Today it drains one
combined pool and has to pick which kind to evict first, with a comment
admitting the choice is arbitrary:

> Gems evict before extensions purely to keep the existing
> gem-eviction tests' behaviour unchanged; the plan doesn't specify an
> ordering preference between the two.

With two lines there is no ordering question left to answer. Each line
evicts independently, most-recently-socketed first, against its own new
count — one `while` per line, and the arbitrary tiebreak is deleted
rather than reimplemented. Everything else about withdrawal holds:
nothing is ever destroyed, contents return to their own inventory, and
the withdrawal itself is never partial (6A-3).

**The one edge case worth a named test:** crossing 10 → 9 points closes
an extension slot while *every* gem socket stays open (the gem ladder's
next rung down is 8). A single combined counter would have got that
wrong in either direction; two independent counters get it right by
construction, which is exactly why it deserves a test rather than trust.

---

## 3. What ships, and what does not

| | 6B-1 | 6B-2 |
|---|---|---|
| **Content** | The two socket lines (§2); the extension framework (§5); the UI de-placeholdering; the vocabulary rename (§1); the two cleanups (§7) | 28 extensions — 4 per weapon × 7 weapons — each levelling 1→3 then leaving the card pool |
| **New mechanisms** | none | 4: coagulant chilling, a coagulant armour debuff, regrowth suppression, the ring's second radius |
| **Gate question** | *Does the loadout screen now work the way it was meant to?* | *Does giving up an extension slot for a different extension feel like a decision?* |

**Not in scope either half:** the catalogue (18 weapons / 65 gems is
settled), the Phase 5 gate itself, any retune of gem values, the XP
curve, or the gem socket ladder.

---

## 4. Two findings from reading the catalogue against shipped code

The extension lists in `phase-5-6-arsenal.md` §7 were written
2026-08-07, **before any gem existed**. Reading them against the 20 gems
that shipped in 6A produces two things worth stating.

### Finding 1 — 🟡 Six of the 28 duplicate a shipped 6A gem, and two socket lines are what make that survivable

| Extension | Duplicates |
|---|---|
| Bolt · **Tracking Rounds** | the **Homing** gem |
| Frost · **Freeze Duration** | the **Extension** gem (+40% freeze duration) |
| Poison · **Cloud Radius** | the **Expansion** gem (+30% area) |
| Missile · **Salvo** | the **Multishot** gem |
| Chain · **Split Arc** | the **Fork** gem |
| Poison · **Twin Canister** | the **Multishot** gem |

An earlier draft of this plan dropped five of them, using the
catalogue's "ship 3 of 4, keep the 4th as a designed spare" rule. **All
four now ship (§8 Q4), so none can be dropped** — and §2's separate
socket lines are what make that acceptable rather than sloppy: an
extension no longer competes with its gem twin for the same slot. Cloud
Radius becomes a weapon-locked, levelable, plain-and-reliable option
sitting in a line the Expansion gem can never reach.

**They are the floor, deliberately.** Not every card has to be exotic;
four exotic options with no plain one is a weapon with no safe pick.
§6's designs still push each duplicate one step off its twin where it is
free to do so (Tracking Rounds *re-acquires* where Homing steers at the
original target; Salvo *sequences* where Multishot is simultaneous) —
differentiation inside a candidate the catalogue already named, which is
a content detail rather than a reopening of §7.

### Finding 2 — 🟡 Frost Nova's signature effect does nothing to the game's primary threat

Verified in code, not inferred: `grid.frozen` is a per-cell
`Float32Array` read by `systems/growth.ts` to suppress ambient regrowth.
`Coagulant` has **no freeze, chill or slow field at all**, and
`grid/clear.ts`'s coagulant loop never reads one. So Frost Nova — the
weapon the design explicitly reclassified as *"a setup weapon"* rather
than a damage source — sets nothing up against coagulants, which have
been the actual threat since Phase 4.

It predates this batch, but lands on it, because **Frost's own extension
list assumes it is false**: *Shatter Core (frozen coagulants take bonus
damage natively)* names a state that cannot exist today. Settled §8 Q3:
fix it inside Shatter Core.

### A third thing, recorded not as a finding but as a rule

**Weapon-locked content is the sanctioned exception to "never switch on
`WeaponKey`."** The codebase's loudest architectural discipline
(Decision 75, `tuning/gems.ts`'s own comments) is that a *gem* must
never branch on `WeaponKey` — that is the N × M cost the pipeline exists
to prevent. An extension is the opposite case by definition, and 28
bespoke effects is the intended shape. Worth writing down, or a future
reader who absorbed the gem discipline will read `blades.ts` reaching
for `extensionLevel(state, 'blades', 'serration')` as the violation it
looks like and is not.

**Rule of thumb: an extension may know its weapon; a gem may only know
its archetype.**

---

## 5. The extension framework

### 5.1 · The catalogue (`tuning/extensions.ts`)

The placeholder's four constants are replaced by a real per-weapon
table, and `ExtensionInstance.kind` narrows from `string` to a closed
union — the same narrowing 6A-1 did to `GemInstance.kind`, for the same
reason, with the precedent already noted in `state.ts`'s own comment.

```ts
export type ExtensionKey =
  | 'heavySlug' | 'twinBarrel' | 'overcharge' | 'trackingRounds'   // bolt
  | 'counterRotation' | 'serration' | 'bladestorm' | 'whirl'       // blades
  | ... ;

export interface ExtensionDef {
  readonly weaponKey: WeaponKey;
  readonly name: string;
  readonly icon: string;
  readonly desc: (level: 1 | 2 | 3) => string;
  // Channel 1 only — extensions that are pure multipliers declare them
  // here and need no per-weapon code at all.
  readonly mods?: (level: 1 | 2 | 3) => GemModDelta;
}

export const EXTENSION_DEFS: Readonly<Record<ExtensionKey, ExtensionDef>>;
export const EXTENSIONS_BY_WEAPON: Readonly<Record<WeaponKey, readonly ExtensionKey[]>>;
export const EXTENSION_MAX_LEVEL = 3;
```

Keys are globally unique rather than namespaced per weapon, keeping
`findOwnedExtension`'s existing `(weaponKey, kind)` lookup unchanged and
making a single flat record possible.

### 5.2 · The reader (`systems/extensions.ts`)

Mirrors `systems/weaponMods.ts` and `systems/resolveOpts.ts` — systems
reads `GameState`, tuning holds data:

```ts
// 0 means "not socketed in this weapon right now" — a banked extension
// has no effect, exactly like a banked gem.
export function extensionLevel(state, key: WeaponKey, ext: ExtensionKey): 0 | 1 | 2 | 3;
export function extensionMods(state, key: WeaponKey): GemModDelta;
```

**`extensionMods` is summed inside `weaponMods()`**, not returned
alongside it. That is the load-bearing choice here: every existing
consumer — each weapon's `deliver`, `cooldownReady`, `WeaponDef.stats()`,
the inventory screen's live stat line — picks up extension effects with
**zero changes**, so Heavy Slug's damage/rate tradeoff appears in the
stat line the instant it is socketed without a line of UI work.
Uncached, for the same reason `weaponMods` is.

Extensions with behaviour rather than numbers call `extensionLevel()`
inside their own weapon's module — §4's rule.

### 5.3 · The UI de-placeholdering

Three call sites hardcode `PLACEHOLDER_EXTENSION_NAME`/`_DESC` and
become lookups against `EXTENSION_DEFS`: `ui/upgradeCards.ts` (the
card's name/rank/desc), `ui/inventory.ts` (the Extensions section label
and the placing banner), `ui/weaponRow.ts` (the dot's `title`, and its
icon — currently a generic `◆`, becomes the extension's own, matching
how gem dots already work).

One consistency gap closes while we are here: the per-row socket picker
(`renderGemPicker`) offers **gems only**. Written in 6A-1 when
extensions could not bank; since 6A-3 they can, so it should offer legal
banked extensions into the extension line. Leaving it would mean the
second placement route silently omits a whole category — the same class
of invisibility that produced 6A-3's *"I second guessed if it worked"*
finding.

### 5.4 · Balance posture

First-draft target: **Lv1 ≈ a gem, Lv3 clearly above it**, since maxing
costs three separate card picks and permanently shrinks the card pool
toward what the run hasn't taken. Every number in §6 is a first draft,
expected to move at the gate, exactly like `XP_GROWTH` and every
Amplifier value before it.

---

## 6. The 28

Level curve written `a / b / c` for Lv1 / Lv2 / Lv3. **Channel**:
*mods* = §5.2's multiplier path, no per-weapon code; *resolve* = a
`ClearOptions` field; *weapon* = code in that weapon's own module;
**new** = a mechanism that does not exist yet.

### Bolt Turret ⚡ *(projectile)*

| Extension | Effect | Channel |
|---|---|---|
| **Heavy Slug** | +45 / +70 / +100% damage, −25 / −30 / −35% fire rate | mods |
| **Twin Barrel** | A second bolt from an offset origin, at 40 / 60 / 80% power | weapon |
| **Overcharge** | Every 5th shot deals ×2.5 / ×3 / ×3.5 | weapon + `state.weaponShots` |
| **Tracking Rounds** | Mild homing that **re-acquires** — retargets to the nearest threat mid-flight, at 60 / 90 / 120°/s | weapon |

**Heavy Slug is the only content in the arsenal with a genuine
downside**, and it is deliberate (§8 Q2). Tracking Rounds differs from
the Homing gem, which steers at the point it was fired at.

### Orbiting Blades 🗡️ *(orbital)*

| Extension | Effect | Channel |
|---|---|---|
| **Counter-Rotation** | +1 / +1 / +2 blades on a second reversed-spin ring, orbiting **outward** at 1.25× | weapon |
| **Serration** | Consecutive hits by the same blade ramp +12 / +18 / +25% each, capped at ×2, reset on a miss | weapon + `state.bladeStreak[]` |
| **Bladestorm** | Orbit speed ×1.6 / ×1.9 / ×2.2 for 2s after any coagulant dies | weapon + `state.lastCoagulantDeathAt` |
| **Whirl** | The blade that lands a hit flares to +25 / +35 / +45% radius for 0.3s | weapon |

Bladestorm keys off *any* coagulant death rather than one this weapon
killed — attributing a kill needs the `clearAt` return channel the
BACKLOG already defers, and "the field just broke somewhere" is a
legitimate reading. One new `number` on state, not a subsystem.

### Chain Bolt 🔗 *(projectile, native hops)*

| Extension | Effect | Channel |
|---|---|---|
| **Static Buildup** | Per-hop damage *grows* ×1.15 / ×1.25 / ×1.35 instead of decaying | weapon |
| **Backlash** | The final hop deals ×2 / ×2.5 / ×3 | weapon |
| **Conductive** | Hop selection weights denser cells ×1.5 / ×2 / ×2.5 | weapon (`findNextChainHop`) |
| **Split Arc** | The 2nd hop also spawns one branch carrying the remaining hops at 50 / 65 / 80% power | weapon |

All four ride machinery `systems/projectiles.ts` already has — per-
projectile fields baked at spawn, exactly like 6A-2's behaviour flags.
Split Arc's branch reuses `spawnForks`'s return-children shape, which
exists precisely because mutating the live array mid-iteration was the
bug 6A-2 caught.

### Frost Nova ❄️ *(pulse)*

| Extension | Effect | Channel |
|---|---|---|
| **Chill Field** | A persistent aura at the nova's **own** radius, refreezing cells for 0.4 / 0.6 / 0.8s | weapon |
| **Shatter Core** | Frost now **chills coagulants**; a chilled one takes +30 / +45 / +60% damage from any source | **new** — `Coagulant.chilledUntil` + a read in `clear.ts` |
| **Rime** | Cells regrow at 50 / 35 / 20% rate for 3s after a freeze ends | **new** — regrowth suppression |
| **Freeze Duration** | +35 / +55 / +75% freeze duration | mods |

**Frost is the most expensive weapon in the batch.** Shatter Core is
finding 2's fix. Rime's regrowth-suppression primitive is shared with
Immolation's Ash below and reused by Cauterizer in 6E — a weapon
establishing a primitive a later weapon generalises is this project's
established ordering, not an accident.

### Caustic Cloud ☠️ *(cloud)*

| Extension | Effect | Channel |
|---|---|---|
| **Corrosive** | Coagulants inside lose 30 / 45 / 60% of their armour, for 2s after leaving | **new** — coagulant armour debuff |
| **Lingering Spores** | Drifts outward at 12 / 18 / 24 px/s and lives +20 / +30 / +40% longer | weapon + mods |
| **Twin Canister** | A second canister lands offset with a *different* payload — smaller radius, double lifetime | weapon |
| **Cloud Radius** | +25 / +40 / +55% radius | mods |

Corrosive is the arsenal's first answer to armour arriving on a **weapon**
rather than a gem, which §8 of the catalogue's coverage matrix asks for.

### Homing Missile 🚀 *(projectile)*

| Extension | Effect | Channel |
|---|---|---|
| **Bunker Buster** | +8 / +12 / +16% damage per point of the target's armour | resolve (one new `ClearOptions` field) |
| **Proximity Fuse** | Detonates on approaching within 35 / 50 / 65px of a coagulant | weapon |
| **Cluster Warhead** | Detonation spawns 3 / 4 / 5 submunitions at 25% power | weapon |
| **Salvo** | +1 / +1 / +2 missiles, **sequenced** over 0.4s rather than simultaneous | weapon (reuses 6A-2's deferred-emissions queue, free) |

### Immolation Ring 🔥 *(ring)*

| Extension | Effect | Channel |
|---|---|---|
| **Backdraft** | Damage ×(1 + 0.3 / 0.45 / 0.6 × the mass currently crossing the ring) | weapon + a density sample |
| **Second Ring** | A second concentric ring **outward** at 1.4× radius, at 60 / 75 / 90% power | weapon + `render/immolationRing.ts` |
| **Flare** | Every 4th tick, an outward pulse at 1.8× radius and 70 / 85 / 100% power | weapon + `novaFx` |
| **Ash** | Cells the ring burns regrow at 60 / 45 / 30% rate for 2s | shares Rime's regrowth-suppression primitive |

Backdraft is the catalogue's only piece of **density scaling**, which
`phase-5-6-arsenal.md` §3 names as a structural gap in the arsenal.

> **Why three of these say "outward."** Every tower-centred radius floors
> at `perimeter` (`CLAUDE.md`'s sharp-edge list, prototype bug #5), so a
> second ring placed *inward* sweeps the safe zone and hits nothing —
> a card that reads well, sockets fine, and does nothing. Caught while
> planning 6B-2; full account and the guard in
> `docs/plans/phase-6b2-extension-content.md` §1.

---

## 7. The two cleanups

Both are small, both carried since 5A, both done **first** so the batch
does not end on chores. Both land in **6B-1**.

**Immolation Ring's `WEAPON_DAMAGE_SCALE`.** `immolationDamage()` is
`10 * lvl`, the only weapon damage function not carrying the +50% Phase
4C-1 pass — because Ward Pulse was misfiled as a passive when that pass
shipped. Already settled by the owner (roadmap §5 Q3, *"fix all
three"*), and the reasoning stands: the current number is a
**classification accident, not a design position**. The 5A regression
test that pins the gap gets rewritten to pin the fix.

**`WeaponDef.maxLevel` deleted.** Verified unread — the only remaining
references in `src/` are the field's declaration and its seven values.
(`PASSIVE_DEFS.maxLevel` is a different, still-live field and is
untouched.) Arsenal plan §6 retired weapon level caps outright, so the
field is misleading data, including Immolation's inconsistent `6`.

---

## 8. The six questions, and how the owner settled them

Three answered in a first pass, three in a second after the owner caught
two things the first draft had wrong.

**Q1 — Split 6B?** ✅ **Yes — sockets first, then content.** Declined
when the batch was 21 extensions and no socket work; re-offered and
accepted once §2's rework and four extensions per weapon changed the
size materially. **6B-1** is the socket lines, the framework, the UI and
the cleanups — playtestable as *"the loadout screen now works the way I
meant."* **6B-2** is all 28 extensions and the four new mechanisms.

**Q2 — Is a genuine downside allowed?** ✅ **Yes — ship the tradeoff.**
Heavy Slug keeps the catalogue's own wording, *"slower, much bigger
hits."* It becomes the first content in either list that takes something
away, and that is the point: everything shipped so far is pure gain,
which is precisely the shape that makes enhancement read as a slider
rather than a decision. The gate immediately after now has one concrete
piece of evidence to ask that against.

**Q3 — Frost's coagulant chilling?** ✅ **Fix it inside Shatter Core.**
One new field (`Coagulant.chilledUntil`), one read in `clear.ts`. The
extension gets a real job instead of describing a state that cannot
exist, and Frost becomes in fact what it has been called since the
2026-08-05 rework. The declined alternative was deferring it to a Frost
identity pass.

**Q4 — Three extensions per weapon, or four?** ✅ **Four — all designed
candidates ship.** This **supersedes** `phase-5-6-arsenal.md` §12's
call 20 (*"3 extensions per weapon"*), while matching §7's own tables,
which list four per weapon. 28 in this batch, 72 across Phase 6. Two
disclosed costs: the designed spare disappears (nothing left on the page
if one plays badly), and the six gem-duplicates all ship — survivable
only because of §2's separate lines (finding 1).

**Q5 — How does the extension line open?** ✅ **Laddered 0 / 1 / 2**, at
0–4 / 5–9 / 10+ points invested — the owner's own sub-proposal. Keeps
*points buy depth* as the single legible rule across both lines. Early
extension cards simply bank until a weapon is invested in, which 6A-3's
banking already handles cleanly. The rejected alternatives were a flat 2
from the start (a zero-investment weapon fielding 2 extensions + 1 gem
makes points buy less early) and 1-from-zero-plus-a-second-at-8.

**Q6 — Do extensions and gems share sockets?** ❌ **No — two separate
lines.** The owner's call, reversing `phase-5-6-arsenal.md` §5 and
restoring Decision 32. Full reasoning, and the two record-keeping items
it exposes, in §2.2.

**Settled earlier and not reopened:** Immolation's +50% (roadmap §5 Q3),
`maxLevel`'s deletion (BACKLOG), the extension level-to-3-then-leave
rule and the card pool's behaviour generally (§1).

---

## 9. Order of work

### 6B-1

| # | Step | Why here |
|---|---|---|
| 1 | The two cleanups (§7) | Small, settled, independent of everything below. |
| 2 | The vocabulary rename (§1) | Pure rename, done before new code adopts the ambiguous term again. |
| 3 | `extensionSlotCount` + the per-line split in `systems/sockets.ts` and `systems/gemSockets.ts` | The rule everything else depends on. |
| 4 | `ui/weaponRow.ts`'s two lines + `ui/inventory.ts`'s per-line highlight | The half the owner can actually see and judge. |
| 5 | The extension framework (§5.1, §5.2) and the UI de-placeholdering (§5.3), with the existing tests migrated off `'placeholder'` | The point `PLACEHOLDER_EXTENSION_*` can be deleted outright. |

**6B-1 ships with exactly one real extension per weapon** — Heavy Slug
and its six siblings from the *mods*-only column — so the two lines can
be played rather than looked at. Building all 28 to test the framework
would defeat the split.

### 6B-2

**Planned in full in its own document:
`docs/plans/phase-6b2-extension-content.md`** — the four mechanisms in
implementation detail (state fields, where each is read, the ordering
rules, the one performance-sensitive change), the per-weapon touchpoints,
and an eight-step order of work. In outline:

| # | Step | Why here |
|---|---|---|
| 1 | The three outward-radius corrections and their guard | The guard goes in before the content needing it. |
| 2 | The remaining proven-channel extensions — Bolt, Chain, Missile (12) | The honest test of §5's framework: if these land without touching `clear.ts` or the growth pass, the framework holds. |
| 3–6 | The four new mechanisms, one at a time, each tested alone | Where the schedule risk is (§11 risk 3). |
| 7 | Blades, Frost, Poison, Immolation (16) | Content on top of the primitives. |
| 8 | Full verification — 28 outcome tests, table completeness, live in-browser | |

---

## 10. Tests

Following Decision 20 — test the **invariant**, not the mechanism.

**6B-1**
- **The two lines are independent**: an extension cannot enter a gem
  socket and vice versa, at every rung of both ladders.
- **`extensionSlotCount` boundaries** — 4/5 and 9/10, the off-by-one
  points that a threshold table gets wrong.
- **Withdrawal evicts from the correct line** and returns to the
  correct inventory, including the case where crossing 10→9 closes an
  extension slot while every gem socket stays open.
- **`weaponMods` reads socketed extensions and ignores banked ones** —
  the one invariant that, if broken, silently makes every mods-channel
  extension inert. This is exactly the failure `WeaponDef.stats()` had
  in 6A-1, and it is worth guarding by name.
- **Immolation's damage now carries `WEAPON_DAMAGE_SCALE`** — rewrite of
  the 5A regression test that pinned the gap.

**6B-2**
- **One outcome test per extension**, shaped as "socket it, run the
  weapon, assert the outcome moves in the stated direction" — e.g. Heavy
  Slug: damage per shot up *and* time between shots up; Backlash: the
  last hop removes more mass than the second-to-last.
- **Table completeness**: every `ExtensionKey` appears in exactly one
  weapon's `EXTENSIONS_BY_WEAPON` entry, and every weapon has exactly 4.
  Cheap, and catches an authoring slip in a 28-entry table.
- **A maxed extension leaves the card pool** — the existing 5B test,
  generalised off the `'placeholder'` literal.

**Migration note:** roughly a dozen existing tests hardcode
`kind: 'placeholder'` (`cards.test.ts`, `gemSockets.test.ts`,
`sockets.test.ts`). They move to a real key rather than being deleted —
they test the banking machinery, not the placeholder.

---

## 11. Risks

**1. Twenty-eight extensions is real authoring and will not feel like
progress.** The roadmap's own risk 2, now a third larger than when it
was written. No new weapon ships in either half.

**2. Extensions may be the wrong unit of content.** Roadmap risk 3: 4
per weapon × 18 weapons is **72** mechanics, each needing a description
that survives the *"cards appear to do nothing"* test. 6B finds out at a
cost of seven weapons rather than eighteen — an argument for this batch
existing, and now also for the Q1 split, since 6B-1 tests the *framework*
at a cost of seven single extensions.

**3. Four new mechanisms is where the schedule risk actually is** —
coagulant chilling, regrowth suppression, the armour debuff, and the
ring's second radius. All four are contained (one field, one array, one
read) but all touch `clear.ts` or the growth pass, the part of the
codebase with the most documented sharp edges, including the
`D * step <= ~0.25` divergence trap and the revealed-vs-raw density
rule. All four are isolated into one step on the 6B-2 side.

**4. Six of the 28 duplicate a gem** (finding 1). The separate socket
lines make them a deliberate plain-and-reliable floor rather than dead
cards, but that reading is a judgement, not a proof — and the designed
spare that would have absorbed them no longer exists (§8 Q4). If they
read as filler in play, the fix is authoring replacements, which *does*
reopen §7 and should be raised rather than done quietly.

**5. Seven sockets per weapon is a large capacity jump** from five —
intended by the owner (§2.1), recorded here so a later balance pass
knows it was chosen rather than drifted into.

---

*Written 2026-08-10, revised twice the same day as the owner corrected
the first draft's socket model and extension count. Plan only — nothing
here is in `docs/DECISIONS.md` yet; it goes in when each half ships,
matching the posture every batch since 5A has taken, and Decision 32's
two missing supersession notes (§2.2) go in with 6B-1.*
