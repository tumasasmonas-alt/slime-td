# Slime TD — Backlog

Bugs, TODOs, and ideas in one list.

**How to use this file:**
- Add anything discovered-but-not-fixed here rather than leaving it in a
  conversation. If it's worth saying out loud, it's worth a line here.
- Each entry says enough to act on it cold — what, where, and why it
  matters — not just a title.
- Remove an entry when it's genuinely fixed, not when it becomes
  inconvenient to look at. Move it to **Done** with a date if the
  resolution is worth remembering.
- Design *decisions* belong in `docs/DECISIONS.md`, not here. This file
  is for work that hasn't happened yet.

**Priority tags:** 🔴 blocking · 🟡 should do · 🟢 nice to have ·
💭 unvalidated idea

---

## Now

### 🔴 Playtest gate — Phase 3C is built, awaiting the project owner's verdict

Phase 3C (Coagulants Wave 1) shipped 2026-08-06 — see BACKLOG's Done
section and `docs/PROGRESS.md`'s session log for what landed. This is the
first playtest gate in the rework (2026-08-05 record §17): the point
where the game becomes "the new game" and the first honest feedback on
whether the horde reads as intended actually happens. Not a decision
Claude can make solo — needs the owner playing it.

**What to watch for at the gate**, since every number is a first guess:
arrival speed and mass (the agreed tuning dials, Decision 27), whether a
behemoth crossing the arena reads as dramatic or tedious, whether the
conservation rules feel right in practice (motes shouldn't chain into
behemoths — Rule 4). The design rework is agreed end to end (DECISIONS.md
#23–#53). Reasoning lives in two session records:
`docs/sessions/2026-08-05-slime-and-arsenal-rework.md` (what the game is)
and `docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md` (how it
works).

### The rest of the phase plan

Full detail in the session record §17.

| Phase | Content |
|---|---|
| **3B** | ✅ Infection Events framework — vein + bloom, full lifecycle |
| **3C** | ✅ Coagulants Wave 1 — conservation rules, Mote/Congealer/Behemoth → **playtest gate, awaiting the owner** |
| **3D** | XP economy rework (the value-cap removal already landed in 3C — see BACKLOG Done) → **playtest gate** |
| **4A–4C** | Maturity field, two-axis visuals, Coagulants Wave 2 → **playtest gate** |
| **5** | Arsenal framework — slots, gems, inventory UI, passives dissolved |
| **6** | Arsenal content — **own design session first**, then toward 20 weapons |
| **7** | Meta — currency, unlocks, deck builder |
| **8** | Terminal phase, real balance pass, leaderboard |
| **9** | VFX and feel |

### 🟡 Balance pass — moved to Phase 8

Was Decision 13's "next step before all other work"; **superseded**. The
playtest found the problem is not numeric: player power scales 17–21×
across a run while the infection scales 3.1×, so no single value of
`CONTACT_SCALE` can be right at both ends. Tuning constants against a
threat model that is about to be replaced would be wasted work.

Balance math from 2026-08-05 preserved in the session record §3, including
the weapon DPS table (Blades 534 DPS vs Frost 17 DPS at level 8 — a 31×
spread), the Blades/Chain count-and-damage double-dip, and the hidden XP
distortion where gems track *hit count* rather than damage.

Still true and still unvalidated when the pass happens: `CONTACT_SCALE`,
`CREEP_RAMP`, and the fact that every run generates a fresh maze
(Decision 10) so runs are **not directly comparable**. A fixed-seed debug
option is the fix if that bites — don't reuse the field.

---

## Bugs and known limitations

### Found in the 2026-08-05 playtest — all absorbed by the rework

**None of these are worth fixing before their phase.** Every one sits
inside a system being replaced; fixing now means fixing twice. Listed with
the phase that absorbs each.

| Bug | Absorbed by |
|---|---|
| **Card descriptions read as "this does nothing."** Not a pool-filter bug — `buildCardPool()` filters maxed upgrades correctly. `frost`/`poison`/`missile` have *static* descriptions (`desc: () => '...'`, no level argument), and `bladeCount(7) === bladeCount(8) === 4` because the `min(…, 5)` cap is never reached at `maxLevel: 8` (same for `chainCount`, capped at 6 but topping out at 5). So a card correctly grants a damage increase and tells the player nothing changed. | Phase 5 — **killed at the root** by Decision 40: weapon *level* cards stop existing, so the failure mode has nowhere to live |
| **Ward Pulse has no visual whatsoever.** No `render/ward.ts` exists; `updateWardPulse` calls `clearAt` and nothing else. | Phase 5/6 — Ward becomes a gem |
| **Frost Nova's ring is nearly invisible.** 3px stroke, 0.4s life on a 3.6s cooldown (~11% uptime), fading alpha, low-contrast `#bfe9ff`. Also an expectation gap: it reads as an "aura" but is coded as an instantaneous pulse. | Phase 9 |
| **Frozen cells have no visual at all.** Confirmed by grep — zero references to `frozen` in `src/render/` or `grid/slimeLayer.ts`. A 2-second growth-suppression mechanic the player can never see. | Phase 4B |
| **Density palette collapses.** 5 buckets read as ~3: `#5c2430`/`#8a2f42` are both dark maroons, `#ff3f68`/`#ff7590` both bright pinks. Matters because density drives a ~10× resistance swing — it's a tactical readout the player can't read. | Phase 4B |
| **Screen shake fires only on contact damage.** Nothing else in the game shakes. | Phase 9 |
| **`pickThree` uses a biased shuffle** — `sort(() => Math.random() - 0.5)` is not a uniform permutation, so card appearance rates are skewed. | Phase 5 |

**Process finding:** Decision 11 established "a weapon's signature visual
is part of the weapon, not polish." Ward Pulse slipped through because
it's classed as a *passive*, and freeze slipped through because it's a
*field state*. **The rule should be scoped to any mechanic with a
world-space effect, not just weapons.**

### 🟡 Difficulty plateaus after Apocalypse (t = 560s)
`tuning/tiers.ts` has five tiers and stops escalating at the last one. A
strong build can coast indefinitely past ~9 minutes with no further
pressure.

**Superseded in approach, not in substance.** The rework removes the tier
table as a difficulty mechanism entirely (Decision 33) and replaces it
with emergent pressure plus a terminal phase (Decision 34). The plateau
still needs solving — Decision 35's currency model depends on runs
actually ending — it just isn't solved by extending the tier curve any
more.

### 🟢 `.nvmrc` and the installed Node disagree
`.nvmrc` pins 22.12.0; the work machine runs 24.19.0. `package.json`
engines (`^20.19.0 || >=22.12.0`) permits both and everything builds
clean, so this is cosmetic — but the two files contradict each other and
one of them should move.

### 🟢 `bladeNextHit` keying is fragile
Keyed by blade index (0..count-1) in `state.ts`, never cleared when blade
count changes on level-up.

**Assessed during 2E-2, confirmed not currently exploitable:**
`bladeCount(lvl)` is monotonic non-decreasing and level only ever rises
within a run, so the index range only grows, existing slots' cooldowns
stay meaningful, and no index is ever reused for a different physical
blade. Latent, not live. It would only bite if a future upgrade path let
blade count *decrease*, or made a slot index mean something different
(e.g. per-slot upgrade variation). Fix when one of those lands.

### 🟢 Slime layer renders at 1× with no user control
World resolution regardless of display density, so on a 4K screen it's
upscaled and soft. Deliberate (Decision 2) — the softness may read as
"organic tissue" rather than "low-res," but that's untested on real
high-DPI hardware. If it does bother, the preferred fix is a **user-facing
resolution slider** (backing-store scale for the slime layer) rather than
a hardcoded higher multiplier, since a slider doubles as a performance
escape hatch on weak GPUs.

### 🟢 Vite dev server occasionally self-reloads
Shows up as a duplicate `[vite] connecting/connected` pair in the console
and bounces the page back to the start screen mid-session. Observed
repeatedly across sessions, never correlated with anything in the game
code. A tooling artifact — noted so it isn't mistaken for a game bug
during playtesting.

### 🟢 `veinField.test.ts` variance test is occasionally flaky
The "stays finite with real spatial variance" case uses unseeded
`Math.random()` for reaction-diffusion seed placement, and occasionally
lands on a configuration that relaxes to a near-flat field on a 40×40
grid, failing the variance assertion. Passes on rerun. The *canary* half
of that suite (proving divergence-to-NaN is detectable) is unaffected and
reliable. Fix by seeding the RNG for tests if it becomes annoying.

---

## TODO — planned work

### 🟡 Per-variable weapon upgrade tiers — absorbed into Phase 5
The original idea (separate upgrade paths per variable — Chain Bolt gets
more hops *or* more bolts *or* shorter cooldown as distinct choices) is
now the **extensions half of the PoE-style arsenal framework**
(Decision 32). Weapon data already lives in one central library
(`tuning/weapons.ts`, Decision 1) specifically so this expansion is one
file to edit.

`towerCenteredRadius()` (Decision 16) was built with a `base + perLevel`
term precisely so **range can become an upgradeable variable** rather than
being welded to the perimeter. Still the hook for a range-upgrade path —
and note Decision 26 makes range a genuinely *double-edged* stat, since a
wider engagement zone means a wider scar ring and more armoured spawns.

### 🟢 VFX and game feel — Phase 9
Deferred deliberately; shaping the game comes first. Running list beyond
the bug table above:

- Shake on missile impact, nova pulse, coagulant death, arrival, and tier
  escalation — currently contact damage is the only source.
- **Level-up has no moment** — the card overlay just appears. No flash, no
  time dilation, no sound.
- **Tier escalation should be a dramatic beat**, not a line of HUD text.
- Hit flash on cleared cells; gem pickup pop; low-HP vignette or
  chromatic pulse.
- Coagulant formation visual (tell → drain → rise → detach → crater) is
  **not** in this list — it's the telegraph system and ships with Phase 3C.

### 🟢 Audio
Web Audio is in the stack per `CLAUDE.md` but nothing is built — the
prototype had zero sound, so there was nothing to port. Out of scope until
the loop feels right. Worth noting the game currently has *no* audio
feedback at all for hits, level-ups, node spawns, or taking damage, which
is a meaningful chunk of game feel left on the table.

### 🟢 Leaderboard / Firebase
Planned per `CLAUDE.md`, not started. Depends on first deciding what a
"run" and a valid score even are — which needs balance and the
endless-scaling tail to exist, since right now a strong build can plateau
forever and post an arbitrarily large time.

### 🟢 GitHub Pages deploy is dormant
The Actions workflow (`.github/workflows/deploy.yml`) is wired up but
inactive: Pages on a private repo needs a paid plan, and the repo is
private. Nothing to do until you're ready to share the game — flagged so
it isn't a surprise on launch day.

---

## Ideas — not committed

### 💭 Genuine pathfinding for vein geometry
*Raised by the project owner, 2026-08-06, during the 3B review.*

Veins currently generate a jagged branching polyline via recursive
midpoint displacement — a lightning-bolt construction, unrelated to the
field's own terrain (Decision 49). The owner's original instinct was that
a vein should genuinely route through the coral maze pattern
(`grid.vein`/`veinField.ts`) rather than draw an independent shape over
it — "the infection follows its own veins" as a thematic idea, not just a
visual one.

**Why it didn't ship now:** the coral pattern is a static texture with no
traceable edge-to-core routes baked into it — turning it into a graph
means either a real pathfind (A* or similar over low-threshold cells) or
a corridor-following walk, and either way there's no guarantee a route
exists at every possible spawn angle. The lightning-bolt approach ships
today with zero risk of failing to find a path and produces the branching
lattice Blastoma (Wave 2) needs for free.

**Worth exploring later:** blend the two — bias the recursive
displacement's midpoint offsets toward locally low-threshold cells (dense
coral) instead of pure randomness, so the vein still can't fail to reach
the core but visibly prefers to travel along the existing pattern. Cheaper
than real pathfinding and keeps the "no path exists" failure mode
impossible by construction. Not blocking anything; revisit whenever the
vein's current look feels too generic against the field it's punching
through.

