# Phase 6 — the content phase, re-planned

**Status:** ✅ **Settled by the owner, 2026-08-09.** All four open
questions answered the same session (§5). Written at the owner's request
— *"review, rethink the phase 6, plan its stages."* Two proposals moved
calls the owner had already settled (the gate's position, and where
extensions live), so per `CLAUDE.md`'s ground-truth override protocol
they were raised and waited for a yes rather than being written down as
superseded. Both got one.

**Nothing here is in `docs/DECISIONS.md` yet** — these go in when the
batches they describe actually ship, matching the posture
`phase-5-6-arsenal.md` §12 took for Phase 5.

**What this document is:** a re-phasing of Phase 6 only. It does not
reopen the catalogue. The 18 weapons, the 65 gems, the six gem classes,
the socket ladder and the coverage matrix are all settled at revision 3
of `docs/plans/phase-5-6-arsenal.md` and are **not touched here** — the
question this document asks is narrower and purely about ordering: *given
what Phase 5 actually shipped, what order does the content go in, and
what is missing from the schedule entirely?*

**Source:** `docs/plans/phase-5-6-arsenal.md` §7, §9, §9½, §13 (the
phasing table this revises); `docs/plans/phase-5b-framework.md`;
`docs/plans/phase-5c-inventory-ui.md`; Decisions 70–72; the code as it
stands at commit `822fb2c`.

---

## Table of contents

