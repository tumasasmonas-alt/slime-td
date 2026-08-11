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

**Last updated:** 2026-08-11 (**Phase 6D-3 partially shipped** —
Decision 92: Steps 1–3 of the gem-reality fix. Fork/Chaining/Bounce/
Ricochet now have real, weapon-appropriate readings on every weapon
they're legal on (previously Bolt Turret alone), and `clearAt` returns a
richer `ClearResult` (mass removed, coagulants touched/killed) that made
those readings possible. **Steps 4 and 5 are unbuilt** — Multishot/
Formation's unconditional damage division (still a zero on Blades, a
downgrade on Frost) is the one defect from the original audit not yet
fixed, and the gem-copy/test-matrix/doc cleanup pass hasn't run. Cut here
by the same weekly-limit constraint as the batches below; a clean
stopping point, not an interrupted one — everything shipped is tested
green. **888 tests pass, `tsc --noEmit` clean.** Full detail:
`docs/plans/phase-6d3-gem-reality.md` §10, Decision 92.

**▶ MACHINE HANDOFF — pick up here.** Next session should start at
`phase-6d3-gem-reality.md` §8 step 5 (the `plan.count` divisor in
`blades.ts`/`frost.ts`/every weapon that reads `emissionPlan()`) — read
§5's table and §9's risk note (the renderer, not the damage-rule logic,
is the part likeliest to run long) before starting. A playtest is still
owed on top of this — see the entry below, unchanged by this session's
work since 6D-3 doesn't touch balance numbers.

**Previously:** 2026-08-11 (**Phase 6D-2 shipped** — Decisions 90–91:
the 9 Conditional gems, all RESOLVE-stage damage multipliers/debuffs on
`ClearOptions`, legal on every weapon (no refusal table). **A real bug
found and fixed during implementation, not by the browser** — six of ten
weapons (everything whose damage travels via an entity: projectiles,
clouds, the Shockwave ring) would have shipped every Conditional gem
silently inert, because each entity's impact-time `clearAt` call read a
hardcoded field whitelist that predated this batch and never learned the
nine new fields. Caught writing the batch's own "no gem is a silent
no-op" test as an actual spawn-to-impact test. Fixed by centralizing the
fields into one shared interface and forwarding them at all four
consuming call sites — see Decision 91. **Built immediately after 6D-0
and 6D-1 in the same session, at the owner's explicit instruction,
typecheck + `vitest run` only — no live playtest across any of the three
batches**, continuing the departure Decisions 88/89 recorded. **828 tests
pass, `tsc --noEmit` clean.**

**6D-0/6D-1/6D-2 shipped this session; 6D-3 was picked up in the very next
session (above) rather than the playtest option — see that entry for why
and what's still owed.** Full session account:
`docs/sessions/2026-08-11-phase-6d-batches.md`. Read Decision 91 before
adding any new `ClearOptions` field — this session's one serious bug was
a field that reached each weapon's spawned entity correctly and was then
silently dropped at impact by three consumers with hardcoded field lists,
invisible to both typecheck and 823 passing tests.

**Previously:** 2026-08-11, **Phase 6D-1 shipped** — Decision 89: the 7
Targeting gems, each replacing a weapon's ACQUIRE stage via a new
dispatch layer, `systems/targetingGems.ts`. Two deviations from the plan
found while implementing — Vigilance also refuses `orbital` (Blades),
and Breach Priority's aura reading is a focus-damage bonus rather than a
literal inner-edge pull — both recorded in Decision 89 and the plan's own
as-built delta.

**Before that:** 2026-08-11, **Phase 6D-0 shipped** — Decision 88: the
balance-shape tuning pass. Unbounded ambient/event escalation, the aura
reach fix for Blades/Frost/Immolation, Chain Bolt/Fission nerfs, Shockwave
buff, and bounded time-scaled armour. Tuning-only, no new gems.)

**Phase 6D grew from "add 19 gems" into a balance-and-honesty pass**,
because reading the tuning constants against shipped code found four
structural defects the design docs didn't show. In short: every threat
axis is a ramp that **flattens** (ambient 3.1× at t=560s, events 2.6× at
t=420s, armour capped at `maturity × 20`) while player power is uncapped
— the same 17–21× vs 3.1× mismatch the 2026-08-05 playtest measured and
that was absorbed, never fixed. The aura weapons are **aimed at vacuum**:
ambient growth rises everywhere at a rate ramped by distance
(0.056 at 100px vs 0.49 at 400px), and every aura is floored at
`perimeter + margin` = ~105px, with **Orbiting Blades' radius identical
at level 1, 8 and 12**. And **six of twenty shipped gems are dead or
worse on most of the roster** — Fork/Chaining/Bounce/Ricochet are wired
into Bolt Turret *alone*, while Multishot divides damage for a precise
zero on Blades and a downgrade on Frost. Full account:
`docs/sessions/2026-08-10-phase-5-gate-and-6d-planning.md`.

**Previously:** 2026-08-10 (Phase 6C shipped in full — 6C-1 and 6C-2,
both planned and then greenlit with full owner autonomy in the same
session Phase 6B shipped in: three new weapons [Lance, Shockwave,
Fission Charge], twelve real extensions, `clearAt` generalized to
non-disc damage shapes, and `'beam'` as a sixth `DeliveryKind`.
Committed and pushed.)