### 💭 Spontaneous coagulation — an anti-boredom floor
*Raised by the project owner, 2026-08-06. Agreed as an idea, deliberately
not a decision.*

Decision 28 makes infection events the **only** trigger for coagulant
formation. The owner's concern: veins and blooms rotate on a timer, and any
timer-driven system has dead air by construction, so a run could have long
stretches where nothing forms and nothing happens. A rare random spark
would set a floor.

**The framing that keeps it compatible with Decision 28:**

> Events set the rhythm. Spontaneous sparks set the floor.

It must never be a meaningful *fraction* of what spawns — only a minimum
below which the arena is never silent.

**Why it is dangerous.** It is Decision 28's problem restated: the
wilderness is ~76% of the arena and saturates in ~46 seconds, so anything
letting standing mass self-ignite at scale gives behemoths on tap from
minute one. That arithmetic does not change because the trigger is random.

**Guard rails agreed if it gets built:**
- A hard **global rate limit**, never a per-region probability — per-region
  probability times a large saturated wilderness is exactly how the failure
  happens.
- The **same bounded flood-fill mass check** as event formation, so a spark
  can never produce anything larger than the local field justifies.
- A **bias toward distant sites**, so it reads as a long dramatic charge
  rather than an ambush the player could not have anticipated.

Cheap to add once Decision 43's coarse density index exists. Revisit after
the 3C playtest, when it's clear whether dead air is actually a problem.