1. [Why re-plan at all](#1-why-re-plan-at-all)
2. [Five findings from the review](#2-five-findings-from-the-review)
3. [The proposed stages](#3-the-proposed-stages)
4. [What did not change, and why](#4-what-did-not-change-and-why)
5. [Open questions for the owner](#5-open-questions-for-the-owner)
6. [Risks](#6-risks)

---

## 1. Why re-plan at all

The Phase 6 phasing table (`phase-5-6-arsenal.md` §13) was written on
2026-08-07, **before Phase 5 existed as code**. It has been revised once
since — the 6E/6F swap on 2026-08-08, driven by the visual-cost audit —
but its batch contents were authored against a framework that was still
a design.

That framework is now built, and three things are true that were not true
when the table was written:

- The socket economy is live, and **extensions are one of the two things
  that compete for a socket** — but no batch in the table ships an
  extension.
- The starting kit is live and fills the deck exactly, which has a
  consequence nobody predicted (§2, finding 1).
- The pipeline is live and proven, which means the estimate that 6A is
  "the cheapest possible batch to prove the architecture on" can now be
  checked rather than assumed. It holds.

This is the same posture the project has taken at every phase boundary —
`phase-5-6-arsenal.md` §1 exists because §17's original ordering turned
out to be wrong once Phase 4C was real. **The table is a plan, not a
decision**, and re-planning it against shipped code is the cheap moment
to do it.

**The review's honest headline:** the *content* of Phase 6 is in good
shape and needs no redesign. The *schedule* has one real hole, one live
bug, and three batches that are too big.

---

## 2. Five findings from the review

### Finding 1 — 🟡 Four built weapons are unreachable, because 6-0 is missing

> **Reclassified after the owner's Q4 answer (§5).** This was written up
> first as a live bug. It is not one — a full deck from frame one is the
> intended design, and what is actually missing is the screen that
> chooses the deck. The finding stands; its severity and its fix both
> changed.

Full write-up in `docs/BACKLOG.md`; the short version:

`startRun()` equips exactly three weapons; `state.weaponSlots` is three;
`buildWeaponSidePool()` offers a `newWeapon` card only when the deck has
a free slot; and `newWeapon` is the only code path that ever equips
anything. So **Blades, Frost, Missile and Immolation Ring cannot be
obtained in a run.** Blades is, by the 2026-08-05 balance table, the
strongest weapon in the game at 534 DPS.

Both halves shipped in 5B and **each is correct in isolation** — this is
an interaction, which is why the test suite is silent on it: the
deck-full case is precisely the case 5B's gating test asserts should
offer nothing.

**It changes what 6-0 is.** The backlog entry from 2026-08-08 called the
pre-run select a playtesting convenience — *"no weapon pairing could be
deliberately playtested."* That undersold it. With weapons permanently
out of the card pool (§5, Q4), the pre-run screen is the **only
mechanism by which any weapon is ever equipped**, which makes 6-0
blocking for every subsequent batch in a much stronger sense than "the
owner cannot judge it." Ship a weapon in 6C and, without 6-0, nobody can
play it — including the owner.

### Finding 2 — 🔴 Extensions are scheduled nowhere

**The schedule hole, and the same shape as the deck-builder hole 5A
found.** The §13 table's batches are named "Gems: …" and "Weapons: …".
There is no batch named "Extensions," and no batch description mentions
authoring one.

Meanwhile the design leans on them hard:

- §5: sockets take **either an extension or a gem**, sharing one pool,
  *"which makes it maximally contested and asks a good question every
  time — specialise this weapon, or generalise it?"*
- §7: **three extensions per weapon**, four candidates designed each, the
  fourth kept as a designed spare.
- §11: extensions are **one of the two halves of the card pool**, and the
  entire dilution model is built on the deck bounding them.
- The owner's own rule — extensions level 1→3 then leave the pool
  permanently — is the fix for the 2026-08-05 *"cards appear to do
  nothing"* finding.

**What exists in code is one placeholder.** `tuning/extensions.ts` is a
single `'placeholder'` kind called *Prototype Mount*, offered identically
by every weapon, honestly labelled as a placeholder. That was exactly
right for 5B, whose charter was mechanism-not-content — but nothing in
Phase 6 replaces it.

The full bill is **54 extensions** (18 weapons × 3), and it does not
belong in one batch. The proposal in §3 is simply: **a weapon's three
extensions ship with that weapon, in the same batch, always.** They are
that weapon's content, not a separate content type, and splitting them
apart is what let them fall off the schedule in the first place.

**That leaves the seven incumbents with nowhere to go.** Bolt, Blades,
Chain, Frost, Poison, Missile and Immolation Ring appear in no Phase 6
batch — 6B through 6E ship only *new* weapons. Their 21 extensions
therefore have no home under any phasing, current or proposed, unless a
batch is added for them. §3 adds one.

### Finding 3 — 🟡 The gate at 6A judges a half-built socket

The gate's question is *"is enhancement a decision or a slider?"* It was
moved from after 5C to after 6A on exactly the right reasoning
(`phase-5c-inventory-ui.md` §1): **opening a socket buys nothing while
there is nothing to put in it**, so the answer would be forced to
"slider" regardless of whether the design is sound.

That reasoning is not yet fully discharged at 6A. After 6A the sockets
contain gems — real ones, ~20 of them — but the *other* thing sockets
hold is still *Prototype Mount*. The gate would be judging the
specialise-vs-generalise question with one of its two terms a
placeholder, and §5 is explicit that the shared pool is what makes that
question exist at all.

**Proposal: the gate runs after 6B** (the incumbent-content batch), which
is the first point at which both socket-fillers are real. This is a
smaller move than the last one — one batch, and the build order is again
unchanged.

**Raised, not decided.** Gate placement is an owner call, and it has been
moved once already. There is a real argument for leaving it at 6A: the
gate is also a **go/no-go on the 65-gem count** (§14 risk 2), and that
half is fully answerable at 6A. If the owner would rather answer the gem
question early and the socket question late, splitting the gate in two is
the alternative and it is a legitimate shape.

### Finding 4 — 🟡 Three batches are too big to be one batch

Every batch is supposed to be independently playtestable. Three are not,
by the project's own recent evidence — 4C was split before any code *"as
scoped, 4C was bigger than 3C, which had needed its own playtest-and-fix
round,"* and that split is now the model.

| Batch | As scoped | The problem |
|---|---|---|
| **6D** | Mortar, Cauterizer, Solvent, Resonance, Repulsor | Five weapons and **two new subsystems** — persistent terrain modification *and* displacement. Either is a phase's worth of risk. |
| **6E** | Antibody Swarm, Marker Beacon, Mycelium | Two of the three riskiest weapons in the catalogue. Mycelium alone carries the reaction-diffusion divergence trap and doubles per-tick field cost. |
| **6F** | All 14 transformative gems | Carries **all six** of the catalogue's expensive-visual gems (§9½). The plan's own words: *"the batch to schedule generously."* |

Splitting them costs nothing structurally — no batch below depends on
another within the same original batch — and it buys three more playtest
gates in the part of Phase 6 where the risk actually is.

### Finding 5 — 🟢 Two cleanup items that belong to a batch, not a drawer

Both are small, both are already-settled calls that 5B was expected to
carry out and did not, and both should be named so they are not
rediscovered a third time:

- **`WeaponDef.maxLevel` is dead data.** §6 retired it (no cap, no
  diminishing returns) and 5B removed the last code path that read it for
  weapons, but the field is still declared and still set on all seven
  defs — including Immolation's inconsistent `6`. Delete in **6B**.
- **The legacy `damage`/`atkSpeed` passives must be deleted when 6A
  lands.** `systems/cards.ts` says so in a comment already: they are the
  *"one deliberate exception to 'everything routes through sockets
  now'"*, held over only until Amplifier and Overclock exist as real
  gems. 6A is what makes them exist. If they are not removed in the same
  batch, the game ships two parallel mechanisms for the same two stats,
  and the gate immediately after would be judging a doubled-up economy.

---

## 3. The proposed stages

Each row is one batch: independently buildable, independently
playtestable, and small enough that a bad result is cheap. **Bold rows
are new or moved** relative to `phase-5-6-arsenal.md` §13.

| Batch | Content | Why here |
|---|---|---|
| **6-0** | ✅ **Shipped 2026-08-09.** Pre-run weapon select — list, checkboxes, exact-count enforcement, default deck, deck lines on both screens. No currency, no unlocks. | Unchanged in position, **upgraded in importance** by finding 1: it was not a convenience, it is the only route to most of the roster. Full account: `docs/plans/phase-6-0-weapon-select.md`. |
| **6A-1** | ✅ **Shipped 2026-08-09** (Decision 74). **Split from 6A on 2026-08-09.** The gem foundation: delivery archetypes, the per-weapon modifier lookup, gem cards/inventory, **the socketing UI 5C left unbuilt**, the 6 Amplifier gems, **legacy `damage`/`atkSpeed` passives deleted** (finding 5). Plan: `docs/plans/phase-6a1-gem-foundation.md`. | The half that genuinely is O(1) in weapons, and therefore the honest test of 5A's central bet. Also the half that makes sockets *usable* — without it the Phase 5 gate cannot ask its question at all. |
| **6A-2** | ✅ **Shipped 2026-08-09** (Decision 75). Behaviour gems (14) on four new mechanisms: the **RESOLVE stage** 5A deferred (as `ClearOptions`), **projectile behaviour flags**, **deferred emissions + a weapon registry**, and emission multiplication. Plus the bundle card. **Immolation Ring's visual moved here from 6B** (below), folded in on the owner's request the same day it shipped. Plan: `docs/plans/phase-6a2-behaviour-gems.md`. | ⚠️ **The estimate that made 6A look cheap was measured on the wrong axis** — §9½'s 17-free/3-modifier/0-new is a *rendering* table. By implementation, only 2 of the 14 are the "one function on stage 3" §4 assumes; 4 need RESOLVE and 6 are projectile-flight properties outside the four-stage model entirely. The weapon registry built here is also what **Trigger** (6I) needs, so the catalogue's most build-generating gem gets most of its cost paid early. |
| **6A-3** | ✅ **Shipped 2026-08-09** (Decision 76). **Not in the original nine-batch plan — inserted the same day**, after the owner playtested 6A-1/6A-2 immediately after they shipped and found three structural breaks: the XP curve, the card pool going dead once every socket filled, and socketing UX unclear enough to look broken. Geometric XP curve; the card pool made socket/ownership-blind for gems, core gems and bundles (**superseding arsenal plan §11's no-dead-card rule**); extensions and core gems banked exactly like weapon gems; a three-section click-to-place inventory panel. Plan: `docs/plans/phase-6a3-loop-fixes.md`. | 6B's extensions arrive through the exact card pool and socketing UI this batch fixed — building 6B on top of the pre-6A-3 versions would have meant building on a dead pool and UX the owner had already flagged as broken-looking. |
| **6B** | ✅ **Shipped 2026-08-10.** The seven incumbents' content: **28 real extensions** (four per weapon, superseding the "21/nine" figures below — Decision 78) replacing *Prototype Mount*; Immolation Ring's remaining balance gap (`WEAPON_DAMAGE_SCALE`, the other two closed for free once `weaponMods` shipped in 6A-1) and its dead `maxLevel` field (BACKLOG). | Finding 2 — the incumbents appear in no batch at all, and their extensions are the other half of what a socket holds. Also clears the one standing item left on Immolation. |
| **6C** | ✅ **Shipped 2026-08-10**, split 6C-1/6C-2. Weapons: Lance, Shockwave, Fission Charge — **with twelve extensions** (four per weapon, per Decision 82 — supersedes the "nine" figure this row originally carried). | Unchanged content, unchanged reasoning: the three that need nothing beyond the pipeline, and the two that most directly fix the owner's named single-target and AoE gaps. Established **beam rendering** (Lance) for Cauterizer to reuse, and generalized `clearAt` to non-disc shapes (`ClearOptions.shape`, Decision 83) — forced by Shockwave, reused by Lance. |
| **▶ THE GATE** | *Moved a third time (Decision 81) — now runs after 6C, not after 6B.* Judge the socketing loop, the gem count, and *is enhancement a decision or a slider?* | Ten weapons against three deck slots is a stronger place to ask this than the three-weapon deck 6B alone left behind. |
| **6D** | Gems: Conditional (11) + Targeting (8). | Unchanged. Threat Priority finally lands against the Carrier/Bulwark pair shipped in 4C specifically to make it interesting. 14 free, 5 modifier, 0 new. |
| **6E** | Weapons: **Mortar, Cauterizer, Solvent** + extensions. Subsystem: **persistent terrain modification**. | Half of the old 6D. One new subsystem, not two. Solvent is the only answer in the catalogue to the scar-ring risk, so this batch is also where design risk #4 finally gets tested. |
| **6F** | Weapons: **Resonance Coil, Repulsor, Marker Beacon** + extensions. Subsystem: **displacement**. | The other half. Establishes displacement rendering, which the Inversion gem reuses in 6H. Marker moves here from the old 6E — it is a debuff overlay, not a summon, and has nothing to do with the two riskiest weapons. |
| **6G** | Weapons: **Antibody Swarm, Mycelium** + extensions. Subsystems: **autonomous units**, **a second field layer**. | The two riskiest things in the catalogue, alone in their own batch, late. Mycelium inherits the `D * step <= ~0.25` divergence trap and doubles per-tick field cost. **If the catalogue ever trims, it trims here**, and a batch of two is the cheapest possible thing to cut. |
| **6H** | Gems: Transformative, **the eight cheap ones** — Trigger, Orbital Conversion, Reclamation, Fission Cascade, Sympathetic Link, Culture, Metronome, Overload. | Splits the old 6F by visual cost, which is the axis that actually predicts effort (§9½). Trigger is here, and it is the single most build-generating mechanic in the document — it deserves a gate where it is not competing for attention with six new renderers. |
| **6I** | Gems: Transformative, **the six expensive ones** — Detonation, Sustained, Inversion, Siphon, Conversion, Emplacement. | Every gem needing genuinely new rendering, last, on a visual vocabulary fully established by 6C/6E/6F/6G. Preserves §9½'s ordering constraint exactly: Repulsor (6F) before Inversion, Antibody Swarm and Mycelium (6G) before Conversion and Culture. |

**Eleven batches plus a gate, against the original six plus a gate.** No
catalogue content was added or removed — the deltas are one new batch for
content that had no batch (6B), five splits (6A into three on 2026-08-09
— 6A-1/6A-2 planned same-day, 6A-3 inserted the same day again after the
owner's playtest of 6A-1/6A-2 — plus 6D/6E/6F), one gate move, and Marker
Beacon changing batches. 6A-3 alone is genuinely new *process*, not
catalogue content: it exists because playtesting 6A-1/6A-2 the same day
they shipped surfaced problems no amount of design-time review would
have caught.

---

## 4. What did not change, and why

Recorded explicitly, so a later read does not have to infer it from
absence:

- **The catalogue.** 18 weapons, 65 gems, six classes, three extensions
  per weapon, the coverage matrix. Settled at revision 3 and reviewed by
  the owner twice. Nothing here reopens it.
- **6A stays first.** The instinct to ship a weapon first is wrong for
  the same reason it was wrong in the original plan: 6A is the batch that
  tests whether 5A's bet paid off, and it does so against seven weapons
  that already work. A failure there invalidates the pipeline, and every
  weapon batch afterwards would have to be redone.
- **The 6E/6F swap of 2026-08-08 survives**, and is in fact strengthened
  — weapons still establish every new visual vocabulary before the gems
  that generalise it, now with more room between them.
- **Mycelium still ships last** and is still the first cut.
- **The declined dilution fixes stay declined, with one exception.**
  Deck-relevance filtering and gems levelling out are both still
  deferred, unchanged. **The trade ship is not** — 6A-3 gave it a
  concrete job (recycling surplus gems into currency mid-run, once the
  card pool went ownership-blind and started producing surplus by
  design) though it remains unbuilt, still Phase 7. The gate is still the
  go/no-go, and moving it by one batch does not change which shelf the
  fix comes from.
- **The modal level-up pause stays modal**, judged at the gate, per call
  25.

---

## 5. The four questions, and how the owner settled them

All four answered 2026-08-09, in one pass.

**Q1 — Does the gate move from after 6A to after 6B?** ✅ **Yes, moved.**
It now runs after 6B, the first point at which both things a socket can
hold are real content. Build order unchanged; only the gate moved, for
the second time and for the same reason as the first. If the 65-gem count
looks bad during 6A's own build, that gets raised immediately rather than
waiting for the gate.

**Q2 — Is 6B (the incumbent content batch) accepted?** ✅ **Yes.** The
seven existing weapons get their 21 real extensions and the dead
`maxLevel` field goes. *(Immolation's visual, originally slated for this
batch, moved up into 6A-2 and shipped 2026-08-09 — see that row above.)*
The alternative — seven starting weapons permanently carrying a
placeholder while eleven newer ones carry real content — was not a shape
worth shipping.

**Q3 — The three Immolation Ring balance gaps: fix or keep?** ✅ **Fix
all three**, though only one is left to fix in 6B now. It should respond
to Overclock and Amplifier and receive Phase 4C-1's +50%
`WEAPON_DAMAGE_SCALE` pass, closing a call open since 5A. **Two of the
three closed for free once 6A-1 shipped** — `weaponMods()` applies
uniformly to every weapon including Immolation Ring, so no
Immolation-specific code was needed for the Overclock/Amplifier response.
Only the `WEAPON_DAMAGE_SCALE` pass remains, now 6B's job alone. The
reasoning that decided it stands unchanged: these gaps exist because Ward
Pulse was misfiled as a passive when each of those passes shipped, so the
current behaviour is a **classification accident, not a design
position** — and inheriting a balance stance from an accident is how a
project ends up defending something nobody chose. The regression test
that pinned the Overclock gap was rewritten as part of 6A-1.

**Q4 — Must a deck fill every slot?** ✅ **Yes — always full, and the
card pool never offers a weapon.** The owner's answer, which settled more
than the question asked:

> All of the slots equipped, as you will be able to buy more slots with
> currency, there is no way to change weapons mid-run. And the player
> should not be offered any weapons in the pool — only weapon-specific
> extensions the player can use, support gems and core gems.

Three rules fall out, and they resolve finding 1 as design rather than as
a defect:

1. **A deck always fills `state.weaponSlots` exactly.** Slot count is a
   Phase 7 currency purchase (Decision 39); it is never a per-run choice.
   §5's *"an unlocked slot is optional to use, and that is a real
   decision"* is **superseded** — the decision is which weapons, never
   how many.
2. **The deck is immutable for the run's duration.** Chosen before the
   run, fixed until it ends.
3. **The card pool contains extensions, support gems and core gems —
   never a weapon.** This is not a change to the design record but an
   alignment with it: §11's own pool arithmetic (9 + 53 + 0 = 62) never
   counted new-weapon cards. 5B's `newWeapon` branch was the outlier, and
   **6-0 deletes it.**

The four currently-unreachable weapons therefore need no separate fix.
They are unreachable because the screen that picks them does not exist
yet, which is exactly what 6-0 builds.

---

## 6. Risks

**1. Eleven batches is a lot of gates, and gate fatigue is real.** The
counter-evidence is the project's own record: every phase since 4A found
real bugs *only* by running the game, and the two phases that were split
before coding (4C, and 5 into A/B/C) are the two that went most
smoothly. Batches this size are cheap to playtest — most are ten minutes
of play — and the alternative is finding six problems at once.

**2. 6B is unplanned work and will not feel like progress.** Twenty-one
extensions is real content authoring for weapons that already exist, and
it ships no new weapon. It is worth naming up front that this batch will
feel slow, because the temptation to skip it is exactly how the schedule
hole opened.

**3. Extensions may turn out to be the wrong unit of content.** Three per
weapon at 18 weapons is 54 mechanics, each needing a description that
survives the *"cards appear to do nothing"* test. 6B is the batch that
finds out at a cost of seven weapons rather than eighteen — which is a
second argument for it existing.

**4. The unreachable-weapons bug means nobody has playtested a deck
containing Blades since 5B shipped.** Blades is the strongest weapon in
the game and the clearest illustration of what a socket does. Whatever
the 5B and 5C soak tests showed about the card pool, they showed it about
a three-weapon deck that could never grow. Treat pre-6-0 balance
observations accordingly.

**5. Phase 6 remains large no matter how it is cut.** Nine batches does
not make it smaller; it makes failure cheaper. The catalogue is the size
the owner chose deliberately — *"18 weapons, I like them all"* — and this
document does not argue with that.

---

*Written 2026-08-09. Proposal only — §5's three questions are open, and
nothing here is written into `docs/DECISIONS.md`. The batch contents
below the gate (6C–6I) are deliberately less detailed than 6-0 and 6A:
they are far enough out that planning them in depth now would be
authoring against a framework that the gate might change.*
