# Slime TD — Progress Tracker

**This is the project's primary status document.** It exists so that work
can resume on a different machine (this is a solo project developed from
two machines via git) without re-deriving context — not just *what* the
code does, but what was discussed, what was decided, and what the plan
was when the last session ended.

Companion documents:
- **`docs/DECISIONS.md`** — the full decision register. Every load-bearing
  decision, with its reasoning. Check it before changing anything that
  looks odd; a lot of "odd" is deliberate.
- **`docs/BACKLOG.md`** — bugs, TODOs, and ideas. One unified list.
- **`docs/sessions/`** — long-form records of individual sessions. Where
  the *reasoning* lives when a discussion produces more context than a
  status file should carry, including options considered and rejected.
  This file points into them; it does not duplicate them (Decision 37).
- **`archive/`** — the original prototype and its handoff doc. **Deprecated
  and non-authoritative** since the port completed.

---

## How to use and update this file

**Starting a session:** read *Current state* and the most recent *Session
log* entry. That's enough to know where things stand and what was
planned next.

**Ending a session:** add a new entry at the top of the *Session log*
(newest first). A good entry answers, for someone with zero memory of
the conversation:

1. **Shipped** — what actually landed, with commit hashes.
2. **Discussed** — what was talked through, including options considered
   and rejected. This matters as much as the outcome; it prevents
   re-litigating settled questions.
3. **Decided** — new decisions, cross-referenced to `docs/DECISIONS.md`.
4. **Planned** — what the next session should pick up, and any open
   questions still waiting on the project owner.

Also update *Current state* so the top of the file is never stale, and
add anything discovered-but-deferred to `docs/BACKLOG.md`.

Don't let this file become a changelog — git already is one. It's for
the reasoning and the plan, which git does *not* capture.

---

## Current state

**Last updated:** 2026-08-07 (Phase 4C shipped — **Phase 4 is complete**)

**Phase 3 and all of Phase 4 are built.** 3A–3D are playtested and
confirmed — verdict on 3D: *"it plays much better now."* **4A** added the
maturity field (Decisions 63–65); **4B** made both axes readable, verdict
*"looks nice, I like the more colour gradient"* (Decisions 66–67); **4C**
completed the coagulant roster — Sclerotic, Blastoma (4C-1, Decision 68),
Carrier, Bulwark (4C-2, Decision 69) — so all seven kinds from §10 now
exist and all four of its identity readings (mass, maturity, mass shape,
corridor density) are wired up. Weapon damage raised 50% alongside armour
landing, at the owner's instruction, so the mechanic is visible without
ending runs in 30 seconds.

**Every phase since 4A has found real bugs only by running the game**, not
by the test suite — worth internalizing before trusting a formula's first
draft. 4A took five rounds (one made 22% of the arena permanently
invisible); 4C-1 found two — a bloom's own formation attempt fires before
most of its maturity budget accumulates, and the Sclerotic threshold was
set from a number (0.55) that mean-based flood-fill dilution made
unreachable in practice (fixed to 0.4). Full accounts in the session
records; the pattern, not just the fixes, is the thing worth reading.

**Balance itself is still explicitly not gradeable** — the owner's own
scoping: weapon damage numbers, slime speed and overall game feel need the
remaining systems in place before they can be tuned honestly. That is
Phase 8 (Decision 13's supersession), not a reason to reorder anything.

| | |
|---|---|
| Tests | 337 passing (35 test files) — one known flake, see BACKLOG |
| Source | 64 modules under `src/` |
| Typecheck | clean |
| Build | clean |
| Branch | `main` |
| Code state | **Phase 3 complete (3A–3D) + Phase 4 complete (4A–4C).** Phase 5 onward is still design-only. |
| Blockers | **None.** Next is Phase 5 (arsenal framework), linearly. |

**What works today:** the horde-economy loop, end to end, playtested
repeatedly. Infection grows as a density field across a **fixed
perimeter**, hardening into a scar ring where the player fights while the
wilderness stays soft (Decisions 63–65), rendered on two independent
visual axes (Decisions 66–67). **Infection Events** (branching veins,
radial blooms) inject growth and maturity and, at their peak, spark
**coagulants** out of whatever contiguous mass a bounded flood-fill
finds — with a visible rise/fade telegraph before one can move or be
targeted (Decision 54). Identity now reads all four of §10's signals:
**Mote/Congealer/Behemoth** from mass alone, **Sclerotic** from hardened
ground, **Blastoma** from a fragmented mass shape (splitting into two
fragments partway through a fight), **Carrier** from a thick corridor back
to the core (and feeds off it as it travels), **Bulwark** from high mass
*and* high maturity, rendered as a genuinely non-circular wall (Decisions
68–69). A coagulant is pure mass with no separate HP — every weapon
damages it through the same formula that clears grid tissue, scaled by how
much of the hit actually overlaps its body, now armoured for kinds born of
hardened ground. Kill one and it's gone, converted to XP; let one reach the
core and it dumps its full remaining mass as tower damage and a field
breach. Six auto-firing weapons (damage raised 50% alongside armour
landing), eight passives via level-up cards, contact damage, flavour-only
tiers, game over, restart with a fresh maze.

**What the playtest found (2026-08-05, pre-rework):** the game was too easy
and structurally so, not numerically. **Player power scaled 17–21× across
a run; the infection scaled 3.1×.** No value of `CONTACT_SCALE` was right
at both ends. Nodes felt bad. XP arrived far too fast. The full findings
and math are in the 2026-08-05 session record.

**What the first 3C playtest found (2026-08-06):** four real bugs, not
balance noise — coagulants formed instantly at full lethality with zero
warning, a vein could flood mass right at the defended ring, ambient slime
speed read as too fast, and a 5–10fps stretch appeared during vein/
coagulant activity. All four addressed (Decisions 54–59); a fifth,
unrelated question — whether the browser itself was the ceiling — was
raised and answered no (Decision 60). A second playtest on the fixed build
read as promising but still fast at the very start, so both ambient growth
and coagulant speed were cut a second time (Decision 57's second half).

### ⚠️ Read this before writing any code

**Go phase by phase. Don't skip ahead.** Settled 2026-08-07:

> **Don't add answers that there are no questions for yet.**

**Phase 4 added the questions** (armor, penetration, range-vs-callus, the
whole maturity axis, the full coagulant roster). **Phase 5/6 add the
answers** (gems, extensions, 20 weapons) — and as of this session, **Phase
4 is complete**, so those answers finally have a settled threat model to
be authored against. Building them any earlier would have meant authoring
content against a target that kept moving, which §13 of the design record
warns against and which is the same ordering mistake Decision 36 argued
down once before.

The agreed direction is a **slime and arsenal rework** — the field becomes
the horde's economy, growth nodes are deleted and replaced by infection
events, coagulants become the threat, passives dissolve into a PoE-style
gem system, and the tier table is demoted to flavour. **All of Phase 3 and
Phase 4 are done and playtested.** Phase 4's gate was run by the project
owner on 2026-08-08 — *"I have played it, all good"* — so the full
coagulant roster, armour, and the scar ring are confirmed in real play,
not just through the debug harness. The design's own risk #4 (the scar
ring feeling oppressive) did not materialise.

**Start here, in order:**

1. **`docs/sessions/2026-08-05-slime-and-arsenal-rework.md`** — *what the
   game is.* The full design, the reasoning, the numbers, and §16 *"Ideas
   considered and rejected"*, which will save re-proposing something
   already tested and found broken. **§4 (the no-aim premise) is the one
   section to re-read even if you think you know it** — it was violated
   twice already and needed correcting both times.
2. **`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`** —
   *how it works.* The layer below: what a coagulant is in code, how
   formation is computed, how armor and the card pool are structured. Also
   has a rejected-ideas table.
3. **`docs/sessions/2026-08-07-xp-economy.md`**,
   **`2026-08-07-phase-4a-maturity.md`**, **`2026-08-07-phase-4c-wave2.md`**
   (4B has no separate session file — its plan,
   `docs/plans/phase-4b-two-axis-visuals.md`, carries the same
   reasoning) — the rest of this project's most productive single day:
   Phase 3D, 4A, 4B, and 4C, each with a real bug found only by running
   the game. Read these before trusting a new formula's first draft.
4. **`docs/DECISIONS.md` #23–#69** — the load-bearing calls in short form.
   23–37 are the design; 38–53 are the mechanism; 54–60 are the 3C
   playtest-and-fix round; 61–62 are Phase 3D; 63–65 are 4A; 66–67 are 4B;
   68–69 are 4C. #47–69 are implementation-time findings, not from a
   design session — see the notes at the top of each of those sections.
5. **`docs/BACKLOG.md`** *Now* section — Phase 5 (arsenal framework) is
   the concrete next step. Phase 3/4's own follow-ups (event tuning, the
   coagulant formation drain visual, more AoE weapons, spontaneous
   coagulation, behemoth timing) are in *Ideas* and *Bugs*.

**Everything remaining on the pre-rework bug list is absorbed by later
phases.** Don't fix any of it now; each sits inside a system being
replaced. BACKLOG lists the absorbing phase for each.

