# Session record — 2026-08-09 (continued)
## The owner's first playtest on real gems, and Phase 6A-3: the loop fixes

**Type:** playtest + design conversation + implementation. Immediately
follows `docs/sessions/2026-08-09-phase-6-replan-and-6a.md` — same day,
same overall arc, split into its own file because it's a genuinely
distinct chunk of work (the project's own precedent: 2026-08-07 has three
separate session files for one calendar date).
**Participants:** project owner + Claude.
**Outcome:** Phase 6A-3 is complete. The three structural findings from
the owner's playtest are fixed — the XP curve, the card pool going dead
on socket exhaustion, and socketing UX unclear enough to look broken —
plus a fourth (core-gem unsocket) that was originally deferred and then
pulled back into scope mid-conversation. Extensions and core gems now
bank exactly like weapon gems always did, behind a real three-section
inventory panel.

> **Why this file exists.** The build itself grew substantially between
> the plan being written and the plan being approved — a first draft was
> too narrow, and the owner's actual request turned a click-target fix
> into a banking pass across three container types plus a UI rework.
> That negotiation, and the reasoning behind each of the owner's five
> rule changes, is exactly the kind of thing `docs/PROGRESS.md`'s own
> convention (Decision 37) says belongs here rather than in the status
> file.

---

## Table of contents

