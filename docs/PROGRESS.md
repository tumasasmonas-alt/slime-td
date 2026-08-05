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
- **Phase 2E (remaining arsenal) — not started.** Next up, and the
  **final porting step** — 2F was dissolved into it (Confirmed decision
  11). Once 2E lands, the prototype is fully ported and everything
  remaining is new work from docs/KNOWN_ISSUES.md, starting with a
  balance + playtesting pass (decision 13).

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
  ported. **Status: next.**

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
  - **Safe-zone groundwork (decisions 14-17) partly precedes the
    weapons.** Already applied: the shrunk tier table and the
    `towerCenteredRadius()` helper with its invariant test. Still to
    do: wiring that helper into Blades / Frost Nova / Ward Pulse, the
    damped ambient creep into the safe zone (`systems/growth.ts`), and
    ninja-star blade rendering. The creep change is the one item here
    that is a real *mechanic* change rather than a geometry fix, and it
    affects contact-damage pacing — worth verifying on its own rather
    than folding silently into a weapon commit.
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
    pass.
15. **Ambient growth creeps *into* the safe zone at a damped rate**
    rather than being hard-gated to zero. In the prototype
    `applyAmbientGrowth` does `if (d < safeRadius) continue`, so
    infection could never physically reach the tower — only growth nodes
    could push density inside, and a lost run meant dying to slime that
    was still 100+px away. Confirmed as unintended prototype behavior,
    not a design choice. The safe zone becomes a strong *resistance*
    gradient instead of a wall, so "Core Overwhelmed" means the core is
    actually being consumed. **Not yet implemented** — lands in
    `systems/growth.ts`; damping curve is a balance-pass tuning target.
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

### Documentation

18. **PROGRESS.md gets compressed once the port is complete.** The
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
2. Contact damage must sample right at the visible safe-zone ring
   (`safeRadius + 1.5 cells`), never closer, or the core is structurally
   unkillable.
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