**Environment note:** `.nvmrc` pins Node 22.12.0, but the work machine is
running 24.19.0. `package.json` engines (`^20.19.0 || >=22.12.0`) permits
both and everything builds clean, but the two files disagree. Harmless
today; worth reconciling.

---

## Resuming on another machine

```bash
git pull
npm install
npm run test
npm run typecheck
npm run dev
```

All should be clean before starting new work. If `npm install` pulls a
different Node than `.nvmrc` expects, `nvm install` first.

One known environment quirk: the Vite dev server occasionally does an
unprompted full-page reload mid-session (shows up as a duplicate
`[vite] connecting/connected` pair in the console). It's a tooling
artifact, not a game bug — it has been observed repeatedly across
sessions and never correlated with anything in the code.

---

## Where things live

```
src/
  core/       camera + coordinate types (fixed 1920x1080 world, fit-to-window)
  grid/       density field, reaction-diffusion vein pattern, clearAt (the
              damage-the-field core function), slime layer canvas
  systems/    simulation: growth, infection events (vein/bloom lifecycle +
              geometry), coagulant formation (bounded flood-fill) and
              lifecycle (movement/arrival/death/collision), contact damage,
              frontier targeting, projectiles, gems, xp, particles,
              passives, tower, fx lifetimes
  weapons/    one module per weapon (behavior only — data lives in tuning/)
  render/     canvas draw calls, strictly separated from update logic
  tuning/     all numeric knobs: weapons, tiers, growth, events, coagulants,
              xp, geometry
  ui/         DOM/CSS HUD, upgrade cards, start/game-over overlays
  state.ts    the single central GameState + freshState()
  main.ts     game loop, run lifecycle, render order
```

**Conventions that matter:**
- One system per module; update logic and draw calls never mix.
- All game state lives in the one central object — no scattered mutable
  state.
- The simulation tick (growth, infection events, coagulants, frontier,
  contact damage) runs on a fixed timestep via an accumulator, decoupled
  from render framerate.
- Numeric tuning constants stay in `tuning/` so balance work is one
  directory, not a hunt through logic.

---

## Session log

*Newest first.*

### 2026-08-08 (latest) — Phase 5A: the weapon pipeline ships. Decision 70.

**Full account and audit trail:** `docs/plans/phase-5-6-arsenal.md` §13,
§14; `docs/DECISIONS.md` Decision 70.

**Before touching code:** a full re-read of every decision, session
record and plan, requested by the owner. Found six flags; the owner
settled three (Phase 4's gate had in fact been played — *"I have played
it, all good"*; Ward Pulse becomes Immolation Ring; the modal level-up
pause stays, judged at the Phase 5 gate) and three became work items
folded into 5A without needing a call.

**Shipped:** `weapons/pipeline.ts` — ready/acquire/deliver, with resolve
deliberately deferred (no gem needs it yet, and generalizing it now would
be exactly the over-built-abstraction risk the arsenal plan flags). All
seven weapons refactored onto it: the six existing plus **Immolation
Ring**, promoted from the `ward` passive — a weapon that had been
misclassified since the port, which is also why it never got a visual and
why its `clearAt` call never passed `coagulantMult`.

