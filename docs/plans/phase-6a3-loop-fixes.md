# Phase 6A-3 — the loop fixes, and the inventory that makes sockets legible

**Status:** 📋 **Planned 2026-08-09, revised the same day after talking
the scope through with the owner. Awaiting greenlight.** Nothing
implemented.

> **Revision note.** A first draft of this plan was written before the
> owner had seen it, and was too narrow — it treated the socketing
> complaint as a click-target problem and proposed keeping extensions out
> of inventory. The owner's response (*"the inventory itself has to have
> 3 sections for extensions, core gems and support gems"*) makes this a
> **banking** batch, not a CSS batch. Scope below is the revised one.

**What this is.** A corrective batch between 6A and 6B, fixing what the
owner's first playtest on real gems found. Not new content — every item
is something 6A shipped that doesn't survive contact with a real run.

**Why it comes before 6B.** 6B adds three real extensions per weapon,
arriving through the same card pool and the same socketing UI that are
both currently broken. Building content on top of that means it can't be
evaluated. It is also what the **Phase 5 gate** needs: that gate cannot
judge *"is enhancement a decision or a slider?"* while the pool offers
only Emergency Repair. After this batch, 6B adds extension *content* onto
finished plumbing rather than being half-plumbing itself.

**Source:** the six playtest findings in `docs/BACKLOG.md` ("Found in the
2026-08-09 post-6A playtest"); the owner's answers across two rounds,
2026-08-09; Decisions 31, 61 (the XP economy), 71 (the socket economy),
74–75 (Phase 6A); `docs/plans/phase-5-6-arsenal.md` §5, §11.

---

## Table of contents

1. [What the owner settled](#1-what-the-owner-settled)
2. [The XP curve goes geometric](#2-the-xp-curve-goes-geometric)
3. [The card pool stops caring about sockets](#3-the-card-pool-stops-caring-about-sockets)
4. [Everything banks — three inventories](#4-everything-banks--three-inventories)
5. [The inventory panel, and click-to-place](#5-the-inventory-panel-and-click-to-place)
6. [Effects move from pick-time to socket-time](#6-effects-move-from-pick-time-to-socket-time)
7. [Modules touched](#7-modules-touched)
8. [Tests](#8-tests)
9. [Order of work](#9-order-of-work)
10. [Open questions](#10-open-questions)
11. [Risks](#11-risks)

---

## 1. What the owner settled

| # | Call | Consequence |
|---|---|---|
| 1 | **The XP curve goes geometric, now** — the offered measurement pass was declined in favour of shipping. | §2. Accepted as unmeasured; the constant is isolated so a retune is one line. |
| 2 | **The card pool should not care whether the player has free sockets.** *"It shouldn't matter if i have open sockets or not, i should still be offered the same pool."* | §3. **Supersedes arsenal plan §11's no-dead-card rule.** |
| 3 | **Leftover gems become currency** — a small amount on death, and the orbital trade ship recycles them mid-run. | Phase 7. Recorded so §3's "you will accumulate unusable gems" is intentional, not an oversight. |
| 4 | **The inventory has three sections** — extensions, core gems, support gems — **as a side panel on the loadout screen.** | §4, §5. This is what turns the batch from a CSS fix into a banking change. |
| 5 | **Unsocketing a core gem removes what it gave.** *"If it give max hp - take it away when unsocketed."* | §6. |
| 6 | **Extensions stay bound to their weapon** when banked — a Bolt extension only ever fits Bolt. | §4. Preserves the arsenal design's split: extensions are weapon identity, gems are the universal half. |
| 7 | **Rolling an extension you already own levels it up**, socketed or not, and the card leaves the pool at max level. *"Extensions are a different thing and the only one with levels."* | §3a. Deliberately **not** the same pool rule as gems — an owner-sanctioned asymmetry, not an inconsistency to tidy away. |

**A sequencing note, resolved.** The owner's first answer was *"just #2
and #5 now, defer #1 and #4."* The same round then chose *"go geometric
now"* for #1 and volunteered that the level rate is *"insane... lvl 80
within not even 10 mins."* And #4 (core-gem unsocket) came back into
scope on its own once the inventory grew a core-gems section — a section
with no way to put anything into it would be a dead panel. Both were
raised explicitly rather than resolved silently, and the owner confirmed
the wider slice.

---

## 2. The XP curve goes geometric

**The diagnosis** (full version in BACKLOG): cost is quadratic in level,
income is proportional to DPS, and 6A's Amplifier gems make DPS grow
multiplicatively. Time per level is `O(L²) / O(DPS)` — once DPS outgrows
`L²`, time per level **falls**. Level 80 in ten minutes is that crossover.

**The shape** — keep the quadratic base, multiply by a growth factor:

```
xpToNext(L) = round( (XP_BASE + XP_LINEAR·L + XP_QUADRATIC·L²) · XP_GROWTH^(L-1) )
```

**`^(L-1)`, not `^L`, is deliberate**: it makes `xpToNext(1)` come out
*exactly* as it does today (19), so Decision 61's explicit intent —
*"the intended early rush survives"* — holds by construction rather than
by luck.

**First draft `XP_GROWTH = 1.08`:**

| Level | Today | Proposed | Multiple |
|---|---|---|---|
| 1 | 19 | 19 | 1.0× |
| 10 | 122 | 244 | 2.0× |
| 30 | 612 | 5 700 | 9.3× |
| 50 | 1 462 | 62 300 | 43× |
| 80 | 3 412 | 1 460 000 | 428× |

One named constant in `tuning/xp.ts`, so retuning is a one-line edit. It
**is a guess** and expected to move — the measurement pass was offered and
declined, which is a fine call, but the table above is arithmetic, not
evidence.

**The income side must not change.** Decision 31's anti-farming guarantee
depends on granted XP staying honest to destroyed mass; nerfing
`gemValueFromRemoved` would make neglecting the field an XP strategy.
Decision 61 already settled that the lever is cost, never grant.

---

## 3. The card pool stops caring about sockets

**The owner's rule**, verbatim: *"I think it shouldnt matter if i have
open sockets or not i should still be offered the same pool. The pool
should not care if i have something."*

This **supersedes `phase-5-6-arsenal.md` §11's no-dead-card rule** —
recorded as a deliberate, disclosed supersession per `CLAUDE.md`'s
ground-truth protocol. §11 was not wrong; **its premise changed.** It
assumed a card you cannot socket is *worthless*. Once everything banks
(§4) and leftovers convert to currency (call 3), an unplaceable card is
merely *deferred*.

**What changes in `systems/cards.ts`:**

- `buildWeaponSidePool` stops filtering gems through `gemHasLegalHome`.
- It also stops gating **extensions** on `freeSlots` — the first draft of
  this plan kept that gate, because an extension had nowhere to bank.
  §4 removes that reason, so the pool becomes *socket*-blind for
  everything, with no exceptions.
- `buildBundlePool` stops requiring every gem in a package to have a home.
- `buildCoreGemPool` stops returning `[]` when all three core slots are
  full — core gems bank too.
- For **gems and core gems**, duplicates are fine and the pool does not
  consult what the player owns at all.
- `gemHasLegalHome()` loses its only caller and is **deleted** with its
  tests. `gemLegalFor()` stays — the placement UI needs it, and
  `socketGem()` still refuses illegal placements.

### 3a. Extensions are the exception, deliberately

**Socket-blind is not the same as ownership-blind, and extensions are
ownership-aware on purpose** (call 7). The owner's rule, verbatim:

> *"When you roll an extension and you already have it socketed or
> unsocketed it increases the level of the extension — regardless if its
> used or not, and after you have max level extension, that card is
> removed from the pool. Support gems and core gems act differently in
> the pool and its ok, extensions are a different thing and the only one
> with levels."*

So the extension card:

- **Levels up an extension you already own**, wherever it lives — on the
  weapon or sitting in inventory. Ownership, not placement, is what the
  pool reads.
- **Creates it at level 1 in inventory** if you don't own it at all.
- **Leaves the pool permanently at max level** (3) — which is the
  behaviour `buildWeaponSidePool` already has today and simply keeps.

**This is an owner-sanctioned asymmetry, not an inconsistency.**
Extensions are the only thing in the game with levels, so they are the
only thing for which "you already have one" means something other than
"you have two." Written down here explicitly because a later reader will
otherwise see gems ignoring ownership, extensions consulting it, and try
to unify them.

**It also simplifies §4.** Because levelling happens at *roll* time
rather than *placement* time, **there is never more than one instance of
a given `(weaponKey, kind)` extension anywhere** — not two in inventory,
not one in inventory and one socketed. That is a clean invariant, and
§8 tests it directly rather than trusting it.

**This deletes finding #2 at the root.** No gem-upgrade system, no longer
socket ladder, no scaling fallback. The `{ kind: 'heal' }` fallback stays
as a genuine last resort and should become unreachable in practice.

---

## 4. Everything banks — three inventories

Today only support gems bank. Extensions are written straight into a
weapon socket at pick-time and can never be removed; core gems are
written straight into one of three fixed slots. The owner's three-section
inventory makes all three uniform.

**State (`state.ts`):**

| Container | Holds | Status |
|---|---|---|
| `gemInventory: GemInstance[]` | support gems | exists |
| `coreGemInventory: CoreGemInstance[]` | core gems | **new** |
| `extensionInventory: ExtensionInstance[]` | extensions, each bound to a `weaponKey` | **new** |

`ExtensionInstance` carries `{ id, weaponKey, kind }` — **bound to its
weapon** (call 6), so a Bolt extension is only ever legal in a Bolt
socket. This preserves the arsenal design's load-bearing split:
extensions are weapon identity, support gems are the universal half.

**A wart this removes.** `withdrawPoints()` currently *clamps* rather than
closing a socket that holds an extension, purely because an evicted
extension had nowhere to return to (`minPointsForSockets()` exists only
for this). With an extension inventory, withdrawal can evict extensions
the same way it already evicts gems, and the clamp — plus its exported
helper and the UI code that disables the `−` button on it — can go. That
is a genuine simplification falling out of the owner's UI request.

---

## 5. The inventory panel, and click-to-place

**The finding.** The owner could not tell whether socketing worked at
all: *"the area that you need to click to socket the gems is very
unclear... Even I second guessed if it worked or is there a bug."*

**The root cause is visibility, not hit area.** Today the only route to
inventory is clicking a small empty socket, which then filters to gems
legal *for that one weapon* — so a gem that fits nothing currently
equipped appears **nowhere in the UI**. After §3 the player will hold
many of those. Bigger dots would not have fixed this.

**What ships:**

- **A persistent inventory panel** beside the weapon list on the loadout
  screen, with the owner's three sections: Extensions, Core gems, Support
  gems. Each entry shows icon, name, and (for stacked duplicates) a
  count. Empty sections render a quiet "None yet" rather than vanishing,
  so the structure is legible before it is full.
- **Click-to-place as the primary interaction.** Click an inventory entry
  → it enters a *placing* state. Every socket it can legally enter
  highlights; illegal ones and full weapons dim. Click a highlighted
  socket to place; click the entry again, or press Escape, to cancel.
  **Legality is shown, not hidden** — the current picker silently omits
  illegal targets, which is indistinguishable from the feature being
  broken, which is precisely what happened.
- **Real controls.** An empty socket becomes ~30px with a dashed border
  and a `+`, not a bare `○` glyph; a filled socket gets a solid accent
  border and keeps click-to-unsocket, with an explicit hover cue.
- **An instruction line** — *"Click a gem, then click a socket"* —
  updating to *"Placing: Amplifier — click a lit socket, or the gem again
  to cancel"* while held. Discovery has already failed here once; stating
  it beats trusting an affordance.
- The existing click-empty-socket-to-open-a-picker path **stays** as a
  second route. It works and is tested; removing a working path wholesale
  is a bigger change than the finding warrants (see §11 risk 4).

Not drag-and-drop: nicer to use, worse to build, breaks on touch, and
nothing else in this game drags. Two clicks are robust and reversible.

---

## 6. Effects move from pick-time to socket-time

This is the subtle half of §4, and the part most likely to cause a bug if
rushed.

**Today** `applyCardChoice` applies a core gem's *effect* at pick-time:
it writes `state.coreGems[idx]`, increments `state.passives[key]`, and
for `maxHp` does `tower.maxHp += 20` plus a 20 heal. **Once core gems
bank, the card grants only the instance** — the effect must move to
`socketCoreGem()`, and be undone by `unsocketCoreGem()`.

**The owner's rule** (call 5): *"Unsocketing the core gem should remove
what it give, if it give max hp - take it away when unsocketed."*

- Socket → `passives[key] += 1`; for `maxHp`, `maxHp += 20` and heal 20.
- Unsocket → `passives[key] -= 1` (deleting the key at zero); for
  `maxHp`, `maxHp -= 20` **and clamp `hp = min(hp, maxHp)`**.

**The clamp is what stops a socket/unsocket loop being a free heal**, and
it is the one piece of this that a test must pin explicitly: socket,
take damage, unsocket, and assert HP never exceeds the reduced maximum.
Round-trip conservation (`passives` returns to its starting value after
socket → unsocket) gets the same treatment, mirroring the round-trip
tests `investPoints`/`withdrawPoints` already carry.

---

## 7. Modules touched

| Module | Change |
|---|---|
| `tuning/xp.ts` | `XP_GROWTH`; `xpToNext` gains the geometric term |
| `state.ts` | `coreGemInventory`, `extensionInventory`, their instance types |
| `systems/cards.ts` | Pool becomes uniformly socket-blind; extension/core-gem picks grant instances instead of applying |
| `systems/gemSockets.ts` | Delete `gemHasLegalHome`; add extension + core-gem socket/unsocket |
| `systems/sockets.ts` | `withdrawPoints` evicts extensions to inventory; `minPointsForSockets` clamp removed |
| `systems/passives.ts` | Core-gem effect application/removal moves here from card-pick |
| `ui/inventory.ts` | The three-section panel; placing-state ownership; core row becomes interactive |
| `ui/weaponRow.ts` | Socket controls resized/relabelled; highlight + dim states |
| `index.html` | Panel markup, two-column layout, socket/highlight CSS |

Deliberately untouched: `systems/xp.ts` (`grantXp` is unchanged — only the
cost function moves), `tuning/sockets.ts` (the ladder stays; §3 removes
the reason to extend it), and every weapon module.

---

## 8. Tests

**Curve — invariants, not coefficients** (Decision 20):
- `xpToNext(1)` is unchanged from its pre-6A-3 value.
- `xpToNext` is strictly increasing.
- The ratio `xpToNext(L+1)/xpToNext(L)` exceeds any fixed polynomial ratio
  for large `L` — i.e. genuinely superpolynomial. Pinning a value at L=50
  would just fix a constant that is expected to move.

**Pool:**
- Every card kind is still offered with **zero** free sockets — the exact
  case that produced the bug, asserted per kind (gem, extension, bundle,
  core gem).
- The pool never degrades to `[{ kind: 'heal' }]` while anything is
  ownable — the regression test for the reported symptom.

**Banking and placement:**
- An extension card the player does **not** own grants a level-1 instance
  into inventory, touching no weapon.
- An extension card the player owns **in inventory** levels that instance
  and still creates nothing new.
- An extension card the player owns **socketed on the weapon** levels it
  **in place, on the weapon** — the case my first draft got wrong by
  asserting a card never touches the weapon.
- **The uniqueness invariant**: after any sequence of extension rolls,
  at most one instance of a given `(weaponKey, kind)` exists across
  inventory and every weapon's sockets combined.
- An extension stays offered until max level, then leaves the pool for
  good — including when it is sitting unplaced in inventory.
- An extension is legal only in its own weapon's sockets.
- `withdrawPoints` now evicts an extension to inventory rather than
  clamping; round-trip conservation holds.
- `socketGem` still refuses illegal or socket-less placement — loosening
  the pool must not loosen placement.

**Core gems (§6):**
- Round trip: `passives` returns to its starting value after socket →
  unsocket.
- **The heal exploit**: socket `maxHp`, take damage, unsocket, assert
  `hp <= maxHp` and that no healing occurred.

---

## 9. Order of work

| # | Step | Checkpoint |
|---|---|---|
| 1 | `XP_GROWTH` + curve + invariant tests | Suite green; a run visibly levels slower |
| 2 | Pool goes socket-blind; delete `gemHasLegalHome` | Pool tests green, including zero-free-sockets per kind |
| 3 | The two new inventories + instance types | Types land; nothing reads them yet |
| 4 | Extension banking; `withdrawPoints` eviction; clamp removal | Round-trip tests green |
| 5 | Core-gem banking; effects move to socket-time; the `maxHp` clamp | Heal-exploit test green |
| 6 | Socket controls: sizing, border, `+`, hover | Sockets obviously clickable before any new UI exists |
| 7 | The three-section panel: markup, CSS, render | Everything owned is visible without opening a picker |
| 8 | Placing mode: select → highlight → place → cancel | Both routes work; the old picker path still passes |
| 9 | **Verify live** — level pacing at a high level, a full-sockets draw, and a socket performed *only* via the panel | Zero console errors; typecheck, tests, build clean |

**Step 9 matters more than usual.** Two of the three findings are *"the
player couldn't tell what was happening"* bugs, which by definition a
passing test suite cannot verify.

---

## 10. Open questions

**1. ~~What does a banked extension instance mean when the weapon already
has that extension?~~** ✅ **Settled by the owner, 2026-08-09** — see §3a.
The *roll* levels it, wherever it lives, and the card leaves the pool at
max. Simpler than the placement-time merge this plan originally proposed,
and it removes duplicate handling entirely.

**2. `XP_GROWTH = 1.08` is an unmeasured first draft.** Expect one retune
after a playtest. The only genuinely open item left.

---

## 11. Risks

**1. The curve could overshoot into feeling grindy.** 43× at level 50 is
a large correction, and the failure on the other side (levels stop
arriving, the build stops developing) reads as *"hard"* rather than
*"broken"* during a playtest — so it is less obvious than the current
problem, not more. This is why `XP_GROWTH` is isolated.

**2. Moving core-gem effects to socket-time touches live balance.** The
effects themselves don't change, but *when* they apply does, and
`maxHp`'s heal is the kind of thing that silently double-applies if the
refactor is sloppy. §8's round-trip and heal-exploit tests exist for
exactly this.

**3. Surplus gems have no sink until Phase 7.** Ungating the pool is
intentional (call 3 — leftovers become currency), but the currency and
the trade ship are Phase 7. Until then, surplus is just surplus. Worth
confirming in the playtest that it reads as *"saving up"* rather than
*"these cards are junk."*

**4. Two socketing routes could confuse rather than clarify.** Keeping
the old picker alongside the new panel is conservative, but two ways to
do one thing is its own smell. If the panel proves clearly better live,
retiring the picker is the follow-up — noted so the duplication stays a
decision rather than a leftover.

**5. This batch is bigger than it started.** It began as "fix three
playtest findings" and is now also a banking refactor across three
container types plus a UI rework. That is the right call — 6B would
otherwise inherit half of it — but it is worth naming, since every
oversized batch in this project so far has been split, and this one has
a natural seam at step 5 if it needs one.

---

*Planned and revised 2026-08-09. §10's two questions are open; nothing
here is in `docs/DECISIONS.md` yet — per the project's posture, these go
in as decisions when the batch ships.*
