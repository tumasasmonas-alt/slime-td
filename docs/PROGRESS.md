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

**Last updated:** 2026-08-06 (Phase 3C shipped — playtest gate)

**The rework's identity change is built.** Phases 3A (teardown), 3B
(Infection Events), and 3C (Coagulants Wave 1) are all built, tested, and
verified live: growth nodes are gone, replaced by veins and blooms that
spark coagulants — Mote, Congealer, Behemoth — which walk to the core, get
damaged through the existing weapon formulas, and either die or breach.
**This is the first playtest gate.** Code is done; the verdict is not —
that needs the project owner playing it, not another verification pass.

| | |
|---|---|
| Tests | 217 passing (32 test files) — one known flake, see BACKLOG |
| Source | 61 modules under `src/` |
| Typecheck | clean |
| Build | clean |
| Branch | `main` — 3C not yet pushed, see below |
| Code state | **Phases 3A–3C complete.** Everything past this gate (4A onward) is still design-only. |
| Blockers | **The 3C playtest gate.** Numbers are first-pass by design — see BACKLOG. |

**What works today:** the horde-economy loop, end to end, for the first
time. Infection grows as a density field across a **fixed perimeter**,
punctuated by **Infection Events** (branching veins, radial blooms) that
inject growth and, at their peak, spark **coagulants** out of whatever
contiguous mass a bounded flood-fill finds. A coagulant is pure mass with
no separate HP — every weapon damages it through the same formula that
clears grid tissue, scaled by how much of the hit actually overlaps its
body. Kill one and it's gone, converted to XP; let one reach the core and
it dumps its full remaining mass as tower damage and a field breach. Six
auto-firing weapons, eight passives via level-up cards, contact damage,
flavour-only tiers, game over, restart with a fresh maze.

**What the playtest found (2026-08-05, pre-rework):** the game was too easy
and structurally so, not numerically. **Player power scaled 17–21× across
a run; the infection scaled 3.1×.** No value of `CONTACT_SCALE` was right
at both ends. Nodes felt bad. XP arrived far too fast. The full findings
and math are in the 2026-08-05 session record.

### ⚠️ Read this before writing any code

**Nothing should be built past this point until the 3C playtest gate
closes.** The next phase (3D, XP economy — mostly already pulled forward
into 3C, see below) is small; 4A (maturity) is not, and building terrain
on top of an unverified horde is exactly the ordering mistake Decision 36
already argued against once.

The agreed direction is a **slime and arsenal rework** — the field becomes
the horde's economy, growth nodes are deleted and replaced by infection
events, coagulants become the threat, passives dissolve into a PoE-style
gem system, and the tier table is demoted to flavour. **Phases 3A, 3B, and
3C are done.**

**Start here, in order:**

1. **`docs/sessions/2026-08-05-slime-and-arsenal-rework.md`** — *what the
   game is.* The full design, the reasoning, the numbers, and §16 *"Ideas
   considered and rejected"*, which will save re-proposing something
   already tested and found broken.
2. **`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`** —
   *how it works.* The layer below: what a coagulant is in code, how
   formation is computed, how armor and the card pool are structured. Also
   has a rejected-ideas table.
3. **`docs/DECISIONS.md` #23–#53** — the load-bearing calls in short form.
   23–37 are the design; 38–53 are the mechanism. #47–53 are
   implementation-time findings from 3A/3B/3C, not from either design
   session — see the note at the top of that section.
4. **`docs/BACKLOG.md`** *Now* section — the playtest gate is the concrete
   next step, not new code. 3A/3B/3C's own follow-ups (coral-biased vein
   geometry, spontaneous coagulation, the orbital trade ship) are noted in
   *Done* and *Ideas*.

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

**Next: the Phase 3C playtest gate — the project owner playing the game,
not more code. Phases 3A, 3B, and 3C shipped 2026-08-06.**

The design is settled end to end, and as of 2026-08-06 so is the
mechanism — all the way through the horde's first playable form. Full
detail in the 2026-08-05 record §17; the concrete next step is in
`docs/BACKLOG.md`'s *Now* section.

| Phase | Content |
|---|---|
| **3A** | ✅ Delete nodes · rename `safeRadius` → `perimeter` (now a fixed constant) · demote `TIERS_LIST` to flavour |
| **3B** | ✅ Infection Events — vein (acts on density) + bloom (acts on maturity — payload deferred to 4A), full lifecycle |
| **3C** | ✅ Coagulants Wave 1 — conservation rules, Mote/Congealer/Behemoth → **playtest gate, awaiting the owner** |
| **3D** | XP economy — mass-based (value cap removal already pulled into 3C), superlinear curve, gem showers, risk premium → **playtest gate** |
| **4A–4C** | Maturity field · two-axis visuals · Coagulants Wave 2 → **playtest gate** |
| **5** | Arsenal framework — weapon/extension/gem slots, inventory UI, passives dissolved |
| **6** | Arsenal content — **own design session first**, then toward 20 weapons |
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
becomes a gem effect rather than a weapon-specific mechanic. Phase 5.

**2. Does calcified tissue block projectiles?** High impact — it would
differentiate whole weapon families and revive the parked Scalpel/Lance —
but the riskiest item in the design, since a crust that neutralises your
main weapon could feel awful. Recommendation: prototype in Phase 4 and
decide from feel. Note Decision 44's armor floor addresses the milder
version of the same risk.

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