**Zero behaviour change, verified three ways:** the 23 pre-existing
weapon tests turned out to already be outcome tests and pass unmodified;
a live debug-harness run (Decision 59's methodology) confirmed all seven
weapons fire correctly over 60s at max level; the production bundle is
byte-identical in size to the pre-refactor build.

**Three balance gaps found and deliberately preserved, not fixed:**
Immolation Ring doesn't respond to Overclock, doesn't respond to
Amplifier, and never got Phase 4C-1's +50% damage pass — all inherited
from Ward Pulse never having been classified as a weapon when those
shipped. Pinned with a regression test, flagged in BACKLOG as an open
balance call for Phase 6B, not silently rolled into this refactor.

**The tower-centred radius guard now actually guards the weapons** — a
new test enumerates `bladeRadius`/`frostRadius`/`immolationRadius`
directly, closing the exact blind spot that let prototype bug #5 make
Orbiting Blades non-functional in every run while its own tests passed.

339/339 tests, typecheck clean, build clean.

**5B planned the same session:** `docs/plans/phase-5b-framework.md` —
enhancement pool, the socket ladder, card-pool restructuring (weapon-level
cards removed, extensions leveling 1→3 then permanently removed, core
gems on a separate track), and assist credit's plumbing built now against
the seven existing weapons so Phase 6's no-damage weapons have something
to plug into later. **Surfaced one real scope tension**, since weapon-socketed
gems are themselves Phase 6 content: a strictly-empty 5B pool risks being
untestable in the way that matters.

**All four open questions settled the same session.** 5B ships **thin** —
the five ported-passive core gems are real content so the loop is
judgeable end to end, while the weapon-gem side stays genuinely empty
until 6A. Core gems get a **guaranteed card slot on even-numbered
level-ups** (better than either option offered: a separate draw goes dead
once 3 sockets fill, a slot in *every* draw permanently spends a quarter
of the pool on defence). The **bundle card defers wholesale to 6A** —
with no real gems to bundle it would be a different and worse mechanic,
not a thin version of the right one. Unspent points get a HUD line, per
Decision 65's legibility rule.

**Known limit of the 5B gate, recorded up front:** with the weapon-gem
pool empty it can judge socketing, the core loop and the restructured
draw, but *not* specialise-vs-spread. A thin-feeling gate is expected
information, not a failure.

**Then the owner asked the UI/UX question** — when do the pre-game and
inventory screens get built, do weapons ship with visuals, and how do
weapons respond visually to gems and extensions. It produced the
session's sharpest finding.

**5A made gems O(1) in weapons for behaviour; nothing had done that for
rendering.** An audit found the render layer split down the middle —
`projectiles.ts` and `clouds.ts` are properly entity-driven (a new weapon
firing a projectile renders *free* today), while `orbitals.ts` hardcodes
Blades' ninja-star and `novaFx.ts` hardcodes Frost's colour **and holds a
single slot rather than a list**. That second one is a latent bug now,
not a hypothetical: Immolation Ring exists and is due its visual in 6B,
Shockwave lands the same batch, and either makes two pulses overwrite
each other. Both fixes land as **5B-6**, structure only, no new visuals.

**Every weapon and gem is now classified by visual cost** (arsenal plan
§9½): 43 free, 16 shared-modifier, 6 genuinely new — far from the 18 × 65
the question implied, because the entity-driven pattern already carries
most of it. *Trigger* turning out free is the best line in the table: it
fires the weapon below it at an impact point, so it draws whatever that
weapon already draws.

**That classification changed the phase order.** Four of the six
expensive transformative gems share rendering with a weapon, and the old
order shipped the gem first every time — Conversion before Antibody
Swarm's friendly units, Culture before Mycelium's tissue layer. **6E and
6F are swapped**: weapons establish the visual vocabulary, gems
generalise it.

**And a scheduling hole:** the deck defines the card pool from 5B on, but
the deck *builder* sat in Phase 7 — so through all of Phase 6 no weapon
pairing could be deliberately playtested, with 18 weapons, 3 slots and
random offers. A minimal pre-run select (list, checkboxes, start button —
no currency) is now **Phase 6-0**, and 5C builds its inventory from
components that screen reuses.

### 2026-08-07 — Arsenal design pass. **Draft, not decided.**

**No code.** The owner opened the arsenal discussion immediately after
Phase 4 closed, asking for ≥15 weapons with per-weapon upgradeable
attributes, weapon extensions, support gems (*"support gems can also add
abilities to weapons, or change their working way all together"*), and a
call on slot counts.

**Produced:** `docs/plans/phase-5-6-arsenal.md` — a full design covering
18 weapons, ~35 gems in six classes, slot/socket/point economics, a
coverage matrix against all 12 threats Phase 4 shipped, card-pool
dilution fixes, and a 5A–6F phasing.

**The load-bearing finding**, and the reason the design session was run
*before* the framework rather than after it as §17 scheduled: weapons are
currently six bespoke `updateXWeapon()` functions, and transformative
gems on that shape cost *N weapons × M gems* in hand-written special
cases — 144 at the catalogue's size. Phase 5A is therefore a **pure
pipeline refactor with zero behaviour change**, and it is the whole bet.

**Revision 2 (2026-08-08) after the owner's first review.** Approved:
sockets opened by enhancement points, all 18 weapons, no ceiling on
transformative gems. Changed on request: **one +/- per weapon** rather
than per-attribute allocation (better — it restores Decision 40's
legibility, and makes attribute *count* free, which is what lets Blades
have a fourth for blade count); the **Reach** gem cut as redundant with
Expansion; the gem list grown from 46 to **65**, with Noita's *Trigger*
and *Formation* added as the two most build-generating mechanics found in
the research.

**Revision 3 — the design is settled.** 23 calls closed in one pass. The
notable ones, and two where the owner's answer beat the options offered:

- **Extensions level to 3 and then leave the pool entirely** — no card, no
  drop, no trade ship. Kills the 2026-08-05 playtest's *"cards appear to
  do nothing"* finding at the root, since a plateaued card can never be
  offered, and a long run shrinks its own pool toward what it has not
  taken. Better than any of the three options presented.
- **Four cards per level-up, plus a bundle card every N levels** that
  offers a package rather than an atom — a pacing beat the level-up loop
  currently lacks, and a partial dilution answer.
- Gems do **not** level; the orbital trade ship becomes the outlet for
  dead ones (parked for 6/7). Core gems get **their own card track**.
  3 extensions per weapon. Starting kit **Bolt, Chain, Poison** — the
  three tactical roles rather than three delivery types. No weapon
  rarity. No level cap and no diminishing returns.
- Support weapons earn XP by **assist credit**; **Siphon converts at a
  loss** so Decision 42's two containers survive; **Penetration cannot
  push past Decision 44's armor floor**.

**No decision is superseded — zero, down from two in revision 1.** The
single-+/- model restored Decision 40's legibility clause and the
no-cap/no-DR call restored the rest, so socket-opening is a pure addition
and `CLAUDE.md`'s override protocol was never invoked.

**Still open: six items, all measurement rather than design** — point
totals per run, the bundle card's N, which 3 of each weapon's 4 candidate
extensions ship.

**Two risks carried into Phase 5 deliberately**, both recorded: pool
dilution ships unmitigated (all three fixes declined in favour of
measuring the real number, making the 5B gate a go/no-go on 65 gems), and
enhancement remains a slider by Decision 40's own accepted risk, with the
socket ladder as the only counterweight. **Assist credit is the largest
hidden implementation cost** and is scheduled into 5B for that reason.

**Nothing has been written into DECISIONS.md** — the 23 calls go in when
Phase 5 starts, so the record is written against work that happened.

### 2026-08-07 — Phase 4C: Coagulants Wave 2. **Phase 4 closes.**

**Planning + implementation, two sub-phases built back to back.** Full
record: **`docs/sessions/2026-08-07-phase-4c-wave2.md`**. Plans:
**`docs/plans/phase-4c1-wave2-armour.md`**,
**`docs/plans/phase-4c2-carrier-bulwark.md`**.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 4C-1 — Sclerotic/Blastoma identity, armor from maturity, bloom's maturity payload, `WEAPON_DAMAGE_SCALE`. Phase 4C-2 — Carrier (corridor identity + feeding), Bulwark (mass-shape identity + multi-part bodies), `coagulantSurfaceDist`/`coagulantOverlapArea` shared across `grid/clear.ts`, `systems/frontier.ts`, `systems/coagulants.ts` |

**Discussed**

- **4C was split before any code, along a real technical seam.** As
  scoped, 4C was bigger than 3C, which had needed its own
  playtest-and-fix round. 4C-1 (identity rules on existing mechanics) and
  4C-2 (Carrier/Bulwark, which need machinery the codebase didn't have)
  split cleanly, keeping the pair together as §10 requires.
- **The owner pre-authorized the whole arc in one instruction** — build
  4C-1, verify live, self-greenlight 4C-2 if it read clean, then report on
  the whole phase. Both sub-phases shipped in one sitting under that
  standing authorization.
- **Blastoma splits at 50% of starting mass, into two fragments deriving
  their own kind from their own mass** — not inherited, not hard-coded.
  The owner's "two little motes" was the fantasy, not a requirement:
  *"what I meant wasn't supposed to read like a hardcode, but more like an
  example... I agree with deriving it from the mass."* The owner also
  flagged a real future idea while agreeing — the project may eventually
  need something closer to a spawn table, or a merge of that with the
  pure-spark model, once the roster grows further. Explicitly not now;
  logged for whenever it's needed.
- **Two balance bugs, same debug-harness methodology as every phase since
  4A, neither visible any other way.** A bloom's own formation attempt
  fires at the *instant* peak begins, so only its 4-second active-phase
  window (not active+peak combined, which the first pass assumed) had
  accumulated maturity by the time it tried to spark itself — retuned
  ~4x. Separately, `MATURITY_SCLEROTIC_THRESHOLD` (0.55) was never reached
  in practice: formation reads *mean* maturity over a whole flood-filled
  footprint, which dilutes hard toward the region's average, so even
  cells that scarred past 0.9 individually never pushed a formation's
  *mean* past ~0.46 across a 500s run. Zero Sclerotics formed before
  either fix; roughly 5 of 8 active coagulants were Sclerotic after both.
- **Bulwark's "wide and flat, not round" body forced a real architecture
  decision**, since every existing damage/collision/targeting/render path
  assumed a circle. Modelled as a cluster of circles rather than true
  ellipse geometry — `radius` stays the bounding circle for every
  existing cheap reject, unchanged; `parts`, when populated, get
  narrow-phase treatment through two new shared primitives
  (`coagulantSurfaceDist`, `coagulantOverlapArea`). Reuses every piece of
  circle math already written and tested, at the accepted cost of a
  documented simplification (overlapping parts' damage isn't
  de-duplicated).

**Decided** — Decisions 68 (identity's third reading — mass shape;
Sclerotic and Blastoma; armor from maturity; the two threshold retunes)
and 69 (identity's fourth reading — corridor density; Carrier and
Bulwark; the cluster-of-circles body architecture). **Phase 4 is
complete.**

**Verified**: 337/337 tests passing (up from 286 — 51 new, mostly written
against invariants — identity function behaviour, conservation, geometry
— rather than magic numbers), typecheck and build clean, debug harness
removed both times. Verified live: after the two retunes, Sclerotics
formed regularly with correct armor and pale rendering; a 600s max-weapons
run produced 7 correctly-bodied Bulwarks (armor, 4 parts, a bounding
radius that actually enclosed every part) rendering as visually distinct
pale walls against round pink Behemoths; Carrier's mechanic is confirmed
correct by hand-calculated-geometry integration tests, though it did not
appear in either live run tested (plausible given how demanding the
corridor bar is — no dead corridor under max weapons, none under a weak
loadout either).

**Planned** — **Phase 5, the arsenal framework.** No blockers. One
open item for the project owner: 4C-2 has only been verified via the
debug harness, not yet played directly — worth a look before treating the
roster as fully settled.

### 2026-08-07 (later still) — Phase 4B: the two-axis visual system

**Planning + implementation.** Plan and as-built delta:
**`docs/plans/phase-4b-two-axis-visuals.md`**.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 4B — new `tuning/palette.ts`; two-axis composition in `grid/slimeLayer.ts`; frozen rim + transition-gated dirty marking in `grid/clear.ts` and `systems/growth.ts`; `BUCKET_COLORS` deleted; `render/coagulants.ts` resourced |

**Discussed**

- **Texture deferred to Phase 9, and not just for scheduling reasons.** §6
  wants mature ground "matte, fibrous, crystalline/plated." Real per-cell
  texture in Canvas 2D at 13px either multiplies draw calls (fighting the
  dirty-set discipline 4A had to respect) or needs pre-rendered variants
  per state, which is absurd at 20 states. The right implementation is a
  single full-screen noise pass masked by maturity — a different rendering
  architecture, and genuinely overhaul-scale. Owner agreed; colour alone
  delivers 4B's stated goal (*"the slime is readable by colours and
  states, and maturity and denseness can be told apart"*) and texture on
  top of a correct colour system later is purely additive.
- **The collapse bug turned out to be about *spacing*, not hues.** The old
  `BUCKET_COLORS` read as ~3 buckets because its steps were unevenly
  spaced, not because the colours were badly chosen. Moving density onto
  evenly-stepped alpha makes recollapse structurally impossible — and,
  unlike a hand-picked hex list, mechanically testable.
- **One genuine conflict with the design record, raised before building.**
  §6 says mature ground is *dark*; the owner said calcified should be
  white-ish. Flagged under the ground-truth protocol rather than silently
  picking — and the owner is right, for a reason §6 could not have known:
  **dark scarring rebuilds the exact bug 4A shipped with**, since 64% of
  scarred cells sit on cleared (black) ground. §7's tree-ring goal also
  requires scar legible on bare ground, and §6 itself calls the top tier
  "crystalline/plated," which reads pale. Recorded as a deliberate
  supersession (Decision 66).
- **`frozen` finally has a visual**, closing a bug open since Phase 2 — the
  precedent that forced 4A to ship a placeholder in the first place. Drawn
  as a rim rather than a fill so it can't compete with either axis, in
  Frost Nova's existing `#bfe9ff` rather than a fourth colour language.
- **The dirty-set rule got generalised into Decision 67.** Three
  applications now, each a different quantization shape: growth → 5
  buckets, maturity → 4 buckets, frozen → a boolean with only two
  transitions marking dirty. Worth stating as its own rule because the
  failure mode is quiet — correct output, gradually worse frame time — and
  the next field state wired into the render will need it too.
- **The plan's own test caught a defect before it reached the browser** —
  a first for this project. §4 specified bare-scar alphas up to 0.30 while
  §6 stated they must sit below the thinnest slime alpha (0.25); those
  contradict, and writing the test from the plan failed immediately on the
  plan's own numbers. Fixed the constants, not the test. The difference
  from 4A's five browser-only bugs is that this invariant was stated
  explicitly and was therefore mechanically checkable.

**Decided** — Decisions 66 (two-axis palette: density → alpha, maturity →
hue; calcified pale, superseding §6; bare scar below slime; frozen as a
rim) and 67 (anything feeding the rendered colour must be quantized and
mark dirty only on quantized change).

**Verified**: 286/286 tests passing (up from 273), typecheck and build
clean, debug harness removed. Verified live at 300s with maxed weapons:
maturity buckets `[12142, 538, 198, 22]` so the full range is reachable and
rendering, 1,153 frozen cells drawing their rim, no console errors. Owner
playtested and accepted: *"looks nice, I like the more colour gradient."*

**Planned** — **Phase 4C, Coagulants Wave 2.** One follow-up in BACKLOG
rather than fixed here: the owner's read that scarring may want a different
colour than the current clay/bone ramp. Cheap now that the palette is one
file.

### 2026-08-07 (later) — Phase 4A: the maturity field

**Planning + implementation.** Full record:
**`docs/sessions/2026-08-07-phase-4a-maturity.md`**. Plan and as-built
delta: **`docs/plans/phase-4a-maturity.md`**.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 4A — `tuning/maturity.ts`, `systems/maturity.ts`; `Grid.maturity`/`Grid.matBucket`; scar gain + yield multiplier in `grid/clear.ts`; threshold-relative ceiling and rate in `systems/growth.ts`; neon-green placeholder in `grid/slimeLayer.ts`; decay pass wired into `systems/tick.ts` |

**Discussed**

- **Scoping settled five questions before any code.** The load-bearing one:
  4A ships a **crude placeholder visual** rather than shipping blind,
  because a field state with no visual is precisely the `frozen` mistake —
  still an open bug two phases later — and without it neither party could
  playtest 4A at all. Also settled: virgin ground's ceiling drops below
  full (owner: *"undisturbed slime has no reason to harden, it never had to
  fight"*), events inject full-thickness slime regardless of maturity,
  bloom's maturity payload stays in **4C** (Decision 48 and
  `tuning/events.ts` both said 4A and were corrected), and every constant
  is tuned gently since §7's counters — penetration, range — don't exist
  until Phase 5.
- **Claude corrected its own framing mid-scoping.** The ceiling had been
  pitched as a kill-zone durability lever. It isn't: the kill zone is
  cleared constantly and never sits *at* its ceiling, so only undisturbed
  ground reaches one. It's really a **behemoth-size dial** (formation sums
  `growth` over its footprint) — fine, and incidentally a non-scripted
  lever on the behemoths-too-early problem deferred as Decision 62, but it
  needed saying honestly rather than being sold as something else.
- **§7 left one thing genuinely unspecified: how slow global ageing and
  passive scar decay coexist.** Naively they fight — decay pulls every cell
  to 0, age pushes it up, and the wilderness settles wherever the rates
  happen to cross. Resolved by making age a **floor** rather than a gain,
  so scarring pushes a cell above it and decay returns the cell *to* it.
  One scalar per tick, no per-cell age state.
- **Five defects, all found by running the game, none by the test suite —
  and three had passing tests written against the broken behaviour.** This
  is the session's real content:
  1. **The mechanic did nothing at all.** Max grid-wide maturity came back
     *exactly equal to the age floor* under every loadout. Decay ran flat
     every tick while scar gains arrive tiny and sparse (and a cleared cell
     goes quiet immediately — it drops below `threshold` and stops being a
     frontier target). Decay won by an order of magnitude. **The existing
     outcome test passed anyway, because it hit the same cell every single
     tick** — gain landing as often as decay always wins.
  2. **22% of the arena went permanently black** — the owner's playtest
     finding (*"top left area all black... it followed initial coral
     structure but never actually filled"*). `grid.threshold` runs to 0.94
     and `cellBucket` renders nothing while `growth <= threshold`, so an
     **absolute** 0.85 virgin ceiling made 2,876 cells unrevealable
     forever. Fixed by making the ceiling a fraction of each cell's
     headroom *above its own threshold* — impossible by construction rather
     than avoided by a lucky number (Decision 64).
  3. **Ambient growth was clawing density back down**, which would have
     silently undone every vein and bloom within a few ticks of landing.
  4. **Rate and ceiling cancelled each other out** — mature ground's larger
     headroom exactly offset its slower rate, measured *identical*,
     collapsing §7's "slower, to a higher ceiling" into "same speed."
  5. **The placeholder was invisible by construction**, not by tuning:
     scarring lives on cleared ground, which has no slime beneath it, so
     **64% of scarred cells were black drawn on black** (Decision 65).
- **The owner's Decision 59 harness methodology paid for itself a third
  time.** Every one of the five was diagnosed with the deterministic
  max-weapons/no-XP harness rather than hunted through real-time play.

**Decided** — Decisions 63 (maturity ships: scar gain, capped age floor,
three effects), 64 (threshold-relative ceiling, plus its two corollaries —
ambient only ever adds, and rate/ceiling stay independent levers), 65 (a
world-state placeholder must be legible against the *empty* background, not
just against the thing it overlays).

**Verified**: 273/273 tests passing (up from 241 — including replacements
for the three tests that had been passing against broken behaviour: the
scar test now leaves realistic gaps between hits, and the ceiling tests now
assert the invariant *every cell eventually crosses its own reveal
threshold* rather than convergence to a named constant). Typecheck and
build clean, debug harness removed. Verified live in-browser: map fills
edge to edge with **zero** permanently-stuck cells, and a green scar ring
visibly forms around the cleared combat zone.

**Planned** — **Phase 4B, the two-axis visual system.** No blockers. Note
the neon-green placeholder is deliberately temporary and 4B replaces it.

### 2026-08-07 — Phase 3D: the XP economy. **Phase 3 closes.**

**Implementation, with a short design pass at the front.** Full record:
**`docs/sessions/2026-08-07-xp-economy.md`**.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 3D — `tuning/xp.ts` (quadratic curve, 15% risk premium, shower constants), `grid/clear.ts` (coagulant-share tracking, shower routing), `systems/gems.ts` (`dropGemShower`, per-gem drift jitter), `state.ts` (`Gem.driftJitter`, fast-first-level shim removed) |

**Discussed**

- **The ordering question got settled permanently, and not the way the
  previous session left it.** Claude opened with a three-way fork (3D vs.
  4A/4B vs. jumping to the arsenal), since last session's docs pointed at
  Phase 5/6 while the plan of record said 3D. **The owner rejected the
  fork:** *"we shouldn't jump or skip phases, let's be linear, clear and
  focused. Let's not add answers that there are no questions for yet."*
  That second sentence is a better statement of the design principle than
  the design record's own §4 — **Phase 4 adds questions, Phases 5/6 add
  answers** — and it's now quoted at the top of this file. The owner also
  clarified that "we can't balance yet" had meant *scope* (weapon damage,
  slime speed, game feel — Phase 8 work), never *sequencing*.
- **The owner caught Claude reasoning as though the player aims.** Claude
  had described stacked level-up cards as landing "right when the arena is
  most dangerous" — a phrase that only carries weight if the player has
  moment-to-moment agency being denied. They don't; weapons fire and target
  themselves, and a modal pause interrupts nothing. Recorded at length in
  the session file because **the error recurred despite §4 existing
  specifically to prevent it**, which is the argument for keeping the
  premise written down rather than assumed. Restating the problem correctly
  is also what made its fix findable (below).
- **The curve's shape came with the owner's own reasoning attached:**
  *"balance the levels not by how much XP is given, but by how much XP is
  needed to level up."* This is load-bearing rather than stylistic —
  granted XP has to stay honest to destroyed mass or Decision 31's
  anti-farming guarantee collapses. Landed on quadratic
  (`12 + 6.5·L + 0.45·L²`), identical to the old linear curve at level 1
  so the intended early rush survives, ~2.3× its cost by level 20.
  Geometric was the alternative, rejected for hard-coupling the curve to
  one growth constant.
- **The risk premium landed at 15%, below the 25–50% Decision 31 floated
  and below Claude's own 25% recommendation.** The owner's instinct was
  right: the field-neglect farming failure mode gets worse the higher this
  goes, and the honest-grant rule above deliberately removes every
  alternative defence against it.
- **"One behemoth kill can cause 3 level ups" turned out to have its fix
  already sitting in the plan, unrecognised.** The curve alone can't solve
  it — at low level a threshold is ~19–30 XP against a behemoth paying
  hundreds. But §12's two separate notes (gem showers on big kills; gems
  stay physical and drifting) read together are a **rate limiter**: gems
  are the XP delivery mechanism and delivery takes time, so a shower
  arrives as a stream and the level-ups spread themselves. One refinement
  was genuinely needed on top — per-gem drift jitter, because a behemoth
  killed *at the perimeter* has no drift distance and would clump anyway,
  in exactly the case that matters most.
- **Behemoth timing was raised, pushed back on, and deferred.** The owner
  reported early-run behemoths as unstoppable; Claude flagged that a
  level/time gate contradicts Rule 4 (Decision 27), which makes coagulant
  size an emergent readout of player performance rather than a script, and
  offered the non-scripted levers instead. **Owner's call: defer until all
  the systems exist** — *"thank you for reminding and pushing back."*
  Decision 62. Recorded because the value is in the decision having been
  *tested* rather than quietly overwritten, which is what Decision 22
  exists for.

**Decided** — Decisions 61 (XP pacing lives on level cost, never grant
value; quadratic curve, 15% coagulant-only premium, showers as rate
limiter, no fast first level) and 62 (behemoth formation stays ungated,
question deferred).

**Verified**: 241/241 tests passing (up from 231 — 10 new covering the
curve's *shape* rather than its coefficients, the premium's coagulant-only
scope, and shower splitting/capping/conservation/jitter), typecheck and
build clean. **Playtested by the owner: "it plays much better now."**

**Planned** — **Phase 4A, the maturity field.** Phase 3 is closed. One new
item from the 3D playtest went to BACKLOG rather than being fixed here:
infection events fire too often at the start of a run.

### 2026-08-06 (post-3C playtest) — Pacing fixes, a lag investigation, and the browser-viability question

**Playtest response, on a different machine, picking up mid-rework.** The
project owner ran the game after 3C shipped and reported four specific
bugs from one sitting, then asked a fifth, larger question before any
fixing started: whether the browser itself was the wrong platform. Fixed
all four bugs, answered the platform question, then — after the owner's
own follow-up playtest on the fixed build — cut two more numbers a second
time. Kept dated 2026-08-06 at the owner's request, as a continuation of
the same gate rather than a new session.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | `state.ts` (`CoagulantPhase`), `systems/formation.ts` (distance gate, forming phase), `systems/coagulants.ts` (ring-perimeter `depositMass`, forming-phase gating in movement/arrival/`findCoagulantHit`), `systems/frontier.ts` (forming-phase skip), `systems/events.ts` (`veinTargetPoint`), `render/coagulants.ts` (rise/fade animation), `ui/hud.ts` (weapon tray DOM fix), `tuning/coagulants.ts` + `tuning/events.ts` + `tuning/growth.ts` (all the tuning changes below) |

**Discussed**

- **The playtest report, verbatim in substance:** slime speed needed
  cutting by "at least 40 percent"; the vein was good but shouldn't reach
  all the way to the core, since mass spawning right at the tower let a
  behemoth form and arrive almost instantly; the coagulation/telegraph
  stage needed to be both longer and slower ("big mass, slow movement");
  and vein/coagulation activity dropped the game to 5–10fps. **Diagnosis
  reframed the insta-death complaint**: it wasn't purely a speed problem —
  formation itself was instant, a full-mass full-speed coagulant
  materializing with zero warning frame. Fixed as its own thing (Decision
  54, the forming phase) rather than trying to solve it by tuning speed
  alone.
- **The lag chase kept losing to the pause button.** Level-up cards set
  `state.paused = true`, and granting max weapons via a debug hook
  generates enough clear activity to trigger a level-up almost
  immediately — so early attempts to reproduce the reported fps drop
  through ordinary play kept getting interrupted before anything
  conclusive built up. **The owner's redirect was the turning point:**
  *"write a specific test, remove level ups, give core all the weapons at
  max level... measure the performance of the whole coagulant and vein
  issue."* Built a temporary `window.__debug` bridge to do exactly that —
  deterministic reproduction instead of anecdote. Full findings in
  Decision 59; nothing from the harness shipped, it was removed once the
  investigation closed.
- **The lag investigation's honest conclusion is "probably not the game,"
  not "definitely not the game."** No instrumented system exceeded ~8ms
  even under an artificial worst case; the browser's own Long Task API
  recorded zero long tasks during a provoked 100+ms frame gap. One
  synthetic benchmark from earlier in the chase was itself wrong — it
  assumed a full-canvas clear that `flushDirtyCells` never actually does —
  and a corrected version reversed the conclusion (per-cell repaint is
  faster than batching at every realistic size). Communicated as an open
  uncertainty to the owner rather than oversold as solved.
- **"Can this game run on HTML... are we limiting ourselves too much?"**
  Asked directly after the lag report, with a standalone-engine port on
  the table as the alternative. Answered no, and explained why: the
  investigation found no evidence Canvas 2D was the actual bottleneck, the
  one real perf fix found (Decision 58) is an algorithmic fix that ports
  identically anywhere, and the procedural asset generation (density
  field, vein polylines, seed-circle blobs) is plain code with no art
  pipeline tying it to the browser specifically — porting would mean
  re-authoring the same generation logic against a different renderer's
  API for no measured gain. Full reasoning in Decision 60. **The owner's
  response, once reassured:** greenlit all seven identified fixes in one
  go, with an explicit standing instruction not to commit or push until
  they'd playtested locally themselves.
- **The second playtest (after all seven fixes landed) read as "nice,"
  but flagged the same axis again:** ambient/coagulant speed still felt
  too fast at the very start of a run. **The owner's framing mattered:**
  keep the existing time-based escalation curve exactly as it is, just
  halve where it starts — not a request to redesign the ramp, just to
  lower its floor. Implemented as a second, uniform halving of
  `AMBIENT_BASE`/`CREEP_RAMP` and the `COAGULANT_SPEED_K/MIN/MAX` trio,
  leaving `AMBIENT_ESCALATION` (the curve itself) and the inverse-sqrt
  mass-to-speed relationship (the other "curve") both untouched — see
  Decision 57 for why a uniform scale-down of the base is mathematically
  the same thing as "halve the start, keep the curve." **The owner also
  named the real ceiling on how far this iteration can go:** balance can't
  be honestly judged with only the starting weapon and no arsenal yet to
  build against — that's Phase 5/6 work, not more tuning here.

**Decided** — Decisions 54 (coagulant forming phase), 55 (formation
distance gate), 56 (vein stop-margin target point), 57 (both speed
halvings, and why the curves themselves were left alone), 58
(`depositMass` ring-perimeter walk), 59 (the debug-harness investigation
methodology and its findings, including the retracted batch-fill idea),
60 (staying on browser/Canvas 2D, no engine port).

**Verified**: 231/231 tests passing (up from 217 — 14 new: forming-phase
gating in `coagulants.test.ts` and `formation.test.ts`, the distance gate,
`coagulantSpeed`'s monotonic-and-floored shape, forming-skip in
`frontier.test.ts`, and the vein's stop-margin endpoint math in
`events.test.ts`), typecheck and build clean. Verified live in-browser
after the second speed cut (2026-08-07): a fresh run using only the
starting weapon plus organic level-up picks reached level 7 / t=1:29 with
core integrity still full, one coagulant already killed, and two more
active on screen without threatening the core — a materially different
outcome from the first playtest's early death on a comparable loadout.

**Planned** — No hard blocker. The honest next step, per the owner's own
diagnosis, is the arsenal (Phase 5/6) rather than another pacing pass —
pacing can't be tuned meaningfully against a one-weapon loadout. Until
then, further playtests of the current build are welcome but numbers
should be treated as a playability floor, not a target.

### 2026-08-06 (yet later) — Phase 3C: Coagulants Wave 1

**Implementation. The horde's identity change lands.** Owner asked for a
review-and-plan pass first ("reread docs... think about what we are about
to do, plan it out and if anything is unclear talk to me"); the review
surfaced four real gaps the written design hadn't covered, each resolved
with the owner before writing code; built the same session once greenlit.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 3C — `systems/formation.ts`, `systems/coagulants.ts`, `render/coagulants.ts`, `tuning/coagulants.ts`; coagulant damage/collision wired into `grid/clear.ts`, `systems/projectiles.ts`, `weapons/blades.ts`, `systems/frontier.ts`; XP value cap removed; vein rendering fixed |

**Discussed**

- **Decision 42's "no new mechanic, just the same formula" claim held only
  up to a scale factor the design never named.** Tracing the actual
  magnitudes: a level-1 bolt against a saturated-wilderness behemoth
  (~400–600 mass) would take *thousands* of hits. Claude's first proposal
  was a flat `COAGULANT_HIT_CELLS` constant. **The owner's counter was
  better:** different weapons already carry different hit radii
  (`radiusPx`), so scaling by actual **hit/body overlap area**
  (`circleOverlapArea`, `util/math.ts`) captures per-weapon character for
  free — a missile splash and a chain bolt's first hit land differently
  without a hand-tuned table, and it self-limits both directions (a huge
  AoE can't over-damage a tiny mote; a precise hit does precise damage to
  a huge target). The owner also asked for the multiplier to be
  per-weapon, not global, specifically so it could later become a support
  gem *or* an enhancement-point base stat — both hooks now exist
  (`COAGULANT_DAMAGE_SCALE` global, `WeaponDef.coagulantMult` per-weapon).
  See Decision 50.
- **Collision needed a pass the plan hadn't named at all.** Coagulants are
  entities, not grid cells, and four collision paths (bolt, chain, chain's
  hop search, blades) gate on `isRevealedIdx` — a coagulant sitting in
  already-cleared ground would be structurally untouchable by them.
  Caustic Cloud/Frost/Ward were free (they already route unconditionally
  through `clearAt`). Fixed with an explicit coagulant check alongside
  each grid check, and a side effect worth naming: Homing Missile's homing
  — degraded to a fixed point back in 3A when nodes were removed — came
  back for free once `nearestFrontierPoint` started returning coagulant
  surfaces (Decision 45), with zero missile-specific code.
- **The owner's fix for arrival's mass-evaporation problem was better than
  Claude's.** Claude had planned to weaken the conservation invariant to
  "mass is never *created*" because the perimeter disc (~150 cells) can't
  hold a large arrival at `growth` capped at 1. The owner's proposal —
  spill the deposit outward ring by ring until it all fits — keeps the
  invariant *exact* instead, and reads better besides: a behemoth's
  arrival becomes a genuinely large, arena-visible mess rather than
  politely fitting inside the ring. See Decision 51.
- **Pulling 3D's XP cap removal forward was agreed in the same planning
  pass** — reading the 3C playtest gate through the still-capped
  `gemValueFromRemoved` (`clamp(…, 0, 10)`) would have made a 20-second
  behemoth kill pay the same as a routine bolt hit, actively misleading
  the gate it exists to inform. The rest of Decision 31 (superlinear
  curve, showers, risk premium) stayed in 3D as originally planned.
- **Two bugs surfaced only by playing the running game, not by the test
  suite** — worth recording as a reminder of the category, not just the
  fixes. The formation flood-fill's radius cap used a cheap Chebyshev
  (square) bound; every mass-summing unit test passed, because a test
  asserting a number can't see the *shape* of what produced it. In the
  browser, a coagulant forming against a saturated field left a crisp
  square crater on screen. Fixed to true circular distance (Decision 52).
  Separately, folded in per the owner's request from the 3B follow-up
  ("veins are very round at the points... should end in small points like
  lightning"): 3B's vein stroked every segment as its own subpath, so
  `lineCap: 'round'` beaded every joint. Fixed to one continuous path for
  the trunk plus tapered per-segment strokes for branches (Decision 53).
- **The kill counter and Homing Missile's targeting**, both left dormant
  in 3A with an explicit promise to close them out here, both closed:
  `nodesPurged` now increments in `splatterOnDeath`; missile targeting
  fixed itself via the frontier change above.

**Decided** — Decisions 50 (overlap-area coagulant damage, two dials), 51
(arrival deposit spills outward, exact conservation), 52 (circular flood-
fill bound), 53 (vein rendering: continuous trunk, tapered branches).

**Verified**: 217/217 tests passing (up from 165 — new `formation.test.ts`
and `coagulants.test.ts`, extensions to six existing files), typecheck and
build clean (63 modules bundled). Verified live in-browser across several
runs: watched coagulants form out of both vein and bloom peaks with an
organically-shaped crater (post-fix), walk toward the core, and take
damage from Bolt/Chain/Missile; one run ended in a core death from an
early arrival at 00:35 — a legitimate first-pass balance outcome given
these are placeholder numbers, not a bug, and confirmed via a clean
"Core Overwhelmed" flow with no console errors. No errors in any run
beyond the documented Vite self-reload quirk.

**Planned** — **The Phase 3C playtest gate.** This is not Claude's call to
clear — it needs the project owner actually playing the game. Per
BACKLOG: watch whether a behemoth crossing the arena reads as dramatic or
tedious, whether the conservation rules feel right (motes shouldn't chain
into behemoths), and tune arrival speed/mass by feel — the two agreed
dials. Nothing past this gate (3D's remainder, 4A) should start before it
closes.

### 2026-08-06 (still later) — Phase 3B: Infection Events

**Implementation, on a new machine picking up mid-rework.** Reviewed
against the actual codebase before starting — the owner explicitly asked
for a review-and-report pass first, greenlit only after two open questions
were resolved. Built the same session.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 3B — `systems/events.ts`, `systems/veinPath.ts`, `tuning/events.ts`, `render/events.ts`; `InfectionEvent`/`VeinInfectionEvent`/`BloomInfectionEvent`/`VeinSegment`/`VeinBranch` types; wired into `tick.ts` and `main.ts` |

**Discussed**

- **The pre-build review found the phase plan understated bloom's
  situation, the same way 3A's review had understated the tier table's.**
  Bloom's actual job — accelerating maturity — doesn't exist until Phase
  4A, so building it in 3B alone would ship a lifecycle and visual with
  almost no mechanical effect. Flagged as a real decision rather than
  proceeding on the plan's one-line description. **Owner's call: build it
  anyway**, to keep the event framework as one lifecycle with two variants
  from the start rather than bolting bloom on later. Recorded as Decision
  48.
- **The review also caught that "reuses the existing `veinField`
  pattern" — one line in the 2026-08-05 plan — didn't actually check out.**
  The field is a static texture consumed only as a threshold map; it has
  no traceable edge-to-core routes to reuse. The owner's own read, offered
  before seeing Claude's independent finding: probably a remnant of an
  idea that got bounced around early and never developed. Agreed to build
  a generated branching polyline (the standard lightning-bolt construction
  — recursive midpoint displacement) instead, which cannot fail to reach
  the core the way a maze-constrained route could. Recorded as Decision
  49.
- **Genuine pathfinding through the coral maze was the owner's original
  instinct** ("the infection follows its own veins... if not adding it
  today definitely add to the todo list"). Not built now — no guaranteed
  route exists at every spawn angle — but recorded in BACKLOG as an idea,
  along with a cheaper middle ground (bias the polyline's displacement
  toward the coral pattern rather than true pathfinding).
- **The branching lattice a jagged polyline produces turned out to matter
  beyond looks.** Wave 2's Blastoma coagulant (§10 of the 2026-08-05
  record) is specified to form where a vein has "webbed" through an area —
  branches forking off the trunk produce exactly that shape as a side
  effect, so 4C inherits it for free rather than needing its own system.

**Decided** — Decisions 48 (bloom ships now) and 49 (vein geometry is a
generated polyline, not a `veinField` reuse).

**Verified**: 164/164 tests passing (up from 136 — 6 new for the vein
polyline's geometry invariants in isolation, 22 for event lifecycle,
growth injection, and spawn scheduling), typecheck and build clean (59
modules, up from 53). Verified live in-browser across two full runs:
watched a vein telegraph faintly, activate, visibly extend inward with
branches, and inject growth that reads as the vein's own shape in the
slime layer; watched a bloom telegraph as a pulsing ring and inject a
visible radial bump of denser slime. No console errors in either run
beyond the documented Vite self-reload quirk. One bug caught and fixed
before it shipped: a copy-paste slip in `render/events.ts`'s bloom
active-phase ramp divided by `event.radius` instead of the active
duration — caught on self-review immediately after writing it, before any
test or manual check.

**Also fixed in passing:** the "Where things live" module tree in this
file's own *Where things live* section still listed `nodes` under
`systems/` and `tuning/` — missed during 3A's own docs pass. Corrected
alongside 3B's addition of `events`/`veinPath`.

**Planned** — **Phase 3C, Coagulants Wave 1**, next. This is the phase
carrying the project's one real technical unknown (bounded flood-fill
formation, Decision 43) — the mechanism session should be read in full
before starting, not just skimmed for the numbers. No blockers.

### 2026-08-06 (later) — Phase 3A: the teardown

**Implementation. The rework's first code lands.** Reviewed against the
actual codebase before starting (see the mechanism session below for the
review); greenlit by the project owner; built the same session.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Phase 3A — nodes deleted, `safeRadius` → `perimeter` (fixed constant), `TIERS_LIST` demoted to flavour, ambient/contact decoupled from tiers |

**Discussed**

- **The review before building found the plan understated its own
  scope.** `TIERS_LIST` carried four mechanical values (`safeRadius`,
  `nodeInterval`, `infectionMult`, `contactMult`), not the one the written
  plan named. Stripping all four with nothing to replace three of them
  would have left the game with **zero escalation** for three phases
  (3B/3C/4A) before events, coagulants, and maturity exist to take over —
  correct per Decision 33's letter, wrong in effect.
- **The fix, confirmed against the 2026-08-05 record before proposing
  it:** §15 already lists "ambient rate" as one of five organic escalation
  axes that survive the rework. So `infectionMult` was never meant to die
  with the tier table — it becomes its own time-driven curve. `contactMult`
  goes the other way and is retired outright, folded into the existing
  `CONTACT_SCALE` constant, because Decision 24 already establishes contact
  damage as "the clock, not the executioner" — it isn't supposed to escalate
  on a timer at all once Rule 3 (arrival splatter) exists to do that job.
  Recorded as Decision 47.
- **Three smaller gaps the plan didn't mention**, surfaced during review
  and accepted by the owner before starting: Homing Missile loses its only
  moving target and degrades to firing at a fixed frontier point (the
  owner: "okay, not a big deal" — restoring it is a small follow-up once
  3C exists, not a rewrite); the kill counter (`nodesPurged`) goes dormant
  rather than being renamed or removed (owner: "left alone... until we get
  to coagulants"); the start-overlay blurb needed rewriting since it was
  the only place a player learned what nodes were.
- **The game is honestly thinner right now than before this session**,
  and that's correct for a teardown, not a regression to worry about. No
  playtest verdict is expected until the 3C gate.

**Decided** — Decision 47 (ambient/contact decoupling, found and agreed
mid-implementation, not in either prior session record).

**Verified**: 136/136 tests passing (153 → 136: `nodes.test.ts` removed
outright, six other files lost node-dependent cases), typecheck clean,
production build clean (55 modules bundled; 56 → 53 non-test files under
`src/`, net of the three node modules deleted). Also verified live in the
browser, not just by test suite — started a run,
watched ambient growth and the bolt weapon operate against the fixed
perimeter with no console errors, leveled up twice, and confirmed Homing
Missile's card text no longer mentions nodes (`"Homes onto the nearest
wall and explodes."`) now that the string itself was fixed as part of the
sweep for stray references.

**Planned** — **Phase 3B, Infection Events**, next. No blockers.

### 2026-08-06 — The mechanism session

**Design session. No game code written.** Full record:
**`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`**.

Picked up on the other machine. The previous session settled *what the game
is* and deliberately left *how it works* open, naming coagulant formation
as the project's one real technical unknown. This session closed that layer
and every remaining open question.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Docs only — session record, Decisions 38–46, backlog updates, 3A unblocked |

**Discussed**

- **The owner described the arsenal in their own words** and it matched
  §13 almost exactly, which was itself useful confirmation. Two things fell
  out of the comparison: it implicitly confirmed that currency buys
  **unlocks only** (Decision 39, previously recommended-but-unconfirmed),
  and it quietly **dropped weapon levels from the card pool**.
- **Weapon levels leaving the pool is a real improvement, not a
  simplification.** Every card becomes a build decision instead of a
  treadmill step, and it kills the "cards appear to do nothing" bug at the
  root — that bug was caused by *level* card descriptions specifically. The
  hole it opens (no guaranteed payout) is filled by the owner's
  **enhancement points** proposal, whose best feature is the +/-: mid-run
  respec, which suits a game whose threat model shifts across a run.
- **Claude proposed making gem bundles the deck unit; the owner rejected
  it and was right.** Bounding the pool that way would make combinations
  you didn't foresee at deck time unreachable, and emergent mid-run builds
  are the better game. Gems are universally live once unlocked; bundles are
  a purchase and a theme, not a slot.
- **An audit of "decided vs. discussed" on coagulant formation** found the
  design complete and the mechanism entirely untouched. That framing is
  what made the rest of the session productive — the gap was specific and
  nameable rather than a vague unease.
- **The formation-algorithm risk was overstated.** Grounded against real
  numbers (150 × 86 = 12,900 cells, formation on discrete event moments
  rather than per tick), the frame budget was never the constraint. The
  actual problem is that an unbounded flood-fill returns the whole
  saturated wilderness as one region — a design problem wearing an
  algorithm costume. Fixed by a radius cap, which is where the design
  turned out to live.
- **A misunderstanding worth recording:** the coarse density index was
  initially read as downsizing the simulation grid, and the owner objected
  that the dense grid is what makes the slime read as *liquid*. Correct
  objection, wrong target — the index is a separate read-only side array,
  never rendered, never simulated from. The grid does not change. Written
  into Decision 43 explicitly so it can't be misread again.
- **The best outcome of the session is Decision 42**, "one mass, two
  containers." A coagulant has no HP; `mass` *is* its hit points, arrival
  damage and XP value, and it's damaged by the existing `clearAt` formula
  because a coagulant is just very dense slime that walks. Three of the
  four conservation rules stop needing enforcement and become consequences
  of the data model.
- **Armor as flat reduction rather than percentage** turns "many small hits
  vs. one big hit" into a real build question, makes a Penetration gem
  load-bearing, and incidentally corrects the Blades gem-printer problem
  without touching a number.

**Decided** — Decisions 38–46. The perimeter question that blocked 3A is
answered (fixed), and every other open question from 2026-08-05 is closed
except the two deliberately deferred (`frozen`'s fate → Phase 5; whether
calcified tissue blocks projectiles → prototype in Phase 4).

**New backlog items** — spontaneous coagulation as a guarded anti-boredom
floor, the "orbital trade ship" for buying specific gems with score points,
and pool-filtering as the fallback if gem dilution bites.

**Planned** — **Phase 3A, ready to build, no blockers.** Then 3B events,
then 3C coagulants. 3C should write the mass-conservation invariant test
first; it catches every economy bug in one assertion.

### 2026-08-05 (evening) — First playtest, and the design rework

**Design session. No game code written.** Full record:
**`docs/sessions/2026-08-05-slime-and-arsenal-rework.md`**.

**Shipped**

| Commit | What |
|---|---|
| *(this one)* | Docs only — session record, Decisions 23–37, backlog restructure |

**Discussed**

- **The playtest redirected the project.** The owner reached the tier
  before Apocalypse untroubled and was expanding the cleared circle by the
  end. Formula-level analysis found why, and it isn't a tuning problem:
  **player power scales 17–21× over a run against the infection's 3.1×**,
  and the composition is worse than the ratio — the player's axes multiply
  (level × count × Amplifier × Overclock × six weapons stacking) while the
  infection's add and then stop. Balance moved to Phase 8.
- **The framing correction that reshaped everything: the player cannot
  aim.** This is an autoshooter — a PoE character standing still against a
  charging horde. Several ideas from the first brainstorm died on it. The
  useful consequence: in a no-aim game the slime's job isn't to create
  tactical decisions but to *test the build*, so **each distinct slime
  behaviour is a question the build has to answer.** One behaviour, one
  question, one viable build — which is exactly the game that was
  playtested.
- **The field becomes the horde's economy** rather than the threat itself.
  Refined mid-session from "clear the field to starve the horde" (wrong —
  the wilderness reservoir is unreachable) to **"field control sets spawn
  *distance*, not spawn rate."**
- **Maturity was worked hardest and the first proposal was wrong.**
  Age-based hardening breaks because weapons target `nearestFrontierPoint`,
  so ~70% of the arena is *structurally* unreachable and would calcify
  permanently by minute three. Inverted to scar-based: **the battlefield
  hardens, the wilderness stays soft.** A capped slow-age term was added
  back at the owner's request.
- **The wilderness reservoir problem**, raised by the owner, forced the
  events-as-trigger rule. Arithmetic: the wilderness is 76% of the arena
  and saturates in ~46s, so mass-triggered coagulation gives infinite
  behemoths from minute one. Local depletion alone still permits roughly
  one behemoth every four seconds.
- **Nodes are deleted.** Diagnosed as feeling bad for three separate
  reasons — arbitrary targeting (`find()` picks the first node in array
  order), a stealth DPS tax on two specific cards, and a discrete HP-bar
  mob in a game whose identity is a continuous field.
- **Rejected ideas are catalogued** in the session record §16 so they
  aren't re-proposed: player-authored scar terrain, splatter-as-penalty-
  for-killing, unkillable-boss endgame, currency from slime killed, more
  density buckets as the legibility fix, and several more.

**Decided** — Decisions 23–37, and Decision 13 marked superseded.

**Playtest bug findings** — card descriptions that read as "this does
nothing" (not the pool filter, which works; static `desc` strings plus
count formulas that plateau below their caps), Ward Pulse with no visual
at all, frozen cells with no visual at all, the density palette collapsing
5 buckets into ~3. All absorbed by the rework; see BACKLOG for the
phase that owns each.

**Planned** — Phase 3A teardown, **blocked on one open question**: what
drives the perimeter once tiers carry no mechanical weight? See *Active
plan* below.

### 2026-08-05 — Phase 2B through port completion

The long one. Started with the project at Phase 2A (grid +
reaction-diffusion only, nothing playable) and ended with the full game
ported. Spanned a usage-limit break; work resumed cleanly from this
document, which is the main evidence that the handoff format works.

**Shipped**

| Commit | What |
|---|---|
| `d6684d9` | 2B — ambient growth + fixed-timestep simulation tick |
| `c785fbd` | 2C — first playable loop: Bolt Turret, XP, gems, upgrade cards, HUD |
| `6b8898c` | 2D — danger: contact damage, growth nodes, game over/restart |
| `a8d42bd` | Safe-zone decisions + 2E plan (docs) |
| `081e07a` | 2E-1 — safe-zone rework |
| `3b6bd07` | 2E-2a — Orbiting Blades |
| `153e128` | 2E-2b — Chain Bolt |
| `69ee53a` | 2E-2c — Frost Nova |
| `b347c28` | 2E-2d — Caustic Cloud |
| `e6c679d` | 2E-2e — Homing Missile (port complete) |
| `bba3807` | Mark 2E done |

Tests went 40 → 153 across the session.

**Discussed**

- **Reviewing each phase plan before building it** became the working
  rhythm, and repeatedly paid off. Every review found real scope the
  one-line plan had understated — 2C was missing particles and gem
  visuals, 2D was missing node rendering and three passives, 2E was
  missing orbital rendering and a targeting helper.
- **Weapon signature visuals are not polish.** This came up three times
  (gem diamonds, node gold pulse, then chain arcs / cloud bubbles / nova
  ring) before being generalized: a weapon without its visual reads as
  broken even when the damage is correct, so a playtest of it is
  worthless. This eventually dissolved Phase 2F entirely — every item in
  it belonged to a weapon in 2E.
- **The safe zone was the biggest design conversation.** The owner
  observed the infection never seemed able to reach the core. Verified:
  ambient growth was hard-gated at `safeRadius`, so the dashed ring the
  player saw and the ring that actually damaged them were *different
  rings*, and the core could only ever be reached by growth nodes.
  Confirmed as unintended prototype behavior rather than a design choice.
  Also found that Orbiting Blades orbited at 64-78px while the smallest
  safe radius ever reached was 95 — **the weapon could not hit ambient
  infection at any tier or level, in any run.**
- **Damping curve options were worked through numerically**, not guessed.
  A naive "multiply growth by a damping factor inside the line" doesn't
  work, because the outside ramp is already exactly 0 at the boundary —
  the two formulas can't share a root. Squared damping was computed and
  rejected (≈1900s to visible growth near the core — effectively never).
  Linear landed at ≈110s for an undefended core.
- **Ground-truth override protocol.** Superseding documented prototype
  bug #2 prompted a standing rule: the prototype and its handoff doc
  don't get overridden without asking the owner first, even when the
  reasoning is solid. Added to `CLAUDE.md`.
- **Process correction:** at one point work began on approved-but-not-
  green-lit changes. The owner drew a clear line — answering a scoping
  question is not the same as saying go. Nothing was committed, and the
  work was retained by explicit choice, but the boundary now holds.

**Decided** — Decisions 1-21 (see `docs/DECISIONS.md`). The load-bearing
ones from this session:

- One shared weapon-data library rather than one file per weapon (1)
- Phase 2F dissolved into 2E; each weapon ships with its visual (11)
- One commit per weapon (12)
- Balance pass follows the port, before any other backlog work (13)
- The whole safe-zone cluster: shrunk tier table, ambient creep with node
  bypass, anchor-as-floor weapon reach, depth-weighted contact damage,
  reactive danger ring, bug #2 superseded (14-20)

**Planned**

1. Balance + playtesting pass (Decision 13) — the immediate next step.
2. Documentation restructure (Decision 21) — *done at the end of this
   session; this file is the result.*
3. Then the open backlog: endless-scaling difficulty tail, the
   per-variable weapon upgrade-tier system, audio, leaderboard.

**Playtest findings from this session**

- The first real playtest (before 2D) found upgrade picks gave no visible
  confirmation — a pick applied correctly but nothing on screen changed,
  so it read as broken. Fixed by the modifier readout (`DMG 1.00x SPD
  1.09x …`), built as part of 2D specifically because 2D introduced the
  three least-visible passives in the game.
- A forced game-over test (weapon disabled, growth and contact damage
  temporarily cranked, all reverted) confirmed the death → game over →
  restart → fresh-maze cycle across four runs. This closed a gap that had
  been explicitly flagged rather than assumed: the normal playtest build
  was too tanky to actually die.

### 2026-08-04 — Project setup through Phase 2A

Predates the detailed session-log format; reconstructed from commits.

**Shipped**

| Commit | What |
|---|---|
| `0c48820` | Initial commit — prototype + handoff docs |
| `ce4eca0` | Phase 0 — Vite + TypeScript + Vitest scaffold, Pages base path |
| `60212ac` | Phase 1 — world/camera architecture, typed GameState, core rendering |
| `d8d535e` | Phase 2A — reaction-diffusion vein field |

**Notable decisions from this period** (see `docs/DECISIONS.md`): the
fixed 1920x1080 world with a fit-to-window camera, replacing the
prototype's window-sized grid — so every player gets an identical arena
regardless of monitor, and resizing changes only camera scale, never the
simulation.

The reaction-diffusion step is guarded by a canary test proving the suite
would actually catch a divergence-to-NaN regression, rather than passing
vacuously. That bug produces a silently blank field with no thrown error,
so it's worth the extra care.

---

## Active plan

**In progress: Phase 5, the arsenal framework. Phase 3 and Phase 4 are
both complete, and 5A has shipped.** 3A/3B/3C shipped 2026-08-06 (plus a
playtest-and-fix round), 3D/4A/4B/4C-1/4C-2 all on 2026-08-07, 5A on
2026-08-08 — see the *Session log* above. Read the session records before
assuming a new formula's first draft is right; every phase so far has
found at least one real bug only by running the game.

**Go linearly — this just closed out.** Phase 4 was the *questions* (armor,
penetration, range-vs-callus, the full coagulant roster); Phase 5/6 are
the *answers*, and now have a settled threat model to be authored against.
Content authored before that model existed would have been the ordering
mistake §13 and Decision 36 both warn about — which is exactly why 4C
wasn't skipped or compressed despite the temptation to jump ahead.

The design is settled end to end and so is the mechanism, all the way
through the horde's complete threat model. Full detail in the 2026-08-05
record §17; the concrete next step is in `docs/BACKLOG.md`'s *Now* section.

| Phase | Content |
|---|---|
| **3A** | ✅ Delete nodes · rename `safeRadius` → `perimeter` (now a fixed constant) · demote `TIERS_LIST` to flavour |
| **3B** | ✅ Infection Events — vein (acts on density) + bloom (acts on maturity), full lifecycle |
| **3C** | ✅ Coagulants Wave 1 — conservation rules, Mote/Congealer/Behemoth. Playtest-and-fix round done (Decisions 54–60). |
| **3D** | ✅ XP economy — quadratic level curve, 15% coagulant risk premium, gem showers as rate limiter (Decision 61). Playtested: *"plays much better now."* |
| **4A** | ✅ Maturity field — scar accumulation, capped age floor, decay; clear-resistance, regrowth-rate and threshold-relative ceiling effects (Decisions 63–65). |
| **4B** | ✅ Two-axis visuals — density → alpha, maturity → colour; palette collapse fixed, `frozen` finally visible (Decisions 66–67). Texture deferred to Phase 9. |
| **4C-1** | ✅ Sclerotic, Blastoma, armour from maturity, bloom's maturity payload, +50% weapon damage (Decision 68). |
| **4C-2** | ✅ Carrier (corridor identity + feeding), Bulwark (multi-part body, the pair §10 requires) (Decision 69). **Phase 4 complete.** |
| **5A-0/5A** | ✅ The weapon pipeline (Decision 70) — all seven weapons refactored onto ready/acquire/deliver, zero behaviour change, Ward Pulse promoted to Immolation Ring. |
| **5B** | Enhancement points, sockets, gem inventory, assist credit → **next up** |
| **5C** | Pause + inventory UI |
| **6** | Arsenal content — 18 weapons, 65 gems. **Design session done** (`docs/plans/phase-5-6-arsenal.md`, revision 3) — implementation in batches per §13. |
| **7** | Meta — currency, unlocks, deck builder |
| **8** | Terminal phase · real balance pass · leaderboard |
| **9** | VFX and feel |

**Why maturity comes after the horde and not before it:** Wave 1
coagulants are pure density readings and need no maturity at all. Building
the terrain layer first would block the single most important playtest
behind the largest visual system (Decision 36).

### Open questions for the project owner

**None blocking.** The two that blocked or shadowed 3A were answered on
2026-08-06 — the perimeter is fixed (Decision 38) and meta-currency buys
unlocks only (Decision 39). Two remain, both deliberately deferred:

**1. What happens to `frozen`?** Frost's growth-suppression probably
becomes a gem effect rather than a weapon-specific mechanic. Phase 5. (Its
*visual* half is done as of 4B — a `#bfe9ff` rim, Decision 66 — but what
the mechanic becomes is still open.)

**2. ~~Does calcified tissue block projectiles?~~** Scoped **out of 4C** by
the project owner on 2026-08-07 and moved to `docs/BACKLOG.md`'s *Ideas*
section, where the full reasoning now lives. Still unanswered and still the
riskiest single item in the design, but it is no longer shadowing a phase —
its natural home is the 4C playtest gate or Phase 5, once penetration
exists as a real counter.

### Deferred to their own design pass

- **Phase 6 gets a full arsenal design session** before implementation —
  the weapon/extension/gem catalogue, authored against a settled threat
  model.
- **The "orbital trade ship"** (buying specific gems with score points)
  needs its own pass on what score points are and whether they compete
  with meta-currency. Phase 6/7. See BACKLOG.
- **Spontaneous coagulation** — revisit after the 3C playtest, when it's
  clear whether dead air is actually a problem. See BACKLOG.
- **Coral-biased vein geometry** — blending the vein's polyline
  displacement with the field's own coral pattern, raised by the owner
  during the 3B review. Not blocking; revisit whenever the vein's current
  look feels too generic. See BACKLOG.