**Phase 6C, in short:** continued straight from the same-day 6B session.
**6C-1** shipped Shockwave (a travelling ring — a genuine persistent sim
entity, not the flash-decoration `NovaFx` reuse the arsenal plan
originally claimed) and Fission Charge (Missile's Cluster Warhead
mechanic promoted to a whole weapon's identity), plus the batch's real
architectural cost: `ClearOptions.shape`, generalizing `clearAt` from a
disc to an annulus, with the disc path proven byte-identical before the
new shape was even added. **6C-2** shipped Lance — a charged, piercing
beam that targets the largest coagulant in range rather than the
nearest — which needed a sixth `DeliveryKind` (`'beam'`) and a capsule
shape reusing 6C-1's system. Both weapons carry four extensions each,
matching 6B's four-per-weapon rule, now the standing one (twelve total
this batch). The owner's own review corrected the plan twice: Shockwave
stays a travelling ring rather than becoming a cone (raised by the
owner, checked against the catalogue, and the cone was already Solvent
Sprayer's shape two batches out); and the gate — settled the day before
as "after 6B" — moved a third time to run after 6C instead, since ten
weapons against three deck slots is a stronger place to judge
*"is enhancement a decision or a slider."* Decisions 81–85; full account
`docs/plans/phase-6c-lance-shockwave-fission.md`,
`docs/plans/phase-6c1-shockwave-fission.md`,
`docs/plans/phase-6c2-lance.md`.

**Phase 6B shipped the same session, just before 6C.** The owner asked
for a plan, corrected two things in it during review (the socket model,
the extension count), then greenlit both halves together. **6B-1**
rebuilt the loadout screen's sockets into two independent lines per
weapon — extensions on their own 0/1/2-slot ladder (opening at 5/10
points invested), support gems unchanged (1→5 at 0/3/8/15/24) — and the
real `EXTENSION_DEFS` catalogue, folded into `weaponMods()` so an
extension's numeric effect shows up everywhere a gem's already did, with
zero new call sites. **6B-2** is all 28 extensions (four per weapon, not
three — arsenal plan §12's "3 ship" call is superseded) plus four new
mechanisms: coagulant chilling (Shatter Core), a coagulant armour debuff
respecting `COAGULANT_ARMOR_FLOOR` (Corrosive/Bunker Buster), regrowth
suppression (Rime/Ash), and the ring's second radius (Second Ring/Flare
— and, caught while writing this batch, three "second ring" extensions
had to go strictly *outward*, since every tower-centred radius floors at
`perimeter` and an inward second ring sweeps space nothing has ever
occupied). Two real implementation bugs were caught by the batch's own
outcome tests before reaching the browser, not by a playtest — see
Decision 80. Immolation Ring's last balance gap (`WEAPON_DAMAGE_SCALE`)
closed, and its dead `maxLevel` field is gone. Decisions 77–80; full
account `docs/plans/phase-6b-incumbent-extensions.md` and
`docs/plans/phase-6b2-extension-content.md`.

**Phases 3, 4, 5 and 6-0 are all built.** 3A–3D and 4A–4C are playtested
and confirmed (see the 2026-08-07 entries below for verdicts). **Phase 5**
landed in one long session on 2026-08-08: **5A** put all seven weapons on
a shared pipeline (Decision 70); **5B** built the enhancement-point,
socket and card-pool economy, deleting weapon-level cards for good
(Decision 71); **5C** built the pause + inventory screen that makes 5B's
economy actually spendable (Decision 72). **6-0** shipped 2026-08-09, the
pre-run weapon-select screen (Decision 73).

**Phase 6A now ships too, both halves in one session (2026-08-09):**
**6A-1** is the gem foundation — the `DeliveryKind` archetype abstraction,
per-weapon `weaponMods()`, the six Amplifier gems, gem sockets/inventory,
the overall-DPS HUD readout, and deletion of the legacy `damage`/
`atkSpeed` passives (Decision 74). **6A-2** is the Behaviour class — the
RESOLVE-stage `ClearOptions` extensions, projectile behaviour flags
(pierce/fork/chain/bounce/homing/ricochet), a weapon registry with
deferred emissions (Echo/Barrage), emission multiplication (Multishot/
Formation), all 14 Behaviour gems, and the bundle card (Decision 75). The
Immolation Ring's missing visual (open since the Phase 2 port) is fixed
in the same batch — a persistent bright-green ring around the core at its
actual radius. All of Phase 6A's gems reinterpret meaningfully across
every weapon archetype, including the four non-projectile weapons, per
the owner's explicit "be creative, don't just refuse" directive — see
Decision 74/75 for the per-archetype reinterpretations.

**The Phase 5 gate has moved three times, and is now the actual next
step.** First to after Phase 6A (settled during 5C's planning — its
central question, *"is enhancement a decision or a slider?"*, can't be
answered while every socket is empty). Then to after Phase 6B (the first
point both things a socket can hold — extensions and gems — were real
content on every incumbent weapon). Then, on 2026-08-10, to after Phase
6C instead (Decision 81) — ten weapons against three deck slots is a
stronger place to ask the question than the three-weapon deck 6B alone
would have left behind. Build order was never affected by any of the
three moves; only the point where the full gate runs did. 5C still
passed its own small immediate check live (opens/closes correctly from
both entry points, `+`/`−` read legibly, the extension clamp visibly
disables rather than silently no-op'ing).

**Every phase since 4A has found real bugs only by running the game**, not
by the test suite — worth internalizing before trusting a formula's first
draft. 4A took five rounds; 4C-1 found two; **5A's pre-refactor audit**
found six flags before a line of code was written; **5B's implementation
found a design flaw in its own plan** (assist credit didn't solve the
problem it was written for — dropped, see BACKLOG *Ideas*); **5C found a
real bug in 5B's own plumbing** (`withdrawPoints()` never returned points
to the bank — inert until 5C's `−` button became its first live caller).
Full accounts in the session records; the pattern, not just the fixes, is
the thing worth reading.

**Balance itself is still explicitly not gradeable** — the owner's own
scoping: weapon damage numbers, slime speed and overall game feel need the
remaining systems in place before they can be tuned honestly. That is
Phase 8 (Decision 13's supersession), not a reason to reorder anything.

**2026-08-09: Phase 6 was reviewed and re-planned, then 6-0 and all of 6A
shipped in the same day.** Full account: `docs/plans/phase-6-roadmap.md`
(the re-plan), `docs/plans/phase-6-0-weapon-select.md` (6-0),
`docs/plans/phase-6a1-gem-foundation.md` and
`docs/plans/phase-6a2-behaviour-gems.md` (6A). The review found a live
consequence of a design gap — four built weapons (Blades, Frost, Missile,
Immolation Ring) were unreachable in any run, because the deck was always
full and the card pool's only weapon-granting path was gated on a free
slot that never existed. The owner's answer reclassified this from bug to
missing UI: **the deck always fills every slot, is fixed for the run, and
the card pool never offers a weapon at all** — 6-0 is now the sole way any
weapon is equipped, and it shipped that way (Decision 73).

**6A followed the same day, greenlit in full** — both 6A-1 (gem
foundation) and 6A-2 (Behaviour class), with the owner's explicit
instruction to also fold in the Immolation Ring's missing visual and to
be creative rather than refuse gems on non-projectile weapons. Every one
of the 20 new gems (6 Amplifier, 14 Behaviour) reinterprets against every
weapon's `DeliveryKind` archetype instead of being whitelisted per weapon
— see Decision 74/75 for the mechanism and the per-archetype reading of
Pierce/Fork/Chain/Bounce/Ricochet on non-projectile weapons. Two real bugs
were found and fixed during implementation, both by the test suite before
ever reaching the browser: `WeaponDef.stats()` didn't take gem mods, so
the inventory screen's live stat line silently ignored every socketed
gem; and `spawnForks()` pushed its children onto the same array
`updateProjectiles` was mid-iteration over, so forked projectiles were
silently discarded every time. Full account and the deliberate scope
limits (Fork/Chain/Bounce/Ricochet are real only on the `projectile`
archetype; Homing/Multishot/Formation aren't wired for Immolation Ring,
to avoid desyncing its persistent ring visual) are in Decision 75.

**The owner playtested Phase 6A the same day it shipped and found six
things**, three of them structural rather than balance noise: the XP
curve was the wrong *shape* (quadratic cost against DPS that 6A's gems
now grow multiplicatively, so time-per-level was starting to *fall* by
level 50 — "level 80 in under ten minutes"); the card pool went
permanently dead once every socket filled, offering only Emergency
Repair forever; and the socketing UI was unclear enough that the owner
"second guessed if it worked or is there a bug." **Phase 6A-3 fixed all
three, plus banked core gems and extensions the same way gems already
banked, per the owner's request for a three-section inventory panel.**

**6A-3, in short:** `xpToNext` gained a geometric factor
(`XP_GROWTH^(level-1)`) on top of its quadratic base, so cost eventually
outpaces any polynomial growth in DPS — unmeasured, expected to be
retuned. The card pool stopped gating gems, core gems and bundles on
socket availability or ownership at all (superseding arsenal plan §11's
no-dead-card rule, since a gem with nowhere to go now just banks and
later converts to currency); extensions are the deliberate exception —
the only thing with levels, so re-rolling one you already own levels it
in place instead. Extensions and core gems now bank into their own
inventories exactly like gems always did, and a core gem's effect moved
from card-pick time to socket time, closing a real exploit: unsocketing
`maxHp` now clamps `hp` down rather than leaving it floating above the
reduced max. The loadout screen gained the owner's three-section
inventory panel (Extensions / Core gems / Support gems) beside the
weapon list, with click-a-gem-then-click-a-socket placement — every
legal socket lights up, illegal ones dim — replacing a bare, undersized
`○` that was the actual root of the "does this even work" finding. See
Decision 76 and `docs/plans/phase-6a3-loop-fixes.md`.

| | |
|---|---|
| Tests | 633 passing (52 test files) — one known flake (`grid/veinField.test.ts`, unseeded RNG, unrelated), see BACKLOG |
| Source | 90 modules under `src/` (6C added `systems/shockwave.ts`, `systems/beam.ts`, `weapons/shockwave.ts`, `weapons/fission.ts`, `weapons/lance.ts`, `render/shockwave.ts`, `render/beam.ts`; touched `grid/clear.ts`, `types.ts`, `state.ts`, `tuning/weapons.ts`, `tuning/extensions.ts`, `tuning/gems.ts`, `systems/targeting.ts`, `systems/projectiles.ts`, `weapons/registry.ts`, `main.ts`) |
| Typecheck | clean |
| Build | clean |
| Branch | `main`, committed and pushed |
| Code state | **Phase 3 + Phase 4 + Phase 5 + Phase 6-0 + Phase 6A + Phase 6B + Phase 6C all complete**, plus a post-6C playtest fix pass (Decision 86). **The Phase 5 gate has run and passed** (Decision 87). **Phase 6D is planned in full and greenlit — no code written yet.** |
| Blockers | **None.** Start with **6D-0** (`docs/plans/phase-6d0-balance-shape.md`) — tuning only, and **playtest it before 6D-1**, since its result changes what the other three should be. |

**What works today:** the horde-economy loop from Phase 3/4, unchanged and
still playtested — infection as a density field across a fixed perimeter,
hardening into a scar ring (Decisions 63–65), rendered on two visual axes
(66–67), Infection Events sparking a seven-kind coagulant roster reading
all four of §10's identity signals (68–69) — **plus the full Phase 5
arsenal framework on top of it.** Ten weapons now run on the shared
four-stage pipeline: Bolt, Blades, Chain, Frost, Poison, Missile, and
Immolation Ring (promoted from a misclassified passive in 5A), plus —
as of **Phase 6C** — **Shockwave** (a travelling ring, damaging the band
it sweeps rather than a disc), **Fission Charge** (a lobbed charge that
bursts into scattered submunitions), and **Lance** (a charged, piercing
beam that targets the largest coagulant in range instead of the nearest
— the game's first burst weapon and its first non-projectile/orbital/
pulse/cloud/ring archetype, `'beam'`). Levelling up no longer hands out
weapon-level cards at all: enhancement points bank automatically and are
spent via a `+`/`−` in a pause + inventory screen, opening sockets on a
fixed ladder as points go in. Five of the old flat passives now socket
into three fixed core slots instead of stacking without limit. The card
pool offers a core gem every second level-up, real gems (6 Amplifier —
flat multipliers on damage/rate/area/duration/velocity — and 14
Behaviour: Pierce, Fork, Chaining, Bounce, Homing, Ricochet, Multishot,
Formation, Echo, Barrage, Splash, Overflow, Kickback, Priming, every one
legal and meaningfully different on every weapon archetype), a bundle
card every 5 levels granting a themed 2–3 gem package in one pick, and —
now **40 real per-weapon extensions** (28 from Phase 6B's seven
incumbents, 12 from Phase 6C's three new weapons), four per weapon
across all ten shipped so far, each levelling 1→3 then leaving the pool
for good. Every one of those four card kinds is offered regardless of
free sockets or what's already owned — extensions, core gems and
support gems all bank into their own inventory, visible in a
three-section panel on the loadout screen.

**As of Phase 6B, a weapon's sockets are two independent lines, not
one shared pool** — an extension and a gem never compete for the same
slot. The extension line opens at 5 points invested (1 slot) and 10 (2
slots); the support-gem line is the original 1→5 ladder at 0/3/8/15/24.
Placement is click-a-gem-or-extension-then-click-a-socket, with live
legal/illegal highlighting scoped to whichever line the selected item
can actually enter. The pre-run weapon select (Phase 6-0) is still the
only way any weapon is ever equipped — the card pool never offers one.
**Confirmed live in 6C: this required zero new UI code for three new
weapons** — Shockwave, Fission Charge and Lance all picked up both
socket lines, the card pool, and legal/illegal gem highlighting for
free, including the new `'beam'` archetype's own legality (Extension
lights Lance's gem line; Velocity correctly does not).

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
whole maturity axis, the full coagulant roster). **Phase 5 built the
answer mechanism** (the enhancement/socket/card-pool economy and the
screen to use it) **without yet authoring the answers themselves** — the
18-weapon, 65-gem catalogue is fully designed (`docs/plans/phase-5-6-arsenal.md`)
but nothing in it is built. That's deliberate: 5A/5B/5C are framework, and
**Phase 6 is where the actual content lands**, now onto a framework that's
tested and live rather than being designed and built at the same time.

The agreed direction is a **slime and arsenal rework** — the field becomes
the horde's economy, growth nodes are deleted and replaced by infection
events, coagulants become the threat, passives dissolve into a PoE-style
gem system, and the tier table is demoted to flavour. **All of Phase 3,
Phase 4, and Phase 5 are done.** Phase 4's gate was run by the project
owner on 2026-08-08 — *"I have played it, all good"* — so the full
coagulant roster, armour, and the scar ring are confirmed in real play,
not just through the debug harness. The design's own risk #4 (the scar
ring feeling oppressive) did not materialise. **Phase 5's own gate moved
to after Phase 6A** (§ below) since it can't be judged with empty
sockets — so Phase 5 is code-complete and verified, but not yet
owner-playtested end to end the way Phase 4 was.

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
   reasoning) — Phase 3D, 4A, 4B, and 4C, each with a real bug found only
   by running the game.
4. **`docs/sessions/2026-08-08-phase-5-arsenal-framework.md`** — the
   arsenal catalogue's three design revisions, then 5A/5B/5C built back to
   back: the pre-refactor audit, the UI/UX question that reordered Phase
   6's batches, assist credit designed-then-dropped, and the
   `withdrawPoints` bug 5C found in 5B.
5. **`docs/sessions/2026-08-09-phase-6-replan-and-6a.md`** — Phase 6
   re-planned into nine batches, then 6-0 and all of 6A built against the
   new plan: the four-unreachable-weapons finding, the `DeliveryKind`
   archetype abstraction, the owner's *"don't just not give the player
   gems"* correction and what it changed, and the two bugs the **test
   suite** caught for once.
6. **`docs/sessions/2026-08-09-post-6a-playtest-and-6a3.md`** — the
   owner's playtest of 6A the same day, the six findings, and Phase 6A-3
   built to fix the three structural ones: the geometric XP curve, the
   socket/ownership-blind card pool (superseding arsenal plan §11), and
   the three-section banked inventory with click-to-place.
7. **`docs/sessions/2026-08-10-phase-6b-sockets-and-extensions.md`** —
   Phase 6B: a real miscommunication caught mid-review (the owner's own
   diagnosis — "we call a pool offered on level up and a pool of sockets
   the same"), which surfaced that `phase-5-6-arsenal.md` §5 had
   superseded Decision 32 without ever recording it. The owner reversed
   §5, restoring two independent socket lines; corrected the extension
   count from 3 to 4 per weapon; and two real bugs (Shatter Core's damage
   bonus, Chill Field's duration) were caught by the batch's own tests
   before reaching the browser.
8. **`docs/sessions/2026-08-10-phase-6c-lance-shockwave-fission.md`** —
   Phase 6C, same day as 6B: the gate moved a third time (to after 6C,
   not after 6B); a design question from the owner (*"why would a
   shockwave do donut-shaped damage?"*) confirmed the travelling ring
   over a cone rather than changing it; the `ClearOptions.shape`
   generalization and its own withdrawn cost argument (the performance
   half was checked and found wrong — a full ring sweep is ~1,400 cell
   visits a tick, not the hundreds first claimed); the `'beam'` archetype
   costing about six touch points instead of a full rewrite. **Read this
   one before touching `clearAt`, `DeliveryKind`, or Lance/Shockwave/
   Fission again** — it's the freshest context, and it's also where the
   annulus/capsule shape system and its two documented approximations
   (coagulant overlap for both new shapes) live.
9. **`docs/DECISIONS.md` #23–#86** — the load-bearing calls in short form.
   23–37 are the design; 38–53 are the mechanism; 54–60 are the 3C
   playtest-and-fix round; 61–62 are Phase 3D; 63–65 are 4A; 66–67 are 4B;
   68–69 are 4C; 70 is Phase 5A (the weapon pipeline); 71 is Phase 5B (the
   enhancement/socket/card-pool economy); 72 is Phase 5C (the pause +
   inventory screen — **Phase 5 closes here**); 73 is Phase 6-0 (the
   pre-run weapon select); 74–75 are Phase 6A (the gem foundation and the
   Behaviour class); 76 is Phase 6A-3 (the post-playtest loop fixes);
   77–80 are Phase 6B (two socket lines restoring Decision 32, four
   extensions per weapon, the Immolation cleanups, the two bugs the
   batch's own tests caught); 81–85 are Phase 6C (the third gate move,
   the standing four-extensions-per-weapon rule, `ClearOptions.shape`,
   the `'beam'` archetype and its gem legality, the Shockwave-vs-cone
   design check); 86 is the post-6C playtest fix pass (three real bugs,
   bundles cut, the XP-curve retune caught and reverted once before
   shipping, and a deliberate threat-side difficulty increase). #47–86
   are implementation-time findings, not from a design session — see the
   notes at the top of each section.
10. **`docs/plans/phase-5-6-arsenal.md`**, **`docs/plans/phase-5b-framework.md`**,
    **`docs/plans/phase-5c-inventory-ui.md`** — the arsenal catalogue
    design and the shipped 5B/5C economy and screen, including the
    assist-credit finding (dropped) and the withdrawPoints bug 5C found
    and fixed in 5B's plumbing. **§5 and §12's call 20 now carry
    2026-08-10 correction notes** — read them in place rather than
    trusting the original text; both are superseded (Decisions 77–78).
11. **`docs/plans/phase-6-roadmap.md`** (§3's gate row now moved below
    6C, per Decision 81), **`docs/plans/phase-6a1-gem-foundation.md`**,
    **`docs/plans/phase-6a2-behaviour-gems.md`**,
    **`docs/plans/phase-6a3-loop-fixes.md`**,
    **`docs/plans/phase-6b-incumbent-extensions.md`**,
    **`docs/plans/phase-6b2-extension-content.md`**,
    **`docs/plans/phase-6c-lance-shockwave-fission.md`**,
    **`docs/plans/phase-6c1-shockwave-fission.md`**,
    **`docs/plans/phase-6c2-lance.md`** — the nine-batch Phase 6 phasing,
    and every shipped 6A/6B/6C batch with its as-built delta. 6A-3's,
    6B's, and 6C's own plan docs all carry revision notes recording where
    the owner corrected the first draft mid-conversation, before or
    during the build.
12. **`docs/BACKLOG.md`** *Now* section — the Phase 5 gate is the concrete
    next step. Phase 3/4's own follow-ups (event tuning, the coagulant
    formation drain visual, more AoE weapons, spontaneous coagulation,
    behemoth timing) are in *Ideas* and *Bugs*.

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
              passives, tower, fx lifetimes — plus, since Phase 5: cards.ts
              (pure card-pool build/pick/apply logic) and sockets.ts
              (enhancement spend/withdraw, socket-count helpers)
  weapons/    one module per weapon (behavior only — data lives in tuning/),
              all ten built on pipeline.ts's shared ready/acquire/deliver
              stages since Phase 5A, driven from registry.ts's single loop
              since 6A-2. Lance owns its own charge bookkeeping rather
              than using cooldownReady (6C-2)
  render/     canvas draw calls, strictly separated from update logic
  tuning/     all numeric knobs: weapons, tiers, growth, events, coagulants,
              xp, geometry — plus, since Phase 5B: sockets.ts (the socket
              ladder), coreGems.ts, and extensions.ts, which since 6B/6C
              holds the real catalogue of 40 per-weapon extensions, not
              the original placeholder
  ui/         DOM/CSS HUD, upgrade cards, start/game-over overlays, and
              since Phase 5C: inventory.ts (the pause + inventory screen)
              and weaponRow.ts (its shared row renderer, reused by 6-0)
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

### 2026-08-11 — Phase 6D-3 partially shipped: Steps 1–3 of the gem-reality fix (Decision 92)

**Full account:** `docs/plans/phase-6d3-gem-reality.md` §10 as-built
delta; Decision 92 has the complete reasoning.

**Cut short by the weekly-limit constraint** — same one that drove
Decisions 88/89/91's no-playtest departure. Stopped at a clean checkpoint
(everything shipped is typechecked and tested green) rather than mid-step.

**What shipped:**
- **Step 1** — `chain.ts`/`missile.ts`/`fission.ts` now merge
  `projectileFlags(state, key)` into their spawn options, same as
  `bolt.ts` already did. `lance.ts` was moved into Step 3 instead (its
  beam has no `Projectile` entity, so the same wiring doesn't compose).
- **Step 2** — `clearAt` now returns `ClearResult` (`removed`/`touched`/
  `killed`) instead of a bare number. The scalar return proven
  byte-identical first; zero production call sites read the old return
  value, so the whole migration surface was 6 test assertions.
- **Step 3** — Fork/Chaining/Bounce/Ricochet now have real, weapon-
  appropriate readings on all six remaining archetypes (Blades, Frost,
  Shockwave, Immolation, Poison, Lance), matching the plan's §4 table.
  The owner picked full bespoke Shockwave mechanisms (not the
  Ricochet-only fallback) when asked mid-batch — every one of Shockwave's
  four readings reuses Second Wave's or Implosion's own ring machinery
  rather than inventing new ring mechanics. One real bug caught and fixed
  during this step: Blades' Chaining reading kept re-selecting the
  coagulant already being hit directly instead of a second nearby one,
  because `systems/targeting.ts`'s `bestCoagulant()` has no way to
  express "closest excluding X" — fixed with a local inline scan in
  `blades.ts`, not a `bestCoagulant` signature change (that function is
  shared with the 6D-1 Targeting gems).

**Still open — Steps 4 and 5, next session's starting point:**
- Step 4: the emission-multiplication rule. Multishot/Formation still
  divide damage unconditionally (`emissionPlan().count`) even where the
  extra emissions can't overlap the same target — still a precise zero on
  Blades, still a downgrade on Frost. This is now the *only* unfixed half
  of the original audit finding. Needs new rendering (satellite orbit
  centres for Blades, concentric rings for Immolation) — §9 already
  flagged this as the batch's least-reliably-estimated cost.
- Step 5: fix `tuning/gems.ts`'s Multishot/Formation copy (its Fork/
  Chaining/Bounce/Ricochet copy is now accurate, but the class comment's
  argument against disclosing gaps is moot for those four and not yet
  updated), write the plan's §7 test matrix (6 named categories — some
  already incidentally covered by this session's per-weapon tests, but no
  comprehensive matrix exists yet), and the single end-of-batch commit +
  push the owner asked for (done this session, but for a partial batch —
  Step 4/5's own commit is still to come).

**888 tests pass, `tsc --noEmit` clean**, covering only Steps 1–3.

### 2026-08-11 — Phase 6D-2 shipped: the Conditional gems (Decisions 90–91)

**Full account:** `docs/sessions/2026-08-11-phase-6d-batches.md` (the
whole session, all three batches) and
`docs/plans/phase-6d2-conditional-gems.md` (build + §8 as-built).
Umbrella: `docs/sessions/2026-08-10-phase-5-gate-and-6d-planning.md`.

**⚠️ Third and last of the 6D batches built with no playtest in between**,
per the owner's explicit instruction — same departure Decisions 88/89
recorded, now covering all of 6D-0/6D-1/6D-2.

**What shipped:** 9 Conditional gems (Shatter and Sterilizer cut as
duplicates of shipped 6B extensions; Corrosion kept per the owner's
reversal — armour now matters after 6D-0). Every one a RESOLVE-stage
`ClearOptions` field or debuff, legal on every weapon — no refusal table
at all, unlike Targeting's three refusals:

- **Penetration / Corrosion** reuse existing fields (`armorIgnoreCap`
  from Lance's Piercing Core, `armorShred` from Poison's Corrosive) —
  Decision 90 records that the gem wins outright over the extension when
  both are socketed on the same weapon, rather than the two stacking
  (every weapon's own `clearAt` call spreads the gem-derived object
  *last*).
- **Virulence / Saturation** — new grid-loop terms in `applyCellDamage`,
  bonus damage scaled by a cell's own maturity or density.
- **Giant-Slayer / Culling** — mirrored coagulant-loop terms scaled by
  mass relative to `MASS_BEHEMOTH`/`MASS_CONGEALER`; Culling additionally
  instantly finishes a coagulant left at or below a **fraction of its own
  starting mass** (not an absolute), so it does something to a behemoth
  and doesn't delete a mote on sight.
- **Desperation / Proximity** — resolved once per `clearAt` call (core HP
  and hit-distance-from-tower don't vary within one hit) and folded
  directly into `power`, rather than a per-cell/per-coagulant term.
- **Momentum** — the one gem carrying state across ticks
  (`state.weaponStreak`, per weapon): ramps on a landed hit, resets on a
  miss or a kill. Read and written entirely inside `resolveOpts.ts`
  (read) and `clearAt` (write) — zero weapon-file changes needed for this
  one either, reusing `state.lastCoagulantDeathAt` (Bladestorm's own
  signal) for kill detection, tightened to compare across exactly one
  `clearAt` call rather than a multi-second window.

**⚠️ A real bug, caught by the tests this batch's own plan called for,
not the browser (Decision 91).** `systems/resolveOpts.ts` already reaches
every weapon's spawned entity (a projectile, a cloud, the Shockwave
ring) — that half worked immediately. What didn't: `systems/projectiles.ts`
(both its call sites), `systems/clouds.ts`, and `systems/shockwave.ts`
each read that entity back at *impact* time through a **hardcoded field
whitelist written before this batch existed** — none of the nine new
fields were on it. **Bolt, Chain, Missile, Fission Charge, Poison, and
Shockwave — six of the ten weapons — would have shipped every Conditional
gem completely inert**, despite `tsc --noEmit` and the rest of the 823-test
suite passing clean, because TypeScript's structural typing doesn't flag
a spread-contributed property nobody reads back out. Frost, Immolation,
Blades, and Lance were unaffected — all four call `clearAt` directly with
no entity in between.

Found writing the plan's own "no gem is a silent no-op on any archetype"
test as an actual spawn-then-impact test rather than checking either
boundary alone. Fixed by centralizing the eleven fields (nine new, plus
`armorIgnoreCap`/`armorShred`) into one shared `ConditionalGemFields`
interface in `state.ts`, extended by `ProjectileBase`/`CausticCloud`/
`ShockwaveRing`, and forwarding the full set at all four consuming call
sites. **The general lesson recorded in Decision 91 for the next batch
that adds a per-weapon damage field:** reaching an entity at spawn is not
evidence it reaches `clearAt` at resolution — the deferred-entity
consumers need an explicit check, not just the spawning weapon file.

**Test coverage:** a new `Phase 6D-2: Conditional gems` block in
`grid/clear.test.ts` testing every field directly against `ClearOptions`
(same level 6A-2's RESOLVE options are tested at) — as paired
with/without-gem comparisons on identical targets, not same-call ratios
between different targets (the first draft of three of these tests made
exactly that mistake and failed correctly, the same class of error
Decision 89 already named for the Targeting gems); per-gem dispatch tests
in `systems/resolveOpts.test.ts`; the always-legal-everywhere matrix in
`tuning/gems.test.ts`; and the spawn-to-impact regression guards in
`systems/projectiles.test.ts`, `systems/clouds.test.ts`, and
`systems/shockwave.test.ts` that catch Decision 91's bug directly. **828
tests pass, `tsc --noEmit` clean.**

**Three of Phase 6D's four sub-batches are now shipped** (6D-0 balance,
6D-1 Targeting, 6D-2 Conditional). **6D-3 (the gem-reality fix,
`docs/plans/phase-6d3-gem-reality.md`) was not part of this session's
scope** and remains unbuilt — the owner's instruction covered 6D-0
through 6D-2 only. **No playtest has run across any of the three shipped
batches** — that is the standing risk carried into whatever comes next;
see Decisions 88/89/91.

### 2026-08-11 — Phase 6D-1 shipped: the Targeting gems (Decision 89)

**Full account:** `docs/sessions/2026-08-11-phase-6d-batches.md` §3 and
`docs/plans/phase-6d1-targeting-gems.md` (build + §7 as-built).
Umbrella: `docs/sessions/2026-08-10-phase-5-gate-and-6d-planning.md`.

**⚠️ Continues the departure Decision 88 recorded** — built immediately
after 6D-0 in the same session, no live playtest in between, per the
owner's explicit instruction. 6D-1's aura-specific gem readings are
therefore unverified on top of 6D-0's own unverified reach numbers.

**What shipped:** 7 Targeting gems (Scattershot cut) — Threat Priority,
Field Priority, Breach Priority, Vigilance, Fixation, Triage, Opportunist.
Each replaces a weapon's ACQUIRE stage wholesale via a new dispatch layer,
`systems/targetingGems.ts`:

- **`targetingAcquire(key, maxRangeFor, defaultAcquire)`** wraps every
  weapon that already aims (Bolt/Chain/Poison/Missile/Fission/Lance) — a
  socketed Targeting gem overrides the default, falls back to it
  otherwise. Lance's own targeting is now literally "Threat Priority,
  built in," routed through the same wrapper as everything else, per the
  plan's instruction — no parallel implementation to drift.
- **`auraTargetingReading(state, key, originX, originY, radius)`** gives
  the self-centered reading for Blades/Frost/Immolation/Shockwave, none
  of which have an ACQUIRE stage: Vigilance produces a `ClearShape`
  annulus that clips the near field out entirely; Threat Priority/Triage/
  Breach Priority/Fixation pick one coagulant within the aura's reach and
  bonus-damage it via two new `ClearOptions` fields (`focusTarget`/
  `focusBonus`, `grid/clear.ts`) — a reference-equality bonus, no second
  damage path.
- **Fixation** carries state across ticks (`state.fixationTarget`,
  per-weapon) — the only Targeting gem that isn't a pure function of the
  current field.
- **Opportunist** reads `state.lastHitPoint`, written (mutated in place,
  never reallocated) by every `clearAt` call, from any weapon.
- **At most one Targeting gem per weapon**, refused at socket time
  (`systems/gemSockets.ts`'s `gemLegalFor`), the same mechanism an
  already-owned kind or an unsupported archetype already used.

**Two deviations from the plan, found while implementing, both recorded
in Decision 89 rather than silently reinterpreted:**

1. **Vigilance also refuses `orbital` (Blades)** — its orbit radius
   already floors at `perimeter + margin` (Decision 16), so the blade's
   center is structurally never inside the perimeter. "Only outside the
   perimeter" would be a guaranteed no-op there, the exact silent-inert
   failure this whole batch exists to catch — caught during the build
   instead of after.
2. **Breach Priority's aura reading is a focus-damage bonus on whichever
   coagulant is closest to the tower**, not a literal "pull the inner
   edge inward" — a plain disc hit's inner edge is already 0, so there's
   nothing to pull further in. Reuses the same focus-bonus mechanism as
   Threat Priority/Triage/Fixation, keyed on distance instead of mass.

**A real bug caught by the tests, not the browser:** an early draft of
the focus-bonus tests compared damage as a loss *ratio* between two
different-mass coagulants (e.g. "does the 500-mass one lose a bigger
fraction than the 200-mass one") and failed — a smaller coagulant loses a
much larger fraction of its own mass than a bigger one even with **zero**
bonus, since a hit's absolute damage is roughly mass-independent. Fixed
by comparing the same coagulant's mass loss across two paired runs
(with the gem vs. without), which isolates the gem's actual effect.

**Test coverage:** the full legality matrix (7 gems × 6 archetypes,
`tuning/gems.test.ts`); the four new acquire functions plus their
fallback behaviour (`systems/targeting.test.ts` — `highestMassPoint`
itself refactored onto a new shared `bestCoagulant()` loop, behaviour
unchanged, confirmed by its own existing tests passing unmodified); the
full dispatcher (`systems/targetingGems.test.ts`, new file); the
at-most-one-per-weapon refusal; and end-to-end wiring proofs in every
weapon's own test file. **731 tests pass, `tsc --noEmit` clean.**

**Next: 6D-2 (Conditional gems), immediately, same session.**

### 2026-08-11 — Phase 6D-0 shipped: the balance-shape tuning pass (Decision 88)

**Full account:** `docs/sessions/2026-08-11-phase-6d-batches.md` §2 and
`docs/plans/phase-6d0-balance-shape.md` (build + §10 as-built delta).
Umbrella/findings: `docs/sessions/2026-08-10-phase-5-gate-and-6d-planning.md`.

**⚠️ Departure from the plan: no playtest before 6D-1.** The plan's own
§8 says *"playtest before 6D-1 — this batch is the one whose result
changes what the others should be."* The project owner explicitly
instructed all of 6D-0/6D-1/6D-2 built and shipped in sequence within one
session, verified by `tsc --noEmit` + `vitest run` only, no live/browser
testing. This is a deliberate owner call, recorded rather than silently
skipped — see Decision 88 for what it risks (6D-1's aura-specific gem
readings assume 6D-0's reach fix actually lands them somewhere real).

**What shipped, tuning-only, no new gems or mechanisms:**

1. **Unbounded late-game escalation.** `ambientInfectionMult` now
   multiplies the existing breakpoint table by `LATE_GROWTH_PER_MINUTE
   ^ (t/60)` (≈1.05/min) instead of plateauing at t=560s.
   `eventSpawnInterval` keeps shrinking past its old t=420s floor toward
   an asymptotic 3s hard floor instead of stopping at 7s.
2. **The opening ~10% softer** — `AMBIENT_BASE` 0.02→0.018, `CREEP_RAMP`
   0.035→0.032.
3. **The aura fix (the main event).** Blades/Frost/Immolation were parked
   at 100–115px, inside the annulus ambient growth barely reaches — reach
   terms raised sharply (Immolation base 66→190, Frost 115→210, Blades
   64→165) with no damage change, since `clearAt` already made
   Immolation/Frost out-clear the projectiles per shot. Blades also got
   `HIT_RADIUS` 16→26 and level-1 blade count 1→2 — it was the one aura
   genuinely below Bolt on throughput even after the reach fix, because
   its `perLevel` term never once cleared the perimeter floor at any
   level.
4. **Weapon spread** — Chain Bolt nerfed on both levers (damage and fork
   cap), Fission's blast count cap cut 9→7, Shockwave's speed slowed
   (thickens its swept band) and damage raised.
5. **Armour raised to 35, time-scaled but bounded** (+35 over 15 minutes,
   capped at 70 total) — unbounded would drive every weapon onto the 15%
   `COAGULANT_ARMOR_FLOOR`, erasing weapon identity and breaking
   Penetration (6D-2). `coagulantArmor()` gained a second parameter
   (`elapsedSeconds`), and `systems/formation.ts` now passes `state.time`.

**Test fallout from the reach/damage changes:** four pre-existing tests in
`weapons/blades.test.ts` and `weapons/immolation.test.ts` hardcoded old
numbers (bladeCount(1)=1, HIT_RADIUS=16, IMMOLATION_REACH.base=66) and
needed both updated assertions and, for two Immolation extension tests,
a bigger test grid — the new 190px base reach no longer fit in their old
200×200px arena. Full list in the plan's §10.

**New tests:** `tuning/growth.test.ts` and `tuning/events.test.ts` (new
files, pinning the unbounded-curve outcome per Decision 20), an
aura-engagement block in `systems/growth.test.ts` (checks the real
`applyAmbientGrowth` ramp at each aura's actual level-1 radius, not a
hardcoded number), an armour-bound block in `systems/formation.test.ts`
(guards the degeneracy argument — holds for Lance at level ≥3, explicitly
does not promise anything for a weapon left at level 1 all run), and a
`bladeRadius` level-response regression guard. **652 tests pass, `tsc
--noEmit` clean.**

**Next: 6D-1 (Targeting gems), immediately, same session.**

### 2026-08-10 (evening) — Phase 6D planned in full: four sub-batches, all greenlit. No code.

**Full account:** `docs/sessions/2026-08-10-phase-5-gate-and-6d-planning.md`.
**The builds:** `docs/plans/phase-6d0-balance-shape.md`,
`phase-6d1-targeting-gems.md`, `phase-6d2-conditional-gems.md`,
`phase-6d3-gem-reality.md`. The umbrella
(`phase-6d-conditional-targeting-gems.md`) carries the findings and
reasoning; the four carry the builds.

**Start here next session: 6D-0, and playtest it before touching 6D-1.**

**The batch grew from "add 19 gems" to four sub-batches** because reading
tuning constants against shipped code found four structural defects:

1. **The threat plateaus, player power doesn't.** Ambient caps at 3.1× at
   t=560s, events at 2.6× at t=420s, armour at `maturity × 20`. Same
   mismatch the 2026-08-05 playtest measured (17–21× vs 3.1×) — absorbed
   into the rework, never fixed. The 2026-08-10 pass raised each *base*
   30–40% while preserving ramp shape, which is exactly why the owner
   reports "too hard at the start, too easy later."
2. **The aura weapons are aimed at vacuum.** Ambient growth rises
   everywhere at once, ramped by distance (0.056 at 100px, 0.49 at
   400px); every aura floors at `perimeter + margin` ≈ 105px.
   **Blades' radius is identical at level 1, 8 and 12** — `perLevel: 2`
   never clears the floor. **A first draft proposed raising Frost's and
   Shockwave's damage and was withdrawn**: `clearAt` applies power *per
   cell*, so Immolation already out-clears Bolt 7.4× per shot. The lever
   is reach, not damage.
3. **Six of twenty shipped gems are dead or worse.**
   Fork/Chaining/Bounce/Ricochet are wired into **Bolt Turret alone** —
   only `bolt.ts` imports `projectileFlags()`. Multishot divides damage
   unconditionally: a precise **zero** on Blades, a **downgrade** on
   Frost. The descriptions aren't undisclosed, they're **wrong**.
4. **Armour is inconsequential** — flat 20 against level-8 hits of
   44–313, and it never scales with time.

**Two traps caught before any code.** Unbounded armour would drive every
weapon onto the 15% floor and erase weapon identity (Lance by ~25min);
bounded instead, with ambient/event escalation carrying the unbounded
half. And **all seven Targeting gems would have shipped dead on the aura
weapons** — `pipeline.ts:28` says self-centred weapons have no ACQUIRE
stage to replace, the same defect as #3 pre-baked into the pipeline and
scheduled to repeat in the very next batch.

**The owner's correction mid-session shaped the result:** *"you planned
the balance phase and gem reality phase without actually thinking through
what that means."* True — both were headings with a sentence each.
Designing them properly is what produced the withdrawal in #2 and the
finding that most of the `clearAt` blocker is avoidable (every aura
weapon already knows its own hit position).

**Settled:** unbounded escalation; opening ~10% easier; both ends of the
weapon spread (Chain Bolt nerfed on both levers, ~40%); aura fix is
reach; armour raised, time-scaled, bounded; **9 Conditional gems, not 11**
(Shatter and Sterilizer are already shipped as 6B extensions; Corrosion
kept because armour now matters); **7 Targeting, not 8** (Scattershot
cut); 6D-3 at full scope including the `clearAt` return change.

**A new check this session invented and should be repeated:** audit the
unbuilt catalogue against *shipped extensions*. 6B checked candidate
extensions against shipped gems and found six duplicates; nobody checked
the reverse, so three catalogued gems had quietly shipped under extension
names.

### 2026-08-10 — The Phase 5 gate ran and passed. Decision 87.

**Full account:** `docs/DECISIONS.md` #87; no separate session record —
the gate produced two verdicts and no build. The bugs the same playtest
found are the entry below (Decision 86), fixed and shipped first.

**The gate is closed.** Open since Phase 5C and moved three times (after
5C → after 6A → after 6B → after 6C), it ran against the post-6C build
and passed on both of its questions:

1. **"Is enhancement a decision or a slider?" → a decision.** The
   socketing loop works as designed. This is the question every gate move
   was made to protect — it cannot be answered with empty sockets, with
   only one of the two socket-fillers real, or against a three-weapon
   deck where every weapon is always equipped. Its passing configuration
   is worth naming, since that's what a re-ask would compare against: two
   independent socket lines (Decision 77), 40 real extensions, ~20 gems,
   ten weapons against three deck slots.
2. **The 65-gem catalogue count → go, unchanged.** `phase-5-6-arsenal.md`
   §14's risk 2 is discharged, and it is the reason the gate was worth
   running before 6D specifically. **6D ships its full 19 gems.**
   Trimming the set, and slicing 6D into a Targeting-only 6D-1 to judge
   first, were both offered and declined.

**The named risk of the third gate move did not materialise** — that a
bad gate result would strand 6C's twelve already-built extensions. Build
order is unchanged, as it was after all three moves.

**Planned** — **Phase 6D**: the Conditional (11) and Targeting (8) gems.
Per the roadmap this is the cheap batch — 14 visually free, 5 modifiers,
0 new renderers, no new subsystems — and it is where Threat Priority
finally lands against the Carrier/Bulwark coagulant pair that Phase 4C
shipped specifically to make it interesting. No blockers. Next step is a
plan document and a greenlight, per the standing instruction.

### 2026-08-10 — Post-6C playtest: three real bugs, bundles cut, XP/difficulty pacing pass. Decision 86.

**Full account:** `docs/DECISIONS.md` #86; no separate session record —
small enough to carry entirely in the decision and BACKLOG entries.

**The owner playtested Phase 6C immediately after it shipped** (same
pattern as every batch this project has actually run — Decision 76, 80,
etc.: real bugs surface from play, review alone doesn't find them) and
reported four bugs plus a set of pacing/difficulty calls in one message,
inviting questions but mostly just directing fixes.

**Three real bugs, all root-caused before touching code:**
1. **Lingering Spores (Caustic Cloud) always drifted due east.** Traced
   to `systems/clouds.ts` computing direction as
   `atan2(c.y - originY, c.x - originX)` — and a cloud's origin was
   always identical to its own spawn position, so this was `atan2(0, 0)
   = 0` every time, not a genuinely computed "outward" direction. The
   code's own comment lampshaded the degenerate case without noticing it
   was the *only* case that ever ran.
2. **Cluster submunitions always landed in a fixed cross pattern** —
   Fission Charge, Chain Fission, and Missile's Cluster Warhead all
   share `spawnClusterSubmunitions`, which placed children at evenly
   spaced, fixed-starting-angle positions every burst. The owner asked
   specifically for **fully random** angles per child, not a
   randomly-rotated-but-still-even ring — confirmed by a follow-up
   message repeating the request when the first fix pass was still being
   scoped.
3. **Twin Canister (Caustic Cloud) always landed at the same fixed
   +40/+40 diagonal offset.** Same shape of fix as #2 — a random angle
   at the same distance.

**Bundles cut entirely**, the owner's verdict after playing with them:
*"sounded good on paper but not good."* Removed rather than gated off —
`tuning/bundles.ts`, the `CardChoice` variant, the pool builder, both
call sites, and the render branch are all gone, per CLAUDE.md's own
"delete rather than leave dead code" convention. `CARDS_PER_DRAW`
dropped 4 → 3 the same session, a separate but related legibility call.

**The XP curve tightened again**, and this is where a first attempt was
caught and reverted before shipping: raising a flat multiplier on the
whole curve looked like the obvious fix, but it would have raised
`xpToNext(1)` too — breaking Decision 61's explicit guarantee that the
early rush survives any retune *by construction*
(`^(level - 1)` is exactly 1 at level 1 no matter what `XP_GROWTH` is
set to). `XP_GROWTH` alone (1.08 → 1.12) is the only lever that doesn't
reopen that guarantee, and the test suite's own pinned
`xpToNext(1) === 19` assertion is what caught the first attempt.

**A deliberate, threat-side-only difficulty pass**, per the owner's
direct request ("make the slime overall more difficult"): coagulant
travel speed and arrival damage, Infection Event frequency, ambient
growth rate, and core contact damage all raised ~30-40%. Every constant
touched already carried a "not finalized, balance-pass knob" comment
from when the 3C playtest gate tuned it *down* — this reverses that
tuning pass rather than inventing a new mechanism. No weapon damage or
player-side stat was touched.

**Fission Charge recolored to blue**, distinct from Shockwave's cyan, so
the two read as different weapons on screen.

**Verified:** typecheck clean, build clean, 633/633 tests (7 bundle
tests removed with the mechanism, 3 new regression guards added —
guarding specifically against the *class* of bug found here, not just
the instance: two clouds with different `driftAngle` values must end up
in different places; repeated casts of the same extension must not all
pick the same angle). **Not verified live in the browser** — the
owner's explicit call this session, trusting the automated suite given
every change here is either a pure tuning constant or already covered
by a new regression test written specifically for it.

633/633 tests, typecheck clean, build clean. **Committed and pushed.**

### 2026-08-10 — Phase 6C: Lance, Shockwave, Fission Charge; the `ClearOptions.shape` system; the `'beam'` archetype. Decisions 81–85.

**Full account:** `docs/sessions/2026-08-10-phase-6c-lance-shockwave-fission.md`,
plus `docs/plans/phase-6c-lance-shockwave-fission.md` (the umbrella),
`docs/plans/phase-6c1-shockwave-fission.md` (6C-1), `docs/plans/phase-6c2-lance.md`
(6C-2) — each carrying its as-built delta at the top.

**Continued straight from the same-day Phase 6B session** (below). The
owner asked for both 6C-1 and 6C-2 planned, answered four settled-call
questions in one pass (three went the recommended way; one — the gate —
did not), then greenlit both for implementation with full autonomy.

**The gate moved a third time.** Roadmap §5 Q1 had it running after 6B;
raised again per `CLAUDE.md`'s ground-truth protocol since that was
already a decision, and the owner moved it again — 6C ships first, gate
after. The reasoning: ten weapons against three deck slots is a
stronger place to judge *"is enhancement a decision or a slider?"* than
the three-weapon deck 6B alone would have left behind (Decision 81).

**A design question from the owner mid-review corrected the plan.**
Asked *"why would a shockwave do donut-shaped damage? ...can we make it
a cone?"* — the band turned out to be pure delivery mechanism (the net
effect over the ring's life is exactly the full disc the owner
pictured), and the travelling ring survived on its own merits: an
instant disc would have been redundant with **Frost**, not Immolation,
and a cone was already Solvent Sprayer's shape two batches out. Kept as
a travelling ring (Decision 85).

**The plan's own cost argument for the `ClearOptions.shape` system was
wrong on one leg, caught during the same review.** Asked directly
whether the weapons could just do damage in a different shape rather
than teaching `clearAt` new geometry, checking the objection honestly
found the *performance* half was never real — a full ring sweep is
~1,400 cell visits a tick, negligible — and only the XP-rounding
argument holds (splitting one hit across many small `clearAt` calls
rounds each toward zero via `Math.round(removed * 1.3)`, so a sampled
beam would pay almost no XP, silently). The owner still chose the full
shape system over the cheaper partial fix, weighing that Cauterizer's
beam (6E) is a third consumer already in the catalogue (Decision 83).

**Shipped:** `ClearOptions.shape` — `clearAt` generalized from a disc to
an annulus (Shockwave's travelling ring) and a capsule (Lance's beam),
disc path required and proven byte-identical before either new shape was
added; `'beam'` as a sixth `DeliveryKind`, costing about six touch
points in the gem tables rather than a full rewrite — direct evidence
the Phase 5A pipeline bet is paying off (Decision 84); Shockwave,
Fission Charge and Lance, each with four extensions (twelve total,
Decision 82 — now the standing per-weapon rule); Fission Charge's
Chain Fission recursion bounded by a generation counter that can never
trigger a third split, the same termination-by-construction discipline
Salvo's `armAt` fix used in 6B-2; Lance's three-layer charge tell (a
core aura that still works with no coagulant on the field, particles
that orbit rather than drift inward so they can't be misread as the
game's own XP-pickup idiom, and a target line re-acquired every tick so
it never lies about a bigger threat forming mid-charge).

**Verified live, with the Browser pane actually compositing this
session** — no visibility workaround needed for the first time since
Decision 75. A temporary debug bridge was still used, not for
visibility but to force specific weapon/coagulant scenarios rather than
wait on natural spawns; removed before commit, bundle hash confirmed
identical. Live-tested and confirmed working: the Extension gem's socket
highlighting lit Shockwave and Lance but stayed dark on Fission in the
real loadout screen (Velocity showed the exact opposite pattern); all
three new weapons confirmed damaging a coagulant directly (mass
5000 → 4942 over an observed window). Zero console errors.

637/637 tests (up from 589 — 48 new), typecheck clean, build clean.
**Committed and pushed.**

**Planned** — **the Phase 5 gate**, now the actual next item. No
blockers.

### 2026-08-10 — Phase 6B: two socket lines and 28 real extensions. Decisions 77–80.

**Full account:** `docs/sessions/2026-08-10-phase-6b-sockets-and-extensions.md`
(the socket-model miscommunication and its diagnosis, the extension-count
correction, the split-then-unsplit negotiation), plus
`docs/plans/phase-6b-incumbent-extensions.md` (the umbrella plan and
6B-1) and `docs/plans/phase-6b2-extension-content.md` (6B-2), both
carrying their as-built deltas at the top.

**The review found two things before any code was written**: six of the
28 candidate extensions duplicated a 6A gem almost exactly, and Frost
Nova's freeze never touched coagulants at all — `grid.frozen` is a
per-cell array the growth pass reads, but `Coagulant` had no chill field,
so the weapon the design calls *"a setup weapon"* set nothing up against
the actual threat.

**The owner's review caught something the plan itself had missed.**
Asked whether the loadout screen would change, the owner traced a real
gap: `phase-5-6-arsenal.md` §5 (2026-08-08) had merged extension and
gem sockets into one shared pool per weapon, which supersedes Decision
32's original *"per-weapon extension slots, universal support gems"* —
and that supersession was never recorded, contradicting revision 3's own
*"No decision is superseded — zero"* claim. Raised per `CLAUDE.md`'s
ground-truth protocol rather than resolved unilaterally. **The owner
reversed §5**: two independent socket lines, the extension line on its
own laddered proposal (0/1/2 slots at 0–4/5–9/10+ points invested),
restoring Decision 32 (Decision 77). A capacity increase (5 sockets → 7
at full investment) falls out of this and was confirmed intentional, not
a balance risk.

**A genuine miscommunication surfaced mid-conversation and was diagnosed
by the owner directly**: *"we call a pool offered on level up and a pool
of sockets the same."* Fixed by naming the distinction once in the plan
itself — "card pool" for the level-up draw, "sockets" (never "socket
pool") for what a weapon holds.

**The extension count was corrected from 3 to 4 per weapon** — the
catalogue's own tables (`phase-5-6-arsenal.md` §7) always listed four
candidates; only §12's settled-calls summary said three would ship. All
four now ship, superseding that call (Decision 78) — 28 extensions this
batch, 72 across the full 18-weapon catalogue.

**A split into 6B-1/6B-2 was proposed, declined, then requested anyway**
one message later — two plan documents were written as asked, then the
owner greenlit both together with full autonomy rather than gating them
separately, so the build proceeded as one continuous pass despite the
two documents.

**Shipped:** the two socket lines and their UI rework
(`ui/weaponRow.ts` split into per-line rendering, `ui/inventory.ts`'s
highlight split into `{gems, extensions}`, the per-row picker gap
closed — it only ever listed gems before, even after extensions became
bankable in 6A-3); the real extension catalogue (`tuning/extensions.ts`,
`systems/extensions.ts`, folded into `weaponMods()`); all 28 extensions
across the seven incumbents, including four new mechanisms — coagulant
chilling, a coagulant armour debuff respecting `COAGULANT_ARMOR_FLOOR`,
regrowth suppression, and the ring's second radius (with three "second
ring" extensions corrected to go strictly *outward*, since every
tower-centred radius floors at `perimeter` and an inward second ring
sweeps space nothing has ever occupied — caught while planning 6B-2,
before any code was written). Immolation Ring's last balance gap
(`WEAPON_DAMAGE_SCALE`) closed; its dead `maxLevel` field deleted.

**Two real bugs, both caught by the batch's own outcome tests before
reaching the browser** (Decision 80): Shatter Core's damage bonus was
wired as the literal multiplier instead of a `+X%` fraction (matching
every sibling field's convention), making a level-1 hit deal 70% *less*
damage instead of 30% more; Chill Field took a `max()` against the base
freeze duration, which the base always dominated, making the extension a
silent no-op. Both fixed once each test's own expected value didn't
match what the code produced.

**Verified live** via the same debug-harness technique Decisions 75/76
used — the Browser pane wasn't compositing frames this session either. A
run with all seven weapons, each carrying two real extensions and two
gems, ran 900+ simulated ticks with zero console errors; the loadout
screen's DOM confirmed both socket lines render at their exact expected
counts (`gemSocketCount(24)=5`, `extensionSlotCount(24)=2`), and the
side panel showed real per-weapon extension names, icons and
descriptions in place of the old placeholder. Debug bridge removed,
production bundle hash matched exactly before and after.

589/589 tests (up from 513 — 76 new), typecheck clean, build clean.
**Committed and pushed.**

**Planned** — **the Phase 5 gate** next: *"is enhancement a decision or
a slider?"* — the first point at which both things a socket can hold are
real content on every incumbent weapon. No blockers.

### 2026-08-09 — Post-6A playtest, then Phase 6A-3: the loop fixes. Decision 76.

**Full account:** `docs/sessions/2026-08-09-post-6a-playtest-and-6a3.md`
(the playtest findings, the scope conversation that turned a click-target
fix into a banking pass, and the rejected-ideas table), plus
`docs/plans/phase-6a3-loop-fixes.md` (the plan, revised mid-conversation
before the build started, with its as-built delta at the top).

**The owner played the just-shipped 6A the same day** — *"I have play
tested the game, which I know is not the time"* — and found six things.
Three were structural, not balance noise, and are what this batch fixed:

1. **The XP curve was the wrong shape.** Cost was quadratic in level;
   income is proportional to DPS; 6A's Amplifier gems make DPS grow
   multiplicatively. Time-per-level is `O(level²)/O(DPS)`, so once DPS
   outgrows the square, time-per-level *falls* — "lvl 80 within not even
   10 mins." No coefficient retune fixes a curve that's the wrong class;
   `xpToNext` gained a geometric factor, `XP_GROWTH^(level-1)` (the `-1`
   keeps `xpToNext(1)` exactly as it was, so the early rush survives by
   construction). `XP_GROWTH = 1.08` is a first-draft guess — the owner
   declined an offered measurement pass in favour of shipping now.
2. **The card pool went permanently dead once sockets filled** — every
   individual gate was correct, but nobody had specified what to offer
   once *everything* was legitimately full, so the fallback (Emergency
   Repair) became the steady state the moment a deck's ~15 sockets
   filled. The owner's fix reframed the rule rather than patching the
   symptom: *"it shouldn't matter if I have open sockets or not... the
   pool should not care if I have something."* Gems, core gems and
   bundles all became fully socket- and ownership-blind — **superseding
   arsenal plan §11's no-dead-card rule** — with leftovers destined to
   become currency in Phase 7 (the "orbital trade ship" idea gained a
   concrete job the same conversation: recycling surplus gems mid-run).
3. **Socketing was unclear enough that the owner doubted it worked at
   all** — *"the empty support socket is too small and unintuitive...
   even I second guessed if it worked."* The real cause wasn't hit-area,
   it was visibility: the only route to inventory was clicking a socket,
   which then filtered to what fit *that one weapon*, so anything that
   fit nothing currently equipped was invisible everywhere.

**The build itself grew mid-conversation, deliberately.** A first plan
draft treated finding 3 as a CSS fix and kept extensions gated on free
sockets. The owner's actual ask was bigger: *"the inventory itself has to
have 3 sections for extensions, core gems and support gems... visible
when opening the loadout screen on the side as a separate panel."* That
turned finding 2's fix into a full banking pass — extensions and core
gems now live in their own inventories (`extensionInventory`,
`coreGemInventory`), exactly like support gems always did, with one
owner-specified asymmetry: *"when you roll an extension you already have
it socketed or unsocketed it increases the level... regardless if its
used or not"* — the only card kind that reads ownership rather than being
fully blind to it, recorded explicitly as deliberate rather than an
inconsistency to "clean up" later.

**Shipped:** the geometric XP curve (`tuning/xp.ts`); the socket/
ownership-blind card pool (`systems/cards.ts`, with the extension
exception in its own §3a); `extensionLegalFor`/`socketExtension`/
`unsocketExtension`/`socketCoreGem`/`unsocketCoreGem` (`systems/
gemSockets.ts`); a core gem's effect moved from card-pick time to socket
time (`systems/passives.ts`'s `applyCoreGemEffect`/`removeCoreGemEffect`,
with the `maxHp` unsocket clamp that closes the free-heal exploit);
`withdrawPoints` evicting extensions to inventory instead of clamping the
withdrawal, which also let `minPointsForSockets` and its UI disabled-state
be deleted outright; and the loadout screen's new two-column layout —
weapons/core on the left, the three-section panel on the right — with
click-a-gem-then-click-a-socket placement, legal sockets lit, illegal
ones dimmed, and the pre-6A-3 per-row picker kept as a working second
route. 513/513 tests (up from 495, 18 new), typecheck clean, build clean.

**Verified live**, and this time the Browser pane was compositing
normally (unlike the 6A-1/6A-2 session) — no debug-harness workaround was
needed for visibility, though a temporary `window.__debugGrantXp`/
`__debugState` bridge was still added (Decision 59's precedent) purely to
reach level 60+ without a real ten-minute playtest. Confirmed by hand: a
gem placed live-updates a weapon's stat line immediately (Amplifier:
30→44 pwr); an extension only lights up its own weapon's sockets, never
a different one; a core gem lights up only the core row; click-again and
Escape both cancel placement cleanly; the legacy per-row picker still
opens and sockets correctly when nothing is selected; and the maxHp
exploit is closed in both directions — unsocketing while damaged heals
nothing, and unsocketing at full HP clamps down rather than leaving HP
floating above the reduced max. Zero console errors throughout. The debug
bridge was removed and the production bundle hash matched exactly before
and after, confirming a clean removal.

**Committed and pushed.**

**Planned** — **Phase 6B** next (real extensions for the seven incumbent
weapons, Immolation Ring's remaining `WEAPON_DAMAGE_SCALE` gap and its
dead `maxLevel` field), then the Phase 5 gate. No blockers.

### 2026-08-09 — Phase 6A ships in full: gem foundation + Behaviour class. Decisions 74–75. Immolation Ring's visual fixed.

**Full account:** `docs/sessions/2026-08-09-phase-6-replan-and-6a.md`
(the whole day, including the owner's scope correction and the
rejected-ideas table), plus `docs/plans/phase-6a1-gem-foundation.md`
(6A-1: delivery archetypes, `weaponMods`, the six Amplifier gems,
sockets/inventory, the DPS readout, as-built delta at the top) and
`docs/plans/phase-6a2-behaviour-gems.md` (6A-2: the four mechanisms —
RESOLVE options, projectile flags, deferred emissions, emission
multiplication — the fourteen Behaviour gems, the bundle card, as-built
delta at the top).

**Shipped, greenlit in full by the owner with explicit autonomy** ("I
greenlight full 6A with full autonomy for you. You got it, make it good"),
plus a scope addition folded in on request — a bright-green persistent
ring visual for Immolation Ring, drawn at its actual radius around the
core, closing a gap open since the Phase 2 port.

**6A-1 — the foundation.** `DeliveryKind` (`projectile | orbital | pulse |
cloud | ring`) replaces `WeaponKey` as what a gem reasons about, so a gem
is authored once against an archetype rather than once per weapon —
avoiding the N×M cost the arsenal plan's own pipeline design exists to
prevent. `weaponMods(state, key)` computes a per-weapon
damage/rate/area/duration/velocity multiplier struct from socketed
Amplifier gems; every weapon's `stats()` and pipeline now read it instead
of the deleted global `damageMult()`/`atkSpeedMult()`. Six Amplifier
gems, gem sockets/inventory (`systems/gemSockets.ts`), a `'gem'`
`CardChoice` kind that opens the socket picker immediately on pick (same
pattern 5C already built for Manage Loadout), and the HUD's old `DMG`/
`SPD` readout replaced by a single smoothed `DPS` number
(`systems/dps.ts`, exponential smoothing off `clearAt`'s own removal
total — the owner's own suggestion, better than the three options
offered). The legacy `damage`/`atkSpeed` passives are deleted outright.

**6A-2 — the Behaviour class and the machinery it needed.** Four pieces
of machinery Phase 5A deliberately deferred, built now against real gems:
RESOLVE-stage options on `clearAt` (`ignoreResistance`, `flattenFalloff`,
`overflow`, `kickback`, `priming`); projectile behaviour flags (pierce,
fork, chain, bounce, homing, ricochet) generalizing Chain's existing hop
machinery; a weapon registry (`weapons/registry.ts`) driving all seven
weapons from one loop instead of `main.ts` calling each by hand, plus a
deferred-emissions queue for Echo/Barrage — also architecturally what
Trigger (Phase 6I) will need, built here for free; and emission
multiplication (Multishot/Formation) via a shared `emissionAngles()`
helper. All 14 Behaviour gems shipped, plus a bundle card every 5 levels
granting a themed 2–3 gem package.

**The owner's mid-planning correction shaped the whole batch.** Before
committing to 6A-2, the owner pushed back on an early draft that would
have refused Pierce/Bounce/Ricochet on non-projectile weapons: *"lets
revisit the pierce bounce and ricochet gems and think what they could do
if slotted in not projective weapon. You have to be creative and not just
not give the player gems."* The eventual answer: every archetype has its
own analogue of "what stops a hit from doing more" (a hit-cooldown window
for orbitals/rings, the density-resistance curve for pulses/clouds), and
each gem reinterprets against that instead of being whitelisted per
weapon. The one deliberate exception is disclosed, not hidden: Homing and
Multishot/Formation are not wired for Immolation Ring specifically, since
either would desync its persistent ring visual from its actual hit logic
— left as a documented gap, not a silent refusal.

**Two real bugs found during implementation, both by the test suite
before ever reaching the browser** — exactly the outcome the project's
"guard bugs with tests" convention (Decision 20) exists to produce:
- `WeaponDef.stats()` was `(lvl) => string` with no gem awareness, so the
  inventory screen's live stat line silently ignored every socketed gem.
  Fixed by adding a `mods` parameter, threading `weaponMods(state, key)`
  through `ui/weaponRow.ts`. Verified live: Bolt Turret's stat line moved
  from "15 pwr" to "22 pwr" after socketing one Amplifier gem
  (15 × 1.45 = 21.75 → 22).
- `spawnForks()` pushed forked children onto `state.projectiles` while
  `updateProjectiles` was mid-iteration over that same array via
  `for...of`; since the function ends by reassigning
  `state.projectiles = remaining`, every forked child was silently
  discarded. Fixed by having `spawnForks` return its children for the
  caller to push onto `remaining` instead of mutating the live array.

**Verified live, with a documented methodology note.** The Browser pane
was not compositing frames this session (`document.hidden === true`,
confirmed via `document.visibilityState`), which throttles
`requestAnimationFrame` to near zero and makes screenshots time out. Per
Decision 59's own precedent (a deterministic debug harness for exactly
this situation), a temporary `window.__debugTick(n, dt)` /
`window.__debugState()` bridge was added to `main.ts`, used to drive
roughly 700 manual ticks and confirm the full gem pipeline end to end —
socketing, weaponMods, RESOLVE options, projectile flags, deferred
emissions, the Immolation ring visual — then removed completely.
Typecheck, full test pass, and build were re-run after removal; the
production bundle hash was byte-identical before and after the bridge
existed, confirming a clean removal. A final fresh-tab smoke test
confirmed zero console errors and `window.__debugTick === undefined`.

495/495 tests passing (up from 393 — 45 test files, 6 new), typecheck
clean, build clean.

**Not done, deliberately, and recorded rather than silently skipped:**
Fork/Chaining/Bounce/Ricochet are real (not placeholder) only on the
`projectile` archetype — extending them to report per-target kill events
on other archetypes would need `clearAt` itself to change, a larger
change out of scope for "make gems mean something," not a refusal.
Immolation Ring's three pre-existing balance gaps (no Overclock/Amplifier
response was two of the three — **both now closed** by `weaponMods`
applying uniformly; the still-open third is the missing `WEAPON_DAMAGE_SCALE`
+50% pass from Phase 4C-1, deliberately left for 6B alongside Immolation's
real extensions) — see BACKLOG.

**Committed and pushed.**

**Planned** — **Phase 6B** next (real extensions for the seven incumbent
weapons, Immolation Ring's remaining `WEAPON_DAMAGE_SCALE` gap and
`maxLevel` dead-field cleanup), then the Phase 5 gate.

### 2026-08-09 — Phase 6 reviewed and re-planned; Phase 6-0 ships

**Full account:** `docs/plans/phase-6-roadmap.md` (the re-plan, its five
findings, and the owner's four settled calls) and
`docs/plans/phase-6-0-weapon-select.md` (6-0's own plan, tests,
order-of-work, and "what changed during implementation").

**Shipped:** the pre-run weapon-select overlay — `ui/weaponSelect.ts`
(new), `ui/weaponRow.ts`'s `'select'` mode filled in, `ui/overlays.ts`
wiring `Choose Weapons`/`Change Loadout` and the deck-icon lines,
`main.ts`'s `startRun()` reading the chosen deck instead of a hardcoded
kit. The `newWeapon` `CardChoice` kind deleted outright from
`systems/cards.ts` and `ui/upgradeCards.ts`. 393/393 tests (4 new),
typecheck clean, build clean, verified live in-browser end to end.

**Discussed and decided, before any code:** the owner asked for a review
of Phase 6's phasing and a plan for 6-0, with the standing instruction
(reaffirmed this session) to ask questions and get a greenlight before
implementing. The review of `docs/plans/phase-5-6-arsenal.md` §13's
phasing table, done against **shipped** Phase 5 code rather than the
design it was written against, found two structural gaps and one live
consequence:

1. **Four built weapons (Blades, Frost, Missile, Immolation Ring) were
   unreachable in any run.** `startRun()` always filled the deck exactly
   (3 of 3 slots) and the `newWeapon` card's only gate was a free slot
   that could never exist — both halves individually correct, an
   interaction neither the 380 nor 389 tests caught, because the
   deck-full case is exactly what the gating test asserts should offer
   nothing.
2. **Extensions were scheduled nowhere.** The §13 table has only
   "Gems:" and "Weapons:" batches; the seven existing weapons appear in
   no batch at all, so their 21 extensions (half of what a socket can
   hold, per arsenal plan §5) had no home under any phasing.
3. **Three batches were too large to playtest independently** — old 6D
   carried two new subsystems, old 6F carried all six of the catalogue's
   expensive-to-render transformative gems.

**The owner settled four questions in one pass**, and the fourth
answered more than it asked. Asked whether a pre-run deck must fill
every slot, the owner's answer set the whole surrounding design: *"All
of the slots equipped... there is no way to change weapons mid-run. And
the player should not be offered any weapons in the pool — only
weapon-specific extensions... support gems and core gems."* This
reclassified finding 1 from a bug to missing UI — a full deck was always
correct, the pre-run screen was the missing piece — and it **supersedes**
one clause of arsenal plan §5 (*"an unlocked slot is optional to use"*),
recorded as a deliberate, clean supersession per `CLAUDE.md`'s
ground-truth protocol. The other three: the Phase 5 gate moves again
(from after 6A to after 6B, since it needs both socket-fillers real to
mean anything), a new **6B** batch is added for the seven incumbents'
extensions, and Immolation Ring's three long-open balance gaps (no
Overclock/Amplifier response, missing the 4C-1 damage pass) get fixed in
that same batch rather than carried further.

**Phase 6 is now nine batches** (6-0 through 6I) instead of six, with no
change to the 18-weapon/65-gem catalogue itself — only re-sequencing and
one added batch. Full table: `docs/plans/phase-6-roadmap.md` §3.

**Verified live**, not just by the test suite: every weapon row renders
and is selectable; the capacity refusal actually refuses a click on a
disabled checkbox; a genuinely non-default deck (Chain/Poison/Immolation
Ring) equipped, rendered its weapon-tray chips and in-game visuals
correctly, and survived `Try Again` into a fresh run; the level-up card
pool offered only extensions and a core gem for that deck, no weapon
card anywhere; `Change Loadout` opened pre-checked with the run's actual
deck and `Back` returned to the game-over screen rather than the start
screen; the pre-existing 5C inventory screen (sharing the same
`renderWeaponRow`) showed no regression. One run of testing crossed the
project's own documented Vite self-reload quirk mid-session (BACKLOG) —
recognized from its signature (a duplicate `[vite] connecting/connected`
pair) and re-verified cleanly afterward, not mistaken for a new bug.

**Committed as `feb01b9`** and pushed, after the owner reviewed the
report — the instruction during the build itself was to report when 6-0
was achieved, not to commit, so the commit came in a second step.

**Planned** — **Phase 6A** next (Amplifier + Behaviour gems, deleting the
legacy `damage`/`atkSpeed` passives in the same batch), per the
re-planned order. No blockers. *(Shipped the same day — see the entry
above.)*

### 2026-08-08 — Phase 5C: the pause + inventory screen ships. Decision 72. Phase 5 closes.

**Full account:** `docs/plans/phase-5c-inventory-ui.md` — status header,
§8's order-of-work table, the two notes at the bottom on the
`withdrawPoints` bug and the sub-baseline-at-0-points observation.

**Shipped:** `WeaponDef.stats(lvl)` (terser than `desc`, for a live
per-weapon readout); the inventory overlay with a HUD-button opener and a
"Manage Loadout" button inside the level-up card screen, `main.ts`
tracking which entry point opened it so closing returns to the right
place; `+`/`−` wired to `investPoints()`/`withdrawPoints()`, disabling
exactly at the enhancement-pool-empty and extension-clamp limits; socket
dots that visibly grow with investment; a core-gem row; `ui/weaponRow.ts`
as a shared renderer with 6-0's `'select'` mode scaffolded in.

**Found and fixed a real bug in 5B's own plumbing**: `withdrawPoints()`
removed points from a weapon but never credited them back to
`enhancementPool` — inert while nothing called it in 5B, a genuine bug
the moment 5C's `−` button became the first live caller.

**Verified live**, directly in the browser via DOM interaction (not just
the debug harness): the full open/close cycle from both entry points;
`+` raising points, stats and socket count simultaneously; the socket
dots growing from 1 to 2 exactly at the 3-point threshold; `−` disabling
correctly against a committed extension; a core gem socketing and
rendering; the manage-loadout round trip leaving `pendingLevelUps`
untouched. Zero console errors. 389/389 tests, typecheck clean, build
clean, bundle byte-identical after the debug bridge's removal.

**Phase 5 is complete — 5A, 5B, 5C, no outstanding items.** The Phase 5
gate moved to after 6A (settled during 5C's planning): it can't judge
"is enhancement a decision or a slider?" while sockets are empty, since
opening a socket buys nothing without gems to put in it. **Next: Phase
6-0**, a minimal pre-run weapon select.

### 2026-08-08 — Phase 5B: the enhancement/socket/card-pool economy ships. Decision 71.

**Full account:** `docs/plans/phase-5b-framework.md` — status header,
§7's order-of-work table, §5.

**Shipped:** weapon-level cards deleted outright (Decision 40, finally
implemented); enhancement points bank globally at 1/level, spendable once
5C's `+/-` ships; the 0/3/8/15/24 socket ladder as a pure function; new-
weapon cards gated on free deck slots; extensions level 1→3 then leave
the pool **permanently** (the owner's rule, better than either option
offered); core gems — five of the seven existing passives ported onto 3
fixed sockets with duplicates disallowed, `damage`/`atkSpeed` deliberately
left on the old mechanism since they become per-weapon gems in 6A, not
core gems; a guaranteed core-gem card slot every second level-up with an
exhausted-pool fallback; `pickThree`'s biased shuffle replaced with an
unbiased Fisher-Yates; gem inventory and a no-destructive-respec
withdrawal function (extensions clamp rather than ever being destroyed,
since no extension-inventory exists to return them to); the render
structural pass flagged during the owner's UI/UX question — `OrbitalVisual`
gained appearance data, `state.novaFx` became a list, fixing a latent
overwrite bug before a second pulse weapon could trigger it.

**Card-pool logic moved to `systems/cards.ts`, pure and tested** —
`ui/upgradeCards.ts` is now a thin DOM wrapper, this project's existing
systems/render split applied to a UI module for the first time.

**One planned piece withheld: assist credit.** Implementing it found the
mechanism doesn't solve the problem it was written for — XP is a single
global pool, not tracked per weapon anywhere, so any kill by any weapon in
a deck already pays full credit today. Raised for the owner rather than
built or silently dropped, per the ground-truth override protocol —
`docs/plans/phase-5b-framework.md` §5 has the full reasoning. **Confirmed
dropped by the owner later the same session** — *"it's fine to drop
assist credit if the player will still get the XP after the mass is
dead"* — and moved to `docs/BACKLOG.md` *Ideas*.

**Verified live**: an 8-level card-pool dump confirmed the core-gem
cadence and the permanent absence of any weapon-level card; applying
cards directly confirmed a core gem socketing correctly (maxHp: +20 and
a matching heal) and an extension vanishing from the pool once maxed; a
425-second/58-level random-pick soak test on all seven weapons at max
level ran with zero console errors, filled all three core sockets with
no duplicates, and left the production bundle byte-identical once the
debug bridge was removed. 380/380 tests, typecheck clean, build clean.

**Next: Phase 6-0**, a minimal pre-run weapon select — settled during
this session's UI/UX discussion, moved forward from Phase 7 so Phase 6's
weapon batches are playtestable by the owner rather than only through the
debug harness.

### 2026-08-08 — Phase 5A: the weapon pipeline ships. Decision 70.

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

**Phases 3, 4, 5, 6-0, and now all of 6A (including the 6A-3 fix batch)
are complete, no outstanding items.** 3A/3B/3C shipped 2026-08-06 (plus a
playtest-and-fix round), 3D/4A/4B/4C-1/4C-2 all on 2026-08-07, 5A/5B/5C
all on 2026-08-08, 6-0, 6A-1, 6A-2 and 6A-3 all on 2026-08-09 — see the
*Session log* above. Read the session records before assuming a new
formula's first draft is right; every phase so far has found at least one
real bug only by running the game.

**Assist credit (5B-5) was dropped, confirmed by the owner** — XP is a
global pool with no per-weapon tracking, so any kill already pays full
credit. Moved to `docs/BACKLOG.md` *Ideas*.

**5C built the screen that makes 5B's economy usable**, and found a real
bug doing it: `withdrawPoints()` removed points from a weapon but never
credited them back to the bank — inert in 5B with no live caller, a
genuine bug the moment 5C's `−` button became one. Fixed as part of
wiring it.

**6A built the first real gems** (6 Amplifier, 14 Behaviour) and found two
more real bugs the same way (see the 2026-08-09 session log entry above:
`stats()` ignoring gem mods, `spawnForks()` discarding children into a
mid-iteration array).

**The owner playtested 6A the same day and found the loop had three real
breaks** — the XP curve stopped scaling against DPS, the card pool went
dead once sockets filled, and the socketing UI was unclear enough to look
broken. **6A-3 fixed all three** and, per the owner's request for a
three-section inventory, turned it into a banking pass: extensions and
core gems now bank like gems always did, with click-to-place UI replacing
the old undersized socket dots. A real exploit was caught and closed in
the same batch — unsocketing a `maxHp` core gem now clamps `hp` down
instead of leaving it able to float above the reduced max. See Decision
76, `docs/plans/phase-6a3-loop-fixes.md`, and
`docs/sessions/2026-08-09-post-6a-playtest-and-6a3.md`.

**Next is Phase 6B** — real extensions for the seven incumbent weapons,
plus Immolation Ring's remaining `WEAPON_DAMAGE_SCALE` balance gap and its
dead `maxLevel` field. Then **the Phase 5 gate**, which needs both
socket-fillers (gems and extensions) to be real content before "decision
or slider?" means anything.

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
| **5B** | ✅ Enhancement points, socket ladder, restructured card pool, core gems, gem inventory, render structural pass (Decision 71). Assist credit dropped — moved to BACKLOG *Ideas*. |
| **5C** | ✅ Pause + inventory UI (Decision 72) — +/- spending, live stats, socket dots, core row, manage-loadout round trip. Found and fixed a real `withdrawPoints` bug from 5B. **Phase 5 complete.** |
| **6-0** | ✅ Pre-run weapon select (Decision 73) — the deck fills every slot, fixed for the run; the card pool never offers a weapon. |
| **6A-1** | ✅ Gem foundation (Decision 74) — `DeliveryKind` archetypes, `weaponMods`, six Amplifier gems, sockets/inventory, DPS readout, legacy passives deleted. |
| **6A-2** | ✅ Behaviour class (Decision 75) — RESOLVE options, projectile flags, deferred emissions, emission multiplication, 14 Behaviour gems, bundle card. Immolation Ring's visual fixed in the same batch. |
| **6A-3** | ✅ Loop fixes from the post-6A playtest (Decision 76) — geometric XP curve, socket/ownership-blind card pool, extension + core-gem banking, three-section click-to-place inventory panel, the maxHp unsocket exploit closed. **Phase 6A complete.** |
| **6B** | Real extensions for the seven incumbent weapons; Immolation Ring's remaining `WEAPON_DAMAGE_SCALE` gap and dead `maxLevel` field → **next up** |
| **▶ THE GATE** | **Moved here from after 5C** on 2026-08-08, then to after 6B on 2026-08-09 — needs both socket-fillers (gems *and* extensions) real before "decision or slider?" means anything. |
| **6C–6I** | Remaining arsenal content — 18 weapons, 65 gems total. **Design session done** (`docs/plans/phase-5-6-arsenal.md`, revision 3); phasing per `docs/plans/phase-6-roadmap.md` §3. |
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