### 💭 "Orbital trade ship" — buying specific gems with score points
*Raised by the project owner, 2026-08-06.*

A deterministic escape hatch against card RNG: the player spends score
points to buy the gem they actually want, rather than waiting for the pool
to offer it.

**The problem it solves is real and sharper than pool size.** With gems
universally live once unlocked (Decision 41), the worry isn't that the pool
is too big — it's *bad luck*. Never being offered armor penetration in a
run where a Sclerotic is the thing killing you is a frustrating way to
lose, and it is not a loss the player could have played around.

Needs its own design pass before it's a decision: what score points are and
how they're earned, whether they compete with meta-currency (Decision 35's
survival-time currency) or are a separate in-run resource, and whether the
shop appears mid-run or between runs. Belongs with Phase 6/7.

### 💭 Filter the card pool by equipped weapons
The fallback if the gem half of the pool dilutes badly as the gem catalogue
grows (Decision 41's recorded consequence — fine at 15 gems, a problem at
60). Cards would only offer gems that fit a weapon actually being run.
Preferred over restricting unlocks, which would cost the emergent-build
discovery that made gems universal in the first place. Not needed until the
catalogue is large.

### 💭 Fixed-seed debug mode
Would make balance runs directly comparable (see the note under *Now*).
Small, and probably worth building *as part of* the balance pass rather
than before it.