1. [The playtest, and how it was triaged](#1-the-playtest-and-how-it-was-triaged)
2. [The XP curve diagnosis](#2-the-xp-curve-diagnosis)
3. [The card pool's dead-end, and the owner's rule change](#3-the-card-pools-dead-end-and-the-owners-rule-change)
4. [The socketing UX finding](#4-the-socketing-ux-finding)
5. [First plan draft, and why it was too narrow](#5-first-plan-draft-and-why-it-was-too-narrow)
6. [The owner's three-section inventory ask, and what it changed](#6-the-owners-three-section-inventory-ask-and-what-it-changed)
7. [The extension exception (S3a)](#7-the-extension-exception-s3a)
8. [The maxHp unsocket exploit](#8-the-maxhp-unsocket-exploit)
9. [What shipped](#9-what-shipped)
10. [Verification](#10-verification)
11. [Ideas considered and rejected](#11-ideas-considered-and-rejected)
12. [What's next](#12-whats-next)

---

## 1. The playtest, and how it was triaged

The owner opened with a caveat and six findings in one message:

> *"I have play tested the game, which I know is not the time. But
> anyways, bugs I found..."*

The six, verbatim in spirit: the XP curve too fast at high level; the
card pool offering only Emergency Repair once sockets filled; slime
balance (explicitly deferred by the owner, "but later"); core gems
impossible to unsocket; socketing unclear enough to look broken; and
point/gem abundance, which the owner suspected shared a cause with the
XP curve.

**Every finding was verified against the code before being triaged**,
not taken at face value — the project's own history (Decision 20, and
this exact session's later bugs) is full of cases where the obvious read
of a symptom was wrong. Two turned out worse than described once checked:
the card pool's dead end wasn't an edge case but *guaranteed in every
long run* (a 3-weapon deck hard-caps at 15 sockets; levels are
unbounded), and the socketing complaint traced to a structural visibility
problem, not a CSS sizing issue.

Three were confirmed structural rather than balance noise (XP curve, dead
pool, core-gem unsocket) and one was UX-structural (socketing); two were
correctly slime-balance and grant-rate tuning, both deferred to Phase 8
as the owner had already framed them.

---

## 2. The XP curve diagnosis

Cost (`xpToNext`) was quadratic in level. Income is proportional to
destroyed mass, which is proportional to DPS, and 6A's Amplifier gems
made DPS grow **multiplicatively** — damage × rate × area all compounding
per weapon. Time per level is roughly `O(level²) / O(DPS)`. Once DPS
outgrows the square — which multiplicative gem stacking makes close to
inevitable — time per level stops rising and **starts falling**. The
owner's own number: level 80 in under ten minutes.

**This is a curve-*class* problem, not a coefficient problem** — raising
`XP_QUADRATIC` only moves where the crossover happens, not whether it
happens. Decision 61 explicitly sanctions retuning the cost curve (*"the
pacing lever is what a level costs, never what a kill grants"*) and its
own note calls the curve *"not finalized,"* so a fix was in-bounds; the
project owner still got asked before the curve's **shape**, not just its
constants, changed.

**The owner's answer, when asked how to fix it**: *"Go geometric now"* —
declining an offered measurement pass (build a harness, record real
DPS-vs-level, derive the exponent) in favour of shipping an estimate.
That's a legitimate call given the project's own pattern of shipping
first-draft constants and retuning after a playtest; it does mean
`XP_GROWTH = 1.08` is genuinely a guess.

---

## 3. The card pool's dead-end, and the owner's rule change

The mechanical cause was simple once traced: the socket ladder tops out
at 5 sockets per weapon (24 points), so a 3-weapon deck hard-caps at 15
sockets total, while levels are unbounded. Every individual pool-building
gate (`freeSlots(state, key) <= 0` for extensions, `gemHasLegalHome` for
gems, `coreGems.includes(null)` for core gems) was correctly implementing
arsenal plan §11's no-dead-card rule — but nobody had specified what the
*whole pool* should offer once every one of those gates was
simultaneously false. `pickCards` fell through to `[{ kind: 'heal' }]`
and stayed there.

The first framing offered to the owner was options: extend the socket
ladder, add a gem-upgrade system, make the fallback scale. **The owner's
answer discarded all of them by changing the premise instead**:

> *"I think it shouldn't matter if I have open sockets or not I should
> still be offered the same pool. The pool should not care if I have
> something."*

This **supersedes arsenal plan §11's no-dead-card rule** — a deliberate,
disclosed supersession, not an accident (`CLAUDE.md`'s ground-truth
protocol). §11 was never wrong; its premise was that an unplaceable card
is worthless, and that stopped being true the moment the same
conversation gave leftover gems a destination:

> *"We can do it like that in the future that all the gems you have left
> over when you die give a very small amount of currency. Also don't
> forget that orbital trade ship will have an ability to recycle those
> into currency mid run."*

That second sentence gave a previously-speculative BACKLOG idea (the
"orbital trade ship," a score-points shop, never designed beyond a name)
a concrete job for the first time: it's the sink that makes "the pool
doesn't care about sockets" work as an economy instead of just producing
clutter.

---

## 4. The socketing UX finding

*"The area that you need to click to socket the gems is very unclear,
the empty support socket is too small and unintuitive... even I second
guessed if it worked or is there a bug that you can't socket anything."*

**This is the project's own worst-known failure mode recurring, one
layer down.** The 2026-08-05 finding — *"cards appear to do nothing"* —
is cited across the design docs as the thing to design against, and 6A-1
built the open-the-picker-on-pick flow specifically to prevent it. It
came back anyway: the *pick* became visible in 6A-1, but the *socket*
never did.

Tracing it in `ui/weaponRow.ts` found the real cause wasn't hit-area, it
was **visibility**: the only route into inventory was clicking an empty
socket, which then filtered to gems legal *for that one weapon* — so a
gem that fit nothing currently equipped was invisible in the entire UI,
with no other way to see it existed. Making the dot bigger would not have
fixed this.

---

## 5. First plan draft, and why it was too narrow

A first plan (written before the owner had seen it) read finding 4 as a
click-target problem: bigger sockets, a persistent gem list, done. It
also kept the pre-existing free-socket gate on extension cards, on the
reasoning that extensions had nowhere to bank.

The owner interrupted before any code was written:

> *"Wait im not sure what 6A-3 is, you have stepped over too fast in
> making a plan. Lets talk about this first. On the inventory, the
> inventory itself has to have 3 sections for extensions, core gems and
> support gems, the inventory should be visible when opening the loadout
> screen on the side as a separate panel."*

Two corrections in that one message: the plan had been presented as
mostly-decided rather than discussed, and the actual shape of the fix was
bigger than the first draft assumed. Both were treated as course
corrections rather than defended.

---

## 6. The owner's three-section inventory ask, and what it changed

Building three sections — Extensions, Core gems, Support gems — only
makes sense if all three things *bank*. That single UI request is what
turned §3's fix (the pool stops gating) into a genuine architectural
change: **extensions and core gems needed their own inventories**
(`extensionInventory`, `coreGemInventory`), mirroring `gemInventory`
exactly, rather than continuing to write straight into a weapon socket or
a fixed core slot at pick time.

Two consequences fell out of this, both net simplifications rather than
new complexity:

- **A wart got deleted.** `withdrawPoints()` used to *clamp* the amount
  withdrawn rather than closing a socket that held an extension, purely
  because an evicted extension had nowhere to go. With an inventory to
  evict to, it can be evicted exactly like a gem — the clamp, and its
  exported `minPointsForSockets()` helper (plus the UI code disabling the
  `−` button on it), all became dead code and were deleted outright.
- **Core-gem unsocket came back into scope on its own.** A "Core gems"
  section with no way to place anything into it would have been a dead
  panel — so finding 4 (originally deferred by the owner's own first
  answer, *"just #2 and #5 now, defer #1 and #4"*) was pulled back in by
  the shape of #5's fix, not re-argued.

---

## 7. The extension exception (S3a)

Once gems and core gems went fully ownership-blind, the natural next
question was whether extensions should too. The owner drew a sharp,
explicit line:

> *"Weapons extensions should behave differently in the pool. When you
> roll an extension and you already have it socketed or unsocketed it
> increases the level of the extension — regardless if its used or not,
> and after you have max level extension, that card is removed from the
> pool. That's it that's all. Support gems and core gems act differently
> in the pool and its ok, extensions are a different thing and the only
> one with levels."*

Extensions are the only card kind in the game with levels, so they're the
only one for which "you already have one" means something other than
"you now have two." A re-roll of an owned extension levels that exact
instance in place — wherever it currently lives, socketed or banked —
rather than creating a duplicate.

**This also simplified the implementation**, a fact only visible after
the rule was stated: because leveling happens at *roll* time rather than
*placement* time, there is never more than one `(weaponKey, kind)`
extension instance anywhere, which collapses what would otherwise have
been placement-time duplicate-merge logic into a single lookup
(`findOwnedExtension`, checked in both the socketed and banked arrays).
Recorded in its own plan section (§3a) specifically so a future reader
who notices gems ignoring ownership and extensions consulting it doesn't
try to "fix" the asymmetry — it's deliberate.

One instruction came with the correction, and was followed exactly:
after this exchange the owner added *"only record I have not yet given a
greenlight to build"* — the plan was revised and committed to the repo,
but no code was written until a separate, explicit greenlight arrived in
a later message.

---

## 8. The maxHp unsocket exploit

The owner's rule for core-gem unsocketing, stated plainly: *"unsocketing
the core gem should remove what it give, if it give max hp - take it
away when unsocketed."*

Implementing this literally exposed the reason it hadn't existed before:
a core gem's effect had always applied at **card-pick** time
(`applyCardChoice` writing `tower.maxHp += 20` and healing 20 the moment
a `maxHp` card was chosen), because picking a core gem used to fill a
socket immediately. Once core gems bank, the effect has to move to
**socket time**, and removal has to genuinely undo it.

The undo is where the exploit lives: `maxHp -= 20` alone, without also
clamping `hp = min(hp, maxHp)`, leaves `hp` able to sit above the new,
lower maximum after unsocketing — and re-socketing would then silently
re-heal past where the player actually was, a free-heal loop hiding
inside an otherwise-correct-looking removal. Caught before shipping by
writing the test the owner's own framing implied ("take it away") rather
than just implementing the additive half, and verified live in both
directions: unsocketing while damaged heals nothing, and unsocketing at
full HP clamps down rather than leaving HP floating above the reduced
max.

---

## 9. What shipped

**The XP curve** (`tuning/xp.ts`): `xpToNext(level)` multiplies its
existing quadratic base by `XP_GROWTH ** (level - 1)`. The `- 1` is the
whole trick — it leaves `xpToNext(1)` bit-for-bit unchanged, so Decision
61's "the early rush survives" holds by construction rather than by
coincidence.

**The card pool** (`systems/cards.ts`): `buildWeaponSidePool`,
`buildBundlePool` and `buildCoreGemPool` stopped consulting free sockets
or ownership for gems, bundles and core gems. `gemHasLegalHome()` lost
its only caller and was deleted. Extensions kept an ownership check, but
a different one — see §7 — implemented via `findOwnedExtension()`, which
looks in both `extensionInventory` and the weapon's own sockets.

**Three inventories, one shape.** `state.extensionInventory` and
`state.coreGemInventory` were added alongside the existing
`state.gemInventory`, with matching instance types
(`ExtensionInstance { id, weaponKey, kind, level }`,
`CoreGemInstance { id, kind }`). `systems/gemSockets.ts` gained
`socketExtension`/`unsocketExtension`/`socketCoreGem`/`unsocketCoreGem`,
mirroring the existing `socketGem`/`unsocketGem` exactly.
`systems/passives.ts` gained `applyCoreGemEffect`/`removeCoreGemEffect`,
moving a core gem's effect out of `applyCardChoice` entirely.

**The loadout screen's new layout**: a two-column body, weapons and the
core row on the left, a three-section panel (Extensions / Core gems /
Support gems) on the right. Click an entry to select it — every socket it
can legally enter lights up across every weapon row and the core row,
illegal ones dim — then click a lit socket to place, or click the entry
again (or press Escape) to cancel. Real ~28px socket controls (a dashed
border and a `+`) replaced the old bare `○` glyph on both empty and
filled dots. The pre-6A-3 per-row picker (click an empty dot with nothing
selected) was kept as a working second route rather than removed.

513/513 tests (up from 495, 18 new), typecheck clean, build clean.

---

## 10. Verification

**The Browser pane composited normally this session** — a contrast worth
recording against the 6A-1/6A-2 session immediately before it, where
`document.visibilityState` was stuck `'hidden'` and a full debug-harness
workaround was needed just to see anything. No such workaround was needed
here for visibility; a small temporary bridge
(`window.__debugGrantXp`/`__debugState`) was still added, purely to reach
level 60+ without a genuine ten-minute playtest, then removed — the
production bundle hash matched exactly before and after its removal,
confirming no trace was left.

Confirmed live, by hand, beyond the test suite: a gem placement
live-updates a weapon's stat line the instant it lands (Amplifier socketed
into Bolt Turret: 30 → 44 pwr); an extension's placement highlight lights
up *only* its own weapon's sockets, correctly leaving a same-archetype
sibling weapon dark; a core gem's placement highlight lights up only the
three core slots, nothing on any weapon row; clicking a selected entry a
second time, and pressing Escape, both cancel a pending placement cleanly
without side effects; the legacy per-row picker still opens and sockets
correctly when nothing is selected; and the `maxHp` clamp holds in both
directions — a damaged unsocket heals nothing, a full-HP unsocket clamps
down instead of leaving HP above the new maximum. Zero console errors
across the entire session.

---

## 11. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **A gem-upgrade system, an extended socket ladder, or a scaling fallback for the dead-pool problem** | All three became unnecessary the moment the pool stopped requiring a free socket at all — the owner's rule change removed the problem rather than mitigating it. |
| **Keeping extensions gated on free sockets while gems went ownership-blind** | The first plan draft's own choice; superseded once the three-section inventory made an extension inventory necessary anyway — the asymmetry had no remaining justification. |
| **Merging duplicate extensions at placement time** | This plan's own earlier proposal, before the owner's rule. Leveling at *roll* time instead is simpler and yields the uniqueness invariant for free, with no merge logic needed anywhere. |
| **A measured `XP_GROWTH` derived from a real DPS-vs-level harness** | Offered explicitly; the owner chose to ship an estimate instead and retune after playing it — a legitimate call given the project's own established pattern for first-draft constants. |
| **Building 6A-3 the moment the fixes were identified, without a scope conversation** | The owner explicitly stopped this: *"you have stepped over too fast in making a plan."* The revised, larger scope that followed was better than what would have shipped on the first pass. |
| **Treating core-gem unsocket as still deferred once the inventory panel was decided** | A Core gems section nobody could fill would have been a dead, confusing part of the very panel built to fix confusion. Pulled back into scope by the shape of the other fix, not re-litigated as a standalone ask. |

---

## 12. What's next

**Phase 6B** — real extensions for the seven incumbent weapons (the
placeholder `PLACEHOLDER_EXTENSION_KIND` becomes real per-weapon content
for the first time), plus Immolation Ring's remaining
`WEAPON_DAMAGE_SCALE` balance gap and its dead `maxLevel` field. 6B now
lands on top of finished banking/placement plumbing rather than building
half of it itself, which was the whole reason 6A-3 came before it.

**Then the Phase 5 gate** — it needs both things a socket can hold
(gems, extensions) to be real content before "decision or slider?" means
anything; 6B is what finishes that precondition.

**No blockers.** `XP_GROWTH`'s value is the one open number in this batch
and is expected to move after a real playtest, per §2 above.
