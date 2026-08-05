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

**Last updated:** 2026-08-05

**The prototype port is complete.** Phase 2E finished on 2026-08-05. The
project has moved out of "porting" and into original development.

| | |
|---|---|
| Tests | 153 passing (29 test files) |
| Source | 56 modules under `src/` |
| Typecheck | clean |
| Branch | `main`, everything pushed |
| Build target | GitHub Pages (workflow wired but dormant — repo is private, see BACKLOG) |

**What works:** a complete, playable roguelite loop. Infection grows as a
reaction-diffusion density field and creeps toward a stationary core. Six
auto-firing weapons (Bolt Turret, Orbiting Blades, Chain Bolt, Frost Nova,
Caustic Cloud, Homing Missile) and eight passives, chosen via
Vampire-Survivors-style level-up cards. Growth nodes spawn as priority
targets. Contact damage, escalating difficulty tiers, game over, and
restart with a freshly generated maze each run.

**What's next:** a **balance + playtesting pass** (Decision 13). This is
the first point balance can be judged honestly — the prototype's numbers
were validated against exactly the six-weapon, eight-passive state that
now exists. Treat `CONTACT_SCALE`, `AMBIENT_BASE`, `CREEP_RAMP`, and the
tier table as fresh, unvalidated guesses rather than carried-over
constants; the safe-zone rework changed the geometry they were tuned
against.

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
  systems/    simulation: growth, nodes, contact damage, frontier targeting,
              projectiles, gems, xp, particles, passives, tower, fx lifetimes
  weapons/    one module per weapon (behavior only — data lives in tuning/)
  render/     canvas draw calls, strictly separated from update logic
  tuning/     all numeric knobs: weapons, tiers, growth, nodes, xp, geometry
  ui/         DOM/CSS HUD, upgrade cards, start/game-over overlays
  state.ts    the single central GameState + freshState()
  main.ts     game loop, run lifecycle, render order
```

**Conventions that matter:**
- One system per module; update logic and draw calls never mix.
- All game state lives in the one central object — no scattered mutable
  state.
- The simulation tick (growth, nodes, frontier, contact damage) runs on a
  fixed timestep via an accumulator, decoupled from render framerate.
- Numeric tuning constants stay in `tuning/` so balance work is one
  directory, not a hunt through logic.

---

## Session log

*Newest first.*

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

**Next: balance + playtesting pass.**

Everything else in `docs/BACKLOG.md` waits behind it (Decision 13),
because balance is the thing that most affects whether the game is worth
building further, and it's now finally measurable against the full
arsenal.

Specific things to look at, in rough priority order:

1. **Difficulty pacing.** `CONTACT_SCALE = 15` was tuned for a completely
   different damage-sampling method (a ring outside the line; it's now a
   depth-weighted disc inside it). Treat it as unvalidated.
2. **Safe-zone feel.** The tier table shrank to 100/85/70/58/45 for
   tension and weapon viability, deliberately *not* for difficulty. Check
   whether the tension actually reads, and whether Apocalypse's 45px is
   too claustrophobic against a 22px tower.
3. **Creep rate.** `CREEP_RAMP = 0.09` is a first guess; it controls how
   fast a breach becomes lethal.
4. **Weapon relative power.** Six weapons now exist together for the
   first time. Blades and Ward Pulse in particular have never been
   balanced against anything, since they were non-functional in the
   prototype.
5. **Whether nodes bite hard enough.** They bypass creep damping and
   spawn ~32% closer across a run (an automatic consequence of the
   shrinking safe radius, not an explicit lever). If that's not enough
   pressure, an explicit per-tier spawn-distance field is the next knob —
   deliberately not added yet to avoid stacking difficulty levers.

**Open questions for the project owner:** none currently blocking.
