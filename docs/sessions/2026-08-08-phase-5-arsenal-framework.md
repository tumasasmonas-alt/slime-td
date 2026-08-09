# Session record — 2026-08-08
## The arsenal design, and all of Phase 5: the pipeline, the economy, the screen

**Type:** design + planning + implementation, four phases built back to
back in one sitting: 5A, 5B, 5C, plus the arsenal catalogue design that
made all three buildable.
**Participants:** project owner + Claude.
**Outcome:** Phase 5 is complete. Every weapon runs on a shared pipeline
(5A, Decision 70); enhancement points, sockets and a restructured card
pool exist (5B, Decision 71); a pause + inventory screen makes all of it
usable (5C, Decision 72). The arsenal catalogue for Phase 6 — 18 weapons,
65 support gems — is fully designed and owner-reviewed, not yet built.

> **Why this file exists.** Eleven commits, three new decisions, and a
> genuinely large amount of back-and-forth in one day — the kind of
> session `docs/PROGRESS.md`'s own convention (Decision 37) says belongs
> in a dedicated record rather than being crammed into the status file.
> This is deliberately a **summary with pointers**, not a re-derivation:
> the plan docs already carry the full reasoning in their own "settled"
> sections, and duplicating it here would just be a second copy to keep
> in sync. Read this first for the shape of the day; follow the links for
> depth.

---

## Table of contents