### 💭 Explicit per-tier node spawn distance
Currently spawn distance is derived from `safeRadius` and tightens
automatically as tiers escalate. An explicit lever would allow sharper
escalation, but stacking it on top of the automatic shrink *and* the
damping bypass risks overshooting. Only if the balance pass shows nodes
aren't threatening enough.

### 💭 Make the safe zone shrink continuously rather than in tier steps
Raised during the safe-zone discussion, not pursued. Might read as more
relentless than discrete jumps. Purely speculative.

---

## Done

Kept short — for resolutions whose *reasoning* is worth remembering.
Anything that's just "built the thing" lives in git and PROGRESS.md.

- **Resize used to mean "see more world."** *(Phase 1)* The prototype sized
  its grid to the window, so a wider monitor was a measurably easier game
  and a mid-run resize couldn't be handled without rebuilding the grid.
  Replaced with a fixed 1920×1080 world and fit-to-window camera — every
  player gets an identical arena, and resizing changes only camera scale,
  never the simulation.

- **Upgrade cards gave no visible confirmation of what they changed.**
  *(Phase 2D, found in the first human playtest 2026-08-05)* A pick
  applied correctly but nothing on screen showed it — passives especially,
  since the weapon tray only ever displayed weapons. Fixed with the
  always-visible modifier readout in `ui/hud.ts`, which reads
  `systems/passives.ts`'s existing multiplier functions as its source of
  truth, so it can't drift from actual behavior.

