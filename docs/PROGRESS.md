# Progress / Session Handoff

Purpose: pick up work on a different machine without re-deriving context.
Update this at the end of any session that covers meaningful ground.
`git pull` before starting a session; commit and push before switching
machines (per the Workflow section in `CLAUDE.md`).

## Status

- **Phase 0 (scaffold) — done.** Vite + TypeScript + Vitest, GitHub Pages
  base path, dormant Actions deploy workflow (Pages needs the repo public
  or a paid plan while it's private — see docs/KNOWN_ISSUES.md).
- **Phase 1 (world/camera architecture) — done.** Fixed 1920x1080 world,
  fit-to-window camera (uniform scale, letterboxed/pillarboxed, never
  stretched or showing "more world" on a bigger monitor). Typed
  `GameState`/`freshState()`. Tuning constants pulled out of the
  prototype into `src/tuning/`. Working render loop drawing the pulsing
  core. Camera math verified both in unit tests and via direct pixel
  reads in a live browser at 1080p and pillarboxed ultrawide.
- **Phase 2A (grid + reaction-diffusion) — done.** See below.
- **Phase 2B (ambient growth + simulation tick) — done.** See below.
- **Phase 2C (first playable loop) — done.** See below.
- **Phase 2D (danger) — done.** See below.
- **Phase 2E (remaining arsenal) — done.** See below. **The port is
  complete.** Every weapon and passive from
  `reference/slime-td-prototype.html` now has a typed, tested
  implementation. Next: a balance + playtesting pass (decision 13),
  then moving the project's docs and workflow off "porting" and onto
  original development — see the bottom of this file.

  First playtest pass (2026-08-05, before 2D) found the loop plays as
  intended; one real gap logged and then fixed as part of 2D — see the
  2D status below and "Resolved during the port" in
  docs/KNOWN_ISSUES.md.

## Where things live

- `reference/slime-td-prototype.html` — ground truth for exact mechanics
  and formulas. If this and the handoff doc ever disagree, trust the code.
- `docs/PROTOTYPE_HANDOFF.md` — mechanics narrative, exact formulas,
  documented bug history, balance notes.
- `docs/KNOWN_ISSUES.md` — gaps and limitations found *during the port*,
  deliberately deferred. Check this before "fixing" something — it might
  already be a known, intentionally-deferred issue.
- `docs/PROGRESS.md` (this file) — phase status and handoff notes.

## Phase 2 plan

Five-ish sub-steps, each its own commit, each ending in something
verifiable (a test suite, a visual, or both). Ordered by dependency —
each step only builds on things already verified.

- **2A. Grid + reaction-diffusion vein field** — `grid/veinField.ts`,
  `grid/grid.ts`, `grid/slimeLayer.ts`. The highest-risk step: the RD
  diffusion silently diverges to NaN (blank field, no thrown error) if
  `D * step > ~0.25`. Guarded with a canary test that proves the test
  suite would actually catch that regression, not just a happy-path test.
  **Status: done.**
- **2B. Ambient growth + simulation tick** — `systems/growth.ts`,
  `systems/tick.ts`, wiring the slime layer into the real render loop.
  Milestone: infection visibly creeps inward and stops cleanly at the
  safe radius. **Status: done.** Fixed-timestep accumulator
  (`runSimulation`) drives `applyAmbientGrowth` at the real `SIM_TICK`
  cadence, decoupled from render framerate; dirty cells flush to the
  slime layer once per rendered frame, not once per sim tick. A dashed
  safe-radius ring (`drawSafeZone` in `render/background.ts`) was added
  as visual proof the growth gate holds — verified live in-browser that
  infection creeps inward and stays clipped at the ring. Growth nodes,
  frontier targeting, and contact damage are still out of scope here —
  those land in 2C/2D per the plan below.
- **2C. First playable loop ⭐** — `grid/clear.ts` (the density-resists-
  damage core function), frontier targeting (48-sector raycast), Bolt
  Turret, projectiles, particles, gems, XP/leveling, all eight passives,
  upgrade cards, HUD wiring. Milestone: an actually playable game. Plan
  is to **pause here** for real playtesting before building the
  remaining systems on top of it — feel problems are far cheaper to
  catch here than at the end of the port.

  **Status: done.** `grid/clear.ts`, `systems/frontier.ts`,
  `systems/xp.ts`, `systems/gems.ts`, `systems/particles.ts`,
  `systems/passives.ts`, `systems/ward.ts`, `systems/projectiles.ts`,
  `weapons/bolt.ts`, `tuning/weapons.ts` (the shared weapon-data library —
  bolt only for now, per Confirmed decisions), `render/gems.ts`,
  `render/particles.ts`, `render/projectiles.ts`, `ui/hud.ts`,
  `ui/upgradeCards.ts`. Verified live in-browser: Bolt Turret fires at
  the nearest revealed wall, clears density with the documented
  density-resists-damage falloff, drops a gem, the gem drifts in and
  grants XP, and leveling up correctly pauses and shows a 3-card
  upgrade overlay drawn only from what's actually implemented (Bolt
  Turret + the five enabled passives — Vitality/Regeneration/Armor
  correctly absent). 26 new unit tests across the pure-logic modules
  (grid/clear, systems/frontier, xp, gems, passives, ward,
  weapons/bolt); `ui/hud.ts` and `ui/upgradeCards.ts` touch `document`
  directly (no jsdom configured) so they're covered by the in-browser
  verification instead.

  Scope notes from the 2C review (2026-08-05):
  - **Particles** were missing from the original list but are a real
    dependency — `clearAt()`, projectile impacts and gem pickup all
    spawn them, and they carry most of the hit feedback.
  - **Gems ship as pastel-green diamonds here, not in 2F.** The handoff
    doc records that round cyan gems were mistaken for "bullets bouncing
    back to the core" because they looked identical to the Bolt Turret
    projectile — and 2C is the step that ships both together. Shipping
    placeholder circles would walk the one feel-focused playtest
    straight into that documented confusion.
  - **The upgrade card pool must be filtered to what's implemented.**
    With all eight passives in scope this is mostly moot, but the pool
    still must never offer the five unbuilt weapons.
  - **No fail state yet.** Contact damage, growth nodes and game over
    are all 2D, so the playtest can judge carve feel, XP flow and
    upgrade cadence — but nothing about difficulty or balance.