1. [The arsenal catalogue — three revisions in one day](#1-the-arsenal-catalogue--three-revisions-in-one-day)
2. [Phase 5A: the weapon pipeline](#2-phase-5a-the-weapon-pipeline)
3. [The UI/UX question, and the visual-cost audit](#3-the-uiux-question-and-the-visual-cost-audit)
4. [Phase 5B: the enhancement, socket and card-pool economy](#4-phase-5b-the-enhancement-socket-and-card-pool-economy)
5. [Assist credit: designed, implemented, found wanting, dropped](#5-assist-credit-designed-implemented-found-wanting-dropped)
6. [Phase 5C: the pause + inventory screen](#6-phase-5c-the-pause--inventory-screen)
7. [What shipped](#7-what-shipped)
8. [Ideas considered and rejected](#8-ideas-considered-and-rejected)
9. [What's next](#9-whats-next)

---

## 1. The arsenal catalogue — three revisions in one day

The owner opened with a direct brief: *"we should start with at least 15
weapons, all of them should have their own attributes you can upgrade
with points and weapon extensions... support gems can also add abilities
to weapons, or change their working way all together."*

**Revision 1** proposed 18 weapons and ~35 gems, with enhancement points
allocated per-attribute and sockets opening on investment. The owner
approved the socket-opening model and the catalogue outright, but
reshaped the attribute system: *"every weapon would have a +/- only one
of them"* — a single scalar per weapon rather than per-attribute
allocation, which turned out to restore Decision 40's original
legibility argument almost exactly. Also cut the **Reach** gem as
redundant with Expansion, and asked the gem list to grow.

**Revision 2** answered that: 65 gems across six classes, researched
against Path of Exile 2's duplicate-gem rule and Noita's wand-modifier
system (which supplied **Trigger** and **Formation**, the two mechanics
most responsible for that game's emergent builds). The owner approved
without changes.

**Revision 3** closed 23 remaining open questions in one pass — core
mechanics like no cap/no diminishing returns (restoring the rest of
Decision 40), the starting kit (Bolt/Chain/Poison), extensions capped at
3 per weapon, and the socket ladder (0/3/8/15/24).

Full design: **`docs/plans/phase-5-6-arsenal.md`**.

---

## 2. Phase 5A: the weapon pipeline

Before any of Phase 5 could be built, a full **pre-refactor audit** —
re-reading every decision, session record and plan against the arsenal
design — found six flags. The owner settled three (Phase 4's gate had in
fact been played, *"I have played it, all good"*; **Ward Pulse becomes
Immolation Ring**; the modal level-up pause stays for now, judged at the
gate) and three became work items with no call needed (a missing
tower-centred-radius test, `pickThree`'s biased shuffle, a rewrite-tests
step that turned out unnecessary once checked).

**Shipped**: `weapons/pipeline.ts` — every weapon (all seven, including
the newly-promoted Immolation Ring) refactored onto a shared
`ready → acquire → deliver` pipeline, with the fourth stage (`resolve`)
deliberately deferred until Phase 6 has a real gem to prove it against.
**Zero behaviour change**, verified three ways: the 23 pre-existing
weapon tests turned out to already be true outcome tests and passed
unmodified; a live debug-harness run confirmed all seven weapons fire
correctly; the production bundle came out byte-identical in size.

Three balance gaps surfaced during Ward Pulse's promotion — no response
to Overclock, no response to Amplifier, missing the Phase 4C-1 damage
buff — all **preserved exactly**, not silently fixed, and flagged in
BACKLOG as an open call for the owner.

Full account: **Decision 70**, `docs/plans/phase-5-6-arsenal.md` §13's
5A row and its "three audit findings" subsection.

---

## 3. The UI/UX question, and the visual-cost audit

Between 5A and 5B, the owner asked when the pre-game and inventory
screens would be built, whether weapons ship with visuals, and how
weapons respond visually to gems and extensions. This produced the
session's sharpest finding, unrelated to what was being built at the
time but reshaping what came after:

**The render layer was half entity-driven, half weapon-coupled.**
`render/projectiles.ts`/`render/clouds.ts` already read appearance off
the entity; `render/orbitals.ts`/`render/novaFx.ts` hardcoded Blades'
shape and Frost's colour, and **`state.novaFx` was a single nullable
slot** — a latent bug, since Immolation Ring's still-pending visual and
Shockwave (Phase 6B) would both need to pulse in the same frame.

**Every weapon and gem got classified by visual cost**: 43 free, 16
shared-modifier, 6 genuinely new — far cheaper than the 18×65
combinatorics implied, because the entity-driven pattern already carries
most of it. The classification changed the build order: four of the six
expensive transformative gems share rendering with a weapon (Conversion
with Antibody Swarm, Culture with Mycelium), and the old order shipped
the gem *before* the weapon in every case. **Phase 6's E/F batches were
swapped** so weapons establish the visual vocabulary first.

Also settled: a minimal pre-run weapon select becomes **Phase 6-0**,
moved forward from Phase 7, since the deck defines the card pool from 5B
onward but the deck *builder* was scheduled three phases later — meaning
no Phase 6 weapon batch could be deliberately playtested until it shipped.

Full account: `docs/plans/phase-5-6-arsenal.md` §9½ and the reordered
§13 phasing table; `docs/plans/phase-5b-framework.md` §6a for the render
fix itself, built into 5B.

---

## 4. Phase 5B: the enhancement, socket and card-pool economy

Planning this surfaced a real scope tension: weapon-socketed gems are
themselves Phase 6 content, so a strictly by-the-book 5B would ship
sockets with nothing to put in them. **Settled: 5B ships the five core
gems that are direct ports of already-working passives as real content**
(Vitality, Regeneration, Plating, Magnetism, Avarice), keeping the
socketing loop judgeable while the weapon-gem side stays empty until 6A.

Four more questions were settled the same session, two of which beat the
options originally offered: **core gems get a guaranteed card slot every
second level-up** (not a separate draw, which goes dead once 3 sockets
fill; not a slot in every draw, which permanently spends a quarter of the
pool on defence) with an exhausted-pool fallback; the **bundle card
defers wholesale to 6A**, since with no real gems it could only bundle
placeholders — not a thin version of the mechanic but a different, worse
one.

**Shipped**: weapon-level cards deleted outright (Decision 40, finally
implemented after being written down); enhancement points bank globally
at 1/level; the 0/3/8/15/24 socket ladder as a pure function; new-weapon
cards gated on free deck slots for the first time; extensions level 1→3
then leave the pool **permanently**; `pickThree`'s biased shuffle
replaced with an unbiased Fisher-Yates; gem inventory and a
no-destructive-respec `withdrawPoints()` built as tested plumbing with no
live caller yet. Card-pool logic moved into `systems/cards.ts`, pure and
tested, with `ui/upgradeCards.ts` reduced to a thin DOM wrapper.

Full account: **Decision 71**, `docs/plans/phase-5b-framework.md`.

---

## 5. Assist credit: designed, implemented, found wanting, dropped

The one piece of 5B that didn't ship as originally planned. It existed to
solve a real-sounding problem: Solvent/Repulsor/Marker (Phase 6D weapons)
destroy no mass, and XP *is* destroyed mass, so they looked set to
generate zero XP and ship as traps.

**Implementing it found the problem doesn't exist.** XP is a single
global pool, never tracked per weapon anywhere in the design, and
enhancement points bank the same way — so any kill by any weapon in a
deck already pays full credit today, with nothing to fix. Raised for the
owner rather than built or silently dropped, per the ground-truth
override protocol (the same posture Decision 62 used for the
behemoth-timing pushback).

**The owner confirmed dropping it**: *"it's fine to drop assist credit if
the player will still get the XP after the mass is dead."* Moved to
`docs/BACKLOG.md` *Ideas* with the reasoning intact and a note on what
would revive it — any future feature needing to know *which* weapon
earned something. None are planned.

---

## 6. Phase 5C: the pause + inventory screen

Planning this found the Phase 5 gate itself was compromised: its central
question — *"is enhancement a decision or a slider?"* — is guaranteed to
answer "slider" while sockets are empty, since opening a socket buys
nothing until Phase 6A ships real gems. **The gate was moved to after
6A**, one combined gate instead of two; the build order (5C → 6-0 → 6A)
was not changed.

Four smaller questions were settled the same session: a HUD button opens
the screen (this game has zero keyboard input today, so a key-only
binding would be undiscoverable); `WeaponDef` gained a terser `stats(lvl)`
alongside the existing card-copy `desc(lvl)`; a weapon at 0 points stays
equipped rather than unequipping.

**Shipped**: the inventory overlay, opened from a HUD button or from a
"Manage Loadout" button inside the level-up card screen (closing returns
to whichever context opened it, rather than discarding pending cards);
`+`/`−` wired to the enhancement economy; live stat lines and socket dots
that visibly grow with investment; a core-gem row; `ui/weaponRow.ts` as a
shared renderer with a `'select'` mode scaffolded for Phase 6-0.

**Found and fixed a real bug in 5B's own plumbing**: `withdrawPoints()`
removed points from a weapon but never credited them back to the bank —
inert while nothing called it in 5B, a genuine bug the moment 5C's `−`
button became the first live caller.

Verified live via direct DOM interaction in the browser (not just the
debug harness) — every open/close path, both entry points, the extension
clamp disabling correctly, a core gem socketing and rendering.

Full account: **Decision 72**, `docs/plans/phase-5c-inventory-ui.md`.

---

## 7. What shipped

| Area | 5A | 5B | 5C |
|---|---|---|---|
| New files | `weapons/pipeline.ts`, `weapons/immolation.ts` | `tuning/sockets.ts`, `tuning/coreGems.ts`, `tuning/extensions.ts`, `systems/cards.ts`, `systems/sockets.ts` | `ui/inventory.ts`, `ui/weaponRow.ts` |
| `state.ts` | `OrbitalVisual`/`NovaFx` appearance data, `novaFx` list | `enhancementPool`, `weaponSlots`, `coreGems`, `gemInventory`, `weaponSockets`, `GemInstance`/`ExtensionSlot`/`WeaponSockets` types | — |
| `types.ts` | `WeaponKey` +`immolation`, `PassiveKey` −`ward` | — | — |
| Removed | `systems/ward.ts` | old weapon-level card branch in `buildCardPool` | — |
| Tests | 339 (from 337) | 380 (from 339) | 389 (from 380) |

**Final state**: 389 tests across 38 files, typecheck clean, build clean.
Every phase verified live via the project's established debug-harness
methodology (Decision 59) before being called done, with production
bundle size confirmed byte-identical after each temporary debug bridge's
removal.

---

## 8. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **Per-attribute enhancement allocation** (revision 1) | The owner's single +/- per weapon is better — restores Decision 40's legibility and makes attribute count free, which is what let Blades keep a 4th attribute for blade count. |
| **A separate core-gem draw, or a guaranteed slot every draw** | The former goes dead once 3 sockets fill; the latter permanently spends a quarter of the pool on defence. A guaranteed slot every *second* level-up avoids both. |
| **Shipping the bundle card in 5B** | With no real gems it could only bundle placeholders — a different, worse mechanic, not a thin version of the right one. Deferred wholesale to 6A. |
| **Assist credit** | XP is a global pool with no per-weapon tracking anywhere; any kill already pays full credit. Nothing for the mechanism to attach to. Dropped, moved to BACKLOG *Ideas*. |
| **Running the Phase 5 gate right after 5C** | Its central question is unanswerable with empty sockets — a guaranteed "slider" false negative. Moved to after 6A; build order unchanged. |
| **A key-only binding to open the inventory** | This game has zero keyboard input today and no controls hint anywhere — undiscoverable for a screen meant to be opened repeatedly. Button first, key later. |
| **Unequipping a weapon at 0 enhancement points** | A stat control silently freeing a deck slot is a surprising side effect; mid-run deck management is a Phase 7 concern. |
| **Building the render structural pass in 6A instead of 5B** | Cheap now, annoying to retrofit; doing it in 5B means 6A's first real gems land on a render layer already able to carry them. |

---

## 9. What's next

**Phase 6-0**: a minimal pre-run weapon select, reusing `ui/weaponRow.ts`'s
`'select'` mode. Then **6A** (the first real support gems — Amplifier +
Behaviour classes), then **the Phase 5 gate**, now combined with judging
Phase 6A's first content. Full phasing: `docs/plans/phase-5-6-arsenal.md`
§13.

**One open item for the owner**, not blocking: the three balance gaps on
Immolation Ring (no Overclock response, no Amplifier response, missing
the Phase 4C-1 damage buff), preserved deliberately during 5A's promotion
and flagged in `docs/BACKLOG.md` for a Phase 6B tuning pass.