- **Three prototype bugs fixed at port time** rather than ported and
  cleaned up later: `novaFx` frame-rate-dependent decay, the
  double-level-up card overwrite, and `bubbleSeeds` being created during
  render. All three were the same class — state mutated during a draw call,
  or a UI rebuild racing itself. See DECISIONS.md #4 and #7.

- **Orbiting Blades could never hit ambient infection.** *(Found in the 2E
  review, fixed in 2E-1/2E-2a)* Orbit radius was smaller than the smallest
  safe radius the game ever reached, so the weapon was structurally
  incapable of connecting with anything except node-pushed density — at any
  tier, any level, any run. Now prevented structurally by
  `towerCenteredRadius()` plus an invariant test. See prototype bug #5 in
  DECISIONS.md.

- **Phase 3A — Teardown.** *(2026-08-06)* Growth nodes removed entirely
  (`systems/nodes.ts`, `tuning/nodes.ts`, `render/nodes.ts`, node targeting
  in `poison.ts`/`missile.ts`, node damage in `clear.ts`). `safeRadius`
  renamed to `perimeter` throughout and fixed as a constant (Decision 38).
  `TIERS_LIST` demoted to name/t/color only; the mechanical values it used
  to carry moved to their own owners — ambient escalation is now its own
  time-driven curve and contact damage no longer scales by tier at all
  (Decision 47, found mid-implementation — the original plan only accounted
  for the perimeter). 136/136 tests passing (down from 153 — `nodes.test.ts`
  removed, node-dependent cases pruned from six other files), typecheck and
  build clean, verified live in-browser (level-up, card picks, and Homing
  Missile's now-fixed description all confirmed working with no console
  errors).

  **Left deliberately incomplete, both by explicit instruction — both
  closed out by Phase 3C, below:**
  - ~~Homing Missile no longer homes onto anything~~ — resolved for free
    once `nearestFrontierPoint` gained a coagulant surface pass (Decision
    45); missiles now home on coagulants without any missile-specific code.
  - ~~The kill counter (`nodesPurged`) is dormant~~ — wired to coagulant
    kills in `splatterOnDeath`.