- **2D. Danger** — growth nodes, contact damage, game over. Milestone: a
  complete run with a real win/lose arc. **Status: done.**
  `systems/{nodes,contact,tower}.ts`, `tuning/nodes.ts`,
  `render/nodes.ts`, `ui/overlays.ts` (start + game-over screens),
  restart via a reassignable module-level `state` in `main.ts`, the
  restored node-damage loop in `grid/clear.ts`, screen shake, and the
  modifier readout in `ui/hud.ts` (decision 8, built alongside Armor/
  Regen/Vitality as planned). 24 new unit tests, guarding both
  documented contact-damage bugs as regression tests (ring sampled at
  `safeRadius + 1.5` cells, never closer; gated on `isRevealed`, never
  raw density).

  Verified live in-browser: start screen, a full run with nodes
  spawning/rendering/announcing, contact damage visibly draining HP,
  all eight passives offered and their effects (including the new
  modifier readout and Vitality's `+20 maxHp`) confirmed on pick.

  The initial playtest build (early Armor + Regeneration + Vitality)
  proved tanky enough to survive that whole session without dying, so
  the death -> game-over -> restart transition went unobserved at the
  time — flagged explicitly rather than assumed. **Closed in a follow-up
  pass (2026-08-05):** weapon temporarily disabled and
  `AMBIENT_BASE`/`CONTACT_SCALE` temporarily cranked ~20x/13x to force
  fast overwhelm (never committed; typecheck/tests/`git status` clean
  after reverting). Four full death cycles observed — both "Start Run"
  and "Try Again" correctly reset hp/level/xp/timer/passives each time,
  game-over stats were independently correct per run (never carried
  over), and three visibly distinct vein-field mazes confirmed the grid
  truly regenerates (re-runs the reaction-diffusion) on every restart,
  not a cached/reused field. Zero console errors across all four
  cycles. One unrelated dev-server hiccup observed (an unprompted Vite
  full-page reload mid-session, visible as a duplicate connect/reconnect
  pair in the console) — a tooling artifact, not a game bug.

  Scope notes from the 2D review (2026-08-05) — the original one-line
  bullet understated this step:
  - **Node rendering ships here, not in 2F.** Same class of mistake as
    gem diamonds nearly were in 2C. Per the handoff doc, nodes should be
    the most visually important thing on screen since they're the
    priority target — shipping 2D without `drawNode` (gold pulse,
    influence tint, HP bar) means the playtest can't see the thing it's
    meant to prioritize, or tell whether it's winning against one.
  - **Vitality, Regeneration and Armor Plating get un-gated and built
    here.** 2C deliberately deferred both their card-pool entries *and*
    their numeric effects (see decision 6). That debt comes due now:
    `armorMult` in `systems/passives.ts`, a regen tick, the `+20 maxHp`
    case in `applyUpgrade`, and dropping the `ENABLED_PASSIVES` gate in
    `ui/upgradeCards.ts`.
  - **Damage feedback (`tower.shake`)** is already a field in state but
    nothing sets, decays or renders it. Wiring spans three files
    (`damageTower` sets it, an update pass decays it, render applies it
    as a translate) which makes it easy to drop.
  - **`clearAt` needs its node-damage loop restored** — deliberately
    omitted in 2C with a comment marking it. That also brings
    `destroyNode`, which grants XP (45 + tier*12) and increments
    `nodesPurged`, finally making the already-wired "Purged" HUD stat
    read something other than 0.
  - **Restart requires restructuring `main.ts`** — `state` is currently
    a module-level `const` with no reset path.
  - **"Difficulty tiers" is already done**, ported in 2B. All that
    remains is consuming the two tier fields nothing reads yet:
    `contactMult` (contact damage) and `nodeInterval` (node spawning).
  - **Expect 2D to feel too hard, and don't over-correct.** The
    prototype's balance was bot-validated with all six weapons and eight
    passives; 2D has Bolt Turret alone holding a 360-degree ring, and
    ambient growth reaches the damage ring roughly 20-30s in. Tuning
    `CONTACT_SCALE` down hard here would be tuning against an arsenal
    that doesn't exist yet — 2E swings it back.
  - **Guard the two documented contact-damage bugs with tests**, same
    way the RD instability is guarded by a canary: sample at
    `safeRadius + 1.5` cells (never closer), and gate on `isRevealed`
    (never raw density). Both are listed below and both cost real
    debugging time once already.
- **2E. Remaining arsenal ⭐ (final porting step)** — the other five
  weapons, each shipping complete with its signature visual, data in the
  shared weapon library (see Confirmed decisions). Passives are already
  done — five landed in 2C, and Vitality/Regeneration/Armor Plating in
  2D — so this step is weapons only. Milestone: the prototype is fully
  ported. **Status: done (2026-08-05). Port complete.**

  Landed as five separate commits per Confirmed decision 12, each
  independently typechecked, tested, and verified live in-browser
  before committing:
  - **Orbiting Blades** — `weapons/blades.ts`, `render/orbitals.ts`
    (ninja-star rendering, decision 17), `bladeRadius()` wired to
    `towerCenteredRadius()`. Also closed out Ward Pulse's radius
    (`systems/ward.ts`), the third of the three weapons decision 16
    named. Assessed `bladeNextHit` fragility (docs/KNOWN_ISSUES.md):
    confirmed not currently exploitable since `bladeCount` is
    monotonic non-decreasing in level.
  - **Chain Bolt** — `weapons/chain.ts`, `systems/targeting.ts`
    (`findNearbyRevealedPoint`, distinct from the frontier system),
    `systems/chainFx.ts` + `render/chainFx.ts` for the lightning arc.
    `systems/projectiles.ts` gained its first real per-type branch.
  - **Frost Nova** — `weapons/frost.ts`, `systems/novaFx.ts` (dt-based
    decay per decision 4) + `render/novaFx.ts`. The freeze mechanic
    itself was already live from 2D; this is what fires it.
  - **Caustic Cloud** — `weapons/poison.ts`, `systems/clouds.ts` +
    `render/clouds.ts`. Fixed the second `novaFx`-style anti-pattern:
    `bubbleSeeds` now generated once at cloud creation
    (`state.ts`'s `CausticCloud.bubbleSeeds` made required, not
    optional) instead of lazily inside the draw call.
  - **Homing Missile** — `weapons/missile.ts`, `systems/projectiles.ts`'s
    third and final branch (lerp-based homing, splash on arrival or
    early wall contact). Threads whether the target is a live node
    directly rather than the prototype's `target.hp !== undefined`
    duck-typing.

  67 new tests across the five commits (153 total, up from 104 after
  2E-1). Final live-browser pass equipped all six weapons
  simultaneously — correct card pool with no conflicts, zero console
  errors. `CONTACT_SCALE` and friends are still first-pass numbers;
  the balance pass (decision 13) is next, now finally against the full
  arsenal the prototype's own numbers were validated against.

  Weapons, and what's distinct about each:
  - **Orbiting Blades** — no targeting at all; blades circle the tower
    and damage revealed tissue they pass through. Needs an orbital draw
    pass (which was listed in neither 2E nor 2F — it fell through the
    cracks entirely).
  - **Chain Bolt** — hits the wall, then arcs to nearby clusters at 82%
    damage per hop. Needs `findNearbyRevealedPoint` ported (a separate
    search function, distinct from the frontier system) *and* the
    jagged lightning arc, without which it is indistinguishable from
    Bolt Turret.
  - **Frost Nova** — untargeted pulse centered on the core that also
    freezes growth for 2s. The freeze mechanic is **already fully
    plumbed and tested** (`clearAt`'s `freezeDuration`, respected by
    both `applyAmbientGrowth` and `applyNodeInfluence`), so this is
    mostly the nova ring plus the `dt`-based decay fix from decision 4.
  - **Caustic Cloud** — lingering pool ticking damage every 0.4s;
    prefers live nodes over the frontier. Needs `systems/clouds.ts`.
  - **Homing Missile** — steers to a target and explodes with splash;
    also prefers nodes.

  Scope notes from the 2E review (2026-08-05):
  - **`systems/projectiles.ts` is bolt-only** and needs real branching
    for chain (hop / visited-set / damage decay) and missile (lerp
    steering, node tracking, splash). Its header comment already marks
    this as 2E work.
  - **`bubbleSeeds` is a second instance of the `novaFx` anti-pattern** —
    the prototype lazily creates cloud bubble seeds *inside the draw
    call*, mutating state during render. Generated at cloud-creation
    time instead, same precedent as decision 4.
  - **Missile target typing** — the prototype detects "is this a node?"
    via `target.hp !== undefined` duck-typing; ported properly against
    the existing discriminated unions rather than reproducing the hack.
  - **Render layer order** (from the prototype): slime layer, clouds,
    novaFx, safe-zone ring, nodes, gems, orbitals, projectiles, chainFx,
    particles, tower.
  - **`bladeNextHit` fragility** (see docs/KNOWN_ISSUES.md) is worth
    resolving here, since this is the step that introduces blades.
  - **Safe-zone groundwork (decisions 14-20), one commit ahead of the
    five weapons per Confirmed decision 12 — done 2026-08-05.** Shrunk
    tier table (14), `towerCenteredRadius()` helper with its invariant
    test (16, helper only — wiring into Blades/Frost Nova/Ward Pulse
    still happens per-weapon), damped ambient creep with node bypass
    (15, `systems/growth.ts`), depth-weighted contact-damage rework (18,
    `systems/contact.ts`), reactive danger-line ring (19,
    `render/background.ts`), bug #2's guard replaced with an outcome
    test (20, `systems/contact.test.ts`). Also fixed in the same commit:
    frontier targeting's raycast used to start at `safeRadius` and so
    could not see or target a breach inside it, which would have made
    any breach unkillable once one was possible — now starts at
    `tower.radius` (`systems/frontier.ts`). 104/104 tests pass; verified
    live in-browser (node breach pushing density to the core, HP
    draining, ring tint shifting, zero console errors across the
    session). Ninja-star blade rendering (17) is deferred to the
    Orbiting Blades weapon commit, where it belongs.
- **2F — dissolved into 2E.** See Confirmed decision 11. Phase 2 ends
  at 2E; the danger pressure ring it once listed was already
  implemented in `render/tower.ts` back in Phase 1.

## Confirmed decisions

Proposed at the start of Phase 2, confirmed by the project owner on
2026-08-05. These are load-bearing for later steps — revisit deliberately,
don't drift away from them by accident.

1. **Weapon data lives in one library file, not one file per weapon.**
   A single module holds all six weapons together with their upgrades,
   tiers, and tunable variables, so balance edits are one file to open
   instead of six. Behavior code may still split per weapon where that
   genuinely helps, but the *data* stays centralized. Note this is a
   change from the original "one file per weapon" proposal.
2. **Slime layer renders at 1x** (world units) for now, even on 4K
   screens. Revisit only if it visibly bothers on a real 4K display —
   likely as a user-facing resolution slider rather than a hardcoded
   bump (logged in docs/KNOWN_ISSUES.md).
3. **Pause after 2C** for a real playtesting pass before continuing to
   the remaining steps (2D-2E; 2F was later dissolved, see decision 11).
4. **`novaFx` frame-rate-dependent decay is fixed at port time,** not
   ported as-is and cleaned up later. Frost Nova arrives in 2E already
   using a real `dt`-based decay in an update pass. A tiny, invisible
   deviation from strict prototype parity, taken on purpose.
5. **HUD and upgrade cards are DOM/CSS overlaid on the canvas**, ported
   from the prototype's markup rather than drawn as canvas calls. Note
   the consequence: the HUD lives in *screen* space, so it does not
   scale with the letterboxed 1920x1080 arena and will sit over the
   letterbox bars on non-16:9 windows. That's intended — HUD text stays
   crisp and readable at any window size.
6. **2C's upgrade-card pool offers five passives, not eight.** Vitality
   (`maxHp`), Regeneration (`regen`), and Armor Plating (`armor`) are
   gated out — nothing damages the core until 2D, so all three would be
   dead, unverifiable picks during the playtest. Since they're
   unreachable through play, their numeric effects aren't built in 2C
   either (would be untestable dead code); they land properly in 2D
   alongside contact damage, when HP loss makes them meaningful.
   Overclock, Amplifier, Magnetism, Insight, and Ward Pulse stay in the
   pool and get real numeric effects now — Ward Pulse purges a ring
   around the core regardless of whether the core takes damage, so it's
   testable today. `tuning/passives.ts` already declares display data
   for all eight (unchanged); this only affects which ones the card
   pool offers and which have working effects this phase.
7. **The prototype's double-level-up bug is fixed at port time,** same
   precedent as `novaFx` above. See docs/KNOWN_ISSUES.md.
8. **The modifier readout ships as part of 2D**, not as a later pass.
   Confirmed 2026-08-05 after the first playtest. 2D introduces Armor
   Plating, Regeneration and Vitality — the three least-visible
   passives in the game — so without it the 2D playtest would hit the
   "did my pick do anything?" blind spot three more times, on the
   picks where it's hardest to self-verify. See the corresponding
   entry in docs/KNOWN_ISSUES.md.
9. **Start and game-over overlays both ship in 2D.** The prototype's
   start overlay (title, premise blurb, Start Run button) is ported
   alongside the game-over overlay 2D needs anyway — it gives restart
   somewhere to land, and the blurb is the only place a first-time
   player learns what nodes are and why carving matters.
10. **The vein maze is regenerated on every run.** Restart re-runs the
    reaction-diffusion, so each run gets a different pattern — matches
    the prototype and suits a roguelite. Costs ~200ms of startup hitch
    per run, accepted deliberately. Note this makes runs *not* directly
    comparable for balance work; if that becomes a problem while tuning,
    a fixed-seed debug option is the fix, not reusing the field.
11. **Phase 2F is dissolved into 2E** (confirmed 2026-08-05). Every
    item it held — chain lightning arcs, caustic cloud bubbles, nova
    ring — is the signature visual of a weapon that ships in 2E, and
    the handoff doc is explicit that these aren't cosmetic: Chain Bolt
    and Caustic Cloud both "read as broken" without them, and Frost
    Nova is an invisible untargeted pulse without its ring. Each weapon
    now ships complete (behavior + visual + tests). This is the third
    application of the same principle, after gem diamonds moved 2F->2C
    and node gold pulse moved 2F->2D. **Phase 2 now ends at 2E.**
12. **2E is committed one weapon per commit**, each independently
    verifiable in the browser — easier to review and to bisect if a
    single weapon misbehaves, and it leaves room to playtest partway
    through.
13. **A balance + playtesting pass follows 2E**, before any other
    backlog work (endless-scaling tail, weapon upgrade-tier system,
    audio, leaderboard). 2E is the first point balance can be judged
    honestly — the prototype's numbers were bot-validated against all
    six weapons and eight passives, which is exactly the state 2E
    reaches. See "Balance is bot-validated only" in
    docs/KNOWN_ISSUES.md.

### Safe-zone semantics (decided 2026-08-05, ahead of 2E)

These four came out of reviewing 2E and are grouped because they're one
connected problem: the prototype's safe zone was too large, impassable,
and measured in absolute units that no weapon could reach out of.

14. **The safe-radius tier table shrinks to 100 → 85 → 70 → 58 → 45**
    (from the prototype's 190 → 170 → 145 → 120 → 95). The infection now
    sits visibly close from the start and genuinely crowds the core at
    Apocalypse. *Applied in `tuning/tiers.ts`.* **Note this does not make
    the game harder** — contact damage samples at `safeRadius + 1.5`
    cells, so the damage ring moves inward with the zone, and the growth
    ramp at that ring is a function of distance-past-boundary, not
    absolute position (measured: 0.096 → 0.091, ~5% *slower*). This buys
    tension and weapon viability, not difficulty. Difficulty is
    `CONTACT_SCALE` / `AMBIENT_BASE` / `infectionMult`, in the balance
    pass. (Superseded in spirit by decision 18 below, which replaces the
    ring sample entirely — kept here for the historical reasoning on why
    the table itself shrank.)
15. **Ambient growth creeps *into* the safe zone at a damped rate**
    rather than being hard-gated to zero. In the prototype
    `applyAmbientGrowth` does `if (d < safeRadius) continue`, so
    infection could never physically reach the tower — only growth nodes
    could push density inside, and a lost run meant dying to slime that
    was still 100+px away. Confirmed as unintended prototype behavior,
    not a design choice. The safe zone becomes a strong *resistance*
    gradient instead of a wall, so "Core Overwhelmed" means the core is
    actually being consumed. **Implemented 2026-08-05** in
    `systems/growth.ts`.

    **Damping curve (decided 2026-08-05):** keep the existing outside
    formula completely untouched and give the inside its own rate,
    rather than scaling the outside formula down. The outside ramp is
    `pow(clamp((d-safeRadius)/span, 0, 1), 0.6)` — this is *already*
    exactly 0 at `d = safeRadius`, so multiplying it by any inside
    damping factor is still 0 everywhere inside the line; the two
    formulas cannot share a root. Concretely:
    ```
    proximity = clamp((d - towerRadius) / (safeRadius - towerRadius), 0, 1)  // 0 at tower, 1 at line
    inside:  rate = AMBIENT_BASE * infectionMult * CREEP_RAMP * proximity   // linear
    outside: rate = AMBIENT_BASE * infectionMult * max(ramp, CREEP_RAMP)    // unchanged formula, floored
    ```
    `CREEP_RAMP` is a new tuning constant (start ~0.09, to roughly match
    current front-line speed) — a balance-pass knob, same status as
    `AMBIENT_BASE`/`CONTACT_SCALE`. Proximity is **linear**, not squared:
    a squared curve was checked and damps growth at 30px from the core to
    a ~1900s time-to-visible, which is effectively "never" and defeats
    the point; linear gives ~110s for an *undefended* core (survivable
    with any working weapon, lethal if ignored). This also keeps the
    outside pacing and the two global multipliers (`AMBIENT_BASE`,
    per-tier `infectionMult`) completely untouched — "make the whole
    game harder" and "make breaches specifically more punishing"
    (`CREEP_RAMP`, the proximity exponent) stay two independent knobs,
    not coupled through one formula. Collapsing to a single-formula
    model later remains possible but is not the starting design.

    **Node behavior inside the line (decided 2026-08-05):** growth nodes
    **bypass this damping** (little to none) — ambient is the slow tide,
    an uncleared node is the breach, and that distinction is what makes
    a node near the tower a genuine emergency worth dropping everything
    for, matching its "priority target" role in the handoff doc. No
    *additional* lever for "nodes spawn closer at higher tiers" — that
    already happens for free, since node spawn distance
    (`rand(safeRadius + 70, maxRange - 30)` in `systems/nodes.ts`) is
    derived from `safeRadius`, which the decision-14 table shrinks from
    100 to 45 across tiers (closest possible spawn: 170px -> 115px, ~32%
    tighter). Stacking an explicit extra multiplier on top of both the
    free shrink and the damping-bypass was judged likely to overshoot;
    revisit in the balance pass if the automatic effect doesn't bite
    hard enough.
16. **Tower-centered weapon radii use an anchor as a *floor*, never a
    lock.** `towerCenteredRadius()` in `tuning/weaponGeometry.ts` returns
    `max(safeRadius + margin, base + perLevel * (lvl - 1))`. The first
    term guarantees a weapon can always at least reach the infection
    boundary at any tier, however the table is later retuned; the second
    keeps reach as something levels and future range-upgrade paths can
    push outward. Deliberately *not* welded to `safeRadius` — that would
    corner the upgrade design. Collapsing to either pure behavior later
    is a one-line change. *Applied for the helper; wiring into the three
    affected weapons happens in 2E.*
17. **Orbiting Blades render as ninja stars**, not the prototype's plain
    cyan dots — a 4-pointed shuriken with its own spin independent of
    orbital position, so they read as blades rather than orbiting blobs.
18. **Contact damage becomes a depth-weighted average over the disc
    inside the line** (decided 2026-08-05), not a fixed ring sample
    outside it:
    ```
    weight   = 1 - (d / safeRadius)          // 1 at the core, 0 at the line
    pressure = sum(revealed density * weight) / sum(weight)
    damage   = pressure * contactMult * CONTACT_SCALE * dt
    ```
    Zero when the zone is clear (a real grace period — clearing a breach
    genuinely stops the bleeding), volume-aware (a wide breach hurts
    more than a narrow finger), and depth-aware (slime touching the core
    counts far more than slime just over the line, so a nibble is
    survivable but being engulfed is fast and lethal). `contactPressure`
    already drives the tower's Phase-1 danger-pulse ring, so that visual
    starts reading true rather than reflecting a fairly meaningless
    ring-average. `CONTACT_SCALE = 15` was tuned for the old ring-sample
    method — treat its value as a fresh guess for the balance pass, not
    a carried-over constant. Keep a small floor (lower than the current
    0.05) so one revealed edge cell doesn't chip the core. Cost is
    negligible (~237 cells/tick at 5.5 ticks/sec — measured ~237-289
    depending on grid quantization). **Implemented 2026-08-05** in
    `systems/contact.ts`. `CONTACT_FLOOR` landed at 0.02.
19. **The danger-line ring keeps its cyan "sanctuary" framing and reacts
    to breach**, rather than being restyled as a hazard color (decided
    2026-08-05). The line meaning what it should — cross it and the core
    is threatened — reads as more tense specifically *because* the space
    inside still visually reads as "yours to defend," not because it
    looks dangerous by default. Shifts color, thickens, and brightens
    toward danger red as `contactPressure` (decision 18) rises, so the
    ring itself becomes a live "how badly is this being breached" signal
    rather than a static boundary. **Implemented 2026-08-05** in
    `render/background.ts`'s `drawSafeZone`.
20. **Documented prototype bug #2 is superseded, not merely re-guarded**
    (decided 2026-08-05, with the project owner's explicit go-ahead per
    the ground-truth override protocol in `CLAUDE.md`). Bug #2's rule
    ("sample at the ring, never closer") was correct advice for the
    *old* design, where growth was hard-gated at the line and near-core
    space was guaranteed empty — sampling there really was sampling
    nothing. Decision 15 removes that gate, so near-core space is no
    longer guaranteed empty and the specific rule no longer applies; the
    underlying invariant it protected ("the core must be actually
    killable") still matters as much as ever. The regression test is
    replaced with an outcome test rather than a mechanism test: run the
    real simulation on a synthetic grid with no weapons and assert the
    tower (a) eventually takes lethal damage when the zone is left
    dirty, and (b) takes none when the zone is kept clear. This is
    strictly stronger than asserting "sampled at the correct radius" —
    it also catches a reintroduced hard gate, a wrong sample region, a
    broken damage formula, or a bad damping constant, none of which
    would trip the old assertion. See "documented prototype bugs" below
    — bug #2 stays listed, marked superseded with this reasoning, so a
    future reader doesn't "fix" the new sampling location back to the
    old rule. **Implemented 2026-08-05**: `systems/contact.test.ts`'s
    "outcome guard for superseded bug #2" — an undefended core dies in
    ~520 ticks against a dirty zone (test budget 5000, ~10x margin for
    future retuning), and takes zero damage across 3000 ticks when kept
    scrubbed clean despite growth genuinely ticking throughout.

### Documentation

21. **PROGRESS.md gets compressed once the port is complete.** The
    per-phase entries carry a lot of "why we decided this" detail that
    earned its place during the work and becomes noise afterward. Phases
    0-2E collapse into a short status table; decisions that still
    constrain future work stay; historical reasoning moves out. This is
    the project's main status document and is meant to stay useful
    long past the port — it shouldn't grow without bound. Then playtest
    and a planning brainstorm.

## Five documented prototype bugs to guard while porting

Items 1-4 are from `docs/PROTOTYPE_HANDOFF.md` "Known bugs found during
development" — each cost real debugging time once already, don't
reintroduce them. Item 5 was found during the 2E review.

1. Gems must always drift toward the (stationary) core — never gate
   drifting behind a fixed pickup radius, or XP can never accumulate.
2. **⚠ SUPERSEDED 2026-08-05 — do not "fix" this back.** Originally:
   contact damage must sample right at the visible safe-zone ring
   (`safeRadius + 1.5 cells`), never closer, or the core is structurally
   unkillable. That was correct *only* because ambient growth was
   hard-gated to zero inside `safeRadius`, making near-core space
   guaranteed empty — sampling closer really was sampling nothing.
   Decision 15 removes that gate on purpose (ambient growth now creeps
   inside, damped by proximity) and decision 18 replaces the ring sample
   with a depth-weighted average over the whole inner disc — sampling
   near the core is now *correct*, not broken. If you're reading this
   because contact damage looks like it samples "too close": it's
   supposed to now. See decision 20 for the full reasoning and the
   ground-truth override protocol in `CLAUDE.md` for why this bug entry
   stays listed instead of being deleted.
3. Contact damage and XP must gate on `isRevealed` (growth > threshold),
   never raw density — raw density can cross a damage/XP threshold before
   a cell is actually visible.
4. Reaction-diffusion must respect `D * step <= ~0.25` or it silently
   diverges to NaN. Guarded by a canary test in `grid/veinField.test.ts`.
5. **Tower-centered weapons must never have a radius smaller than
   `safeRadius`** — nothing grows in there, so such a weapon is aimed at
   guaranteed-empty space. In the prototype, Orbiting Blades orbited at
   64-78px while the *smallest* safe radius ever reached was 95, and
   blades only fire when the blade's own cell is revealed. Result:
   Orbiting Blades could not hit ambient infection at any tier, at any
   level, in any run — they only ever connected with density a growth
   node happened to push inside. Ward Pulse and Frost Nova were degraded
   the same way, less severely. Guarded structurally by
   `towerCenteredRadius()` (decision 16) plus a test asserting the
   invariant across every tier and level, rather than by remembering to
   check the numbers.

## Resuming on a new machine

```bash
git pull
npm install
npm run test
npm run typecheck
npm run dev
```

All three should be clean before starting new work. If `npm install`
pulls a different Node than `.nvmrc` expects, `nvm install` first.