- **Phase 3B — Infection Events.** *(2026-08-06)* One system, two variants
  (Decision 29), sharing a lifecycle: telegraph -> active -> peak -> decay
  -> removed (`systems/events.ts`, `tuning/events.ts`, `render/events.ts`).
  Vein geometry is a branching polyline built once at telegraph time via
  recursive midpoint displacement — the standard lightning-bolt
  construction — rather than the originally-sketched `veinField` reuse,
  which turned out to be a texture with no traceable edge-to-core routes in
  it (Decision 49). Bloom ships now despite its real payload (accelerating
  maturity) waiting for Phase 4A, so the event framework has one lifecycle
  from day one instead of a second variant bolted on later (Decision 48,
  the project owner's call: "build it now"). Growth injection for both
  reuses the existing "read density, converge toward 1, update
  bucket/dirty" shape from `applyAmbientGrowth`/the old node influence —
  events are just another source writing into the same grid.

- **Phase 3C — Coagulants Wave 1.** *(2026-08-06)* The identity change
  lands: coagulants (`state.coagulants`) form from infection events at
  peak, walk a straight line to the core, and either get killed or arrive.
  New modules: `systems/formation.ts` (bounded flood-fill),
  `systems/coagulants.ts` (movement/arrival/death/collision),
  `render/coagulants.ts` (seed-circle blob rendering), `tuning/coagulants.ts`.

  **Mass is one currency in two containers, exactly as Decision 42
  specified.** Coagulants carry `mass` and nothing else as HP — `clearAt`
  (`grid/clear.ts`) gained a second loop damaging coagulants via
  hit/body overlap area (`circleOverlapArea`, `util/math.ts`) rather than a
  flat per-weapon constant, so a wide splash weapon genuinely excels
  against big targets and a precise weapon isn't wasted on a mote inside
  its blast (Decision 50). Two damage dials: `COAGULANT_DAMAGE_SCALE`
  (global, the requested support-gem hook) and `WeaponDef.coagulantMult`
  (per-weapon, defaulting to 1 but actually *read* by every weapon's
  `clearAt` call — not just some of them, so a future edit to the field
  can't silently do nothing).

  **Collision needed its own pass beyond damage math.** Coagulants are
  entities, not grid cells, so `isRevealedIdx`-gated collision (bolt,
  chain, missile, blades) couldn't see them at all — each gained an
  explicit coagulant check alongside its grid check
  (`findCoagulantHit`/`systems/coagulants.ts`). This is also what restored
  Homing Missile's homing, for free, once `nearestFrontierPoint` started
  returning coagulant surfaces too (Decision 45).

  **Arrival deposits mass by growing outward until it all fits** (Decision
  51), not a fixed disc — grid cells cap at 1, so a large arrival needs
  real area or it evaporates. Verified as an exact invariant: total mass
  (grid + entities) returns to where it started across a full
  formation → transit → arrival cycle with no combat involved
  (`systems/coagulants.test.ts`).

  **The XP value cap was pulled forward from Phase 3D**, per the project
  owner's agreement during planning — `gemValueFromRemoved`'s
  `clamp(…, 0, 10)` is gone, so a 20-second behemoth kill doesn't pay the
  same as a routine bolt hit. The rest of Decision 31 (superlinear curve,
  gem showers, risk premium) stays in 3D.

  **Two bugs caught during the live verification pass, not by the test
  suite** — recorded because the class matters as much as the fix:
  - The flood-fill's radius cap used a Chebyshev (square) bound; against
    a saturated field it produced a crisp square crater on screen, which
    no mass-summing unit test could have caught. Fixed to true Euclidean
    distance (Decision 52).
  - Folded in per the project owner's request: 3B's vein rendering put a
    round cap on every segment joint (a string of beads, not a bolt) —
    fixed to one continuous stroked path for the trunk and tapered
    per-segment strokes for branches, so branches end in genuine points
    (Decision 53).

  217/217 tests passing (up from 165 across `formation.test.ts`,
  `coagulants.test.ts`, and extensions to `clear.test.ts`,
  `frontier.test.ts`, `projectiles.test.ts`, `blades.test.ts`,
  `math.test.ts`, `xp.test.ts`), typecheck and build clean. Verified live
  in-browser across several runs: watched coagulants form out of both vein
  and bloom peaks, walk toward the core, take damage from Bolt/Chain/
  Missile, and a core death from an early arrival — a legitimate first-pass
  balance outcome, not a bug, and exactly what the playtest gate exists to
  surface. No console errors in any run beyond the documented Vite
  self-reload quirk.

  **Left for the playtest gate, not this phase:** every number
  (thresholds, radii, speeds, arrival damage, splatter). Agreed dials:
  arrival speed and arrival mass (Decision 27).

  164/164 tests passing (up from 136 — 28 new: 6 pure-geometry tests for
  the vein polyline, 22 for lifecycle/injection/spawning), typecheck and
  build clean (59 modules, up from 53). Verified live in-browser across two
  runs: watched a vein telegraph faintly, activate and visibly extend
  inward with branches, and inject growth that shows up in the slime layer
  as the vein's own shape; watched a bloom telegraph as a pulsing ring and
  inject a visible radial bump of denser slime. No console errors in either
  run beyond the documented Vite self-reload quirk.

  **Left for the idea backlog rather than built now:** biasing the vein's
  displacement toward the field's own coral pattern instead of pure
  randomness, raised by the owner as "the infection follows its own veins."
  See *Ideas* above.
