# Slime TD

Browser-based roguelite tower defense. A stationary core sits at the center of
the screen; infection spreads inward as a continuous procedural density field
(not discrete enemies) and the player levels up auto-firing weapons
Vampire-Survivors-style to carve it back.

## Before doing anything else

Read these three, in order. They are the project's authority:

- **`docs/PROGRESS.md`** — current state, what happened in recent sessions
  (including what was discussed and planned, not just what shipped), and
  what to pick up next. Start here.
- **`docs/DECISIONS.md`** — every load-bearing decision and its reasoning,
  plus the documented bug list. **Check this before changing anything that
  looks odd** — a lot of "odd" is deliberate, and several entries exist
  because the obvious fix reintroduces a real bug.
- **`docs/BACKLOG.md`** — bugs, TODOs, and ideas in one list.

**`src/` is the ground truth for behavior.** The original prototype was
fully ported as of 2026-08-05 and now lives in `archive/`, deprecated and
non-authoritative. Do not "fix" the codebase to match it — the project has
deliberately diverged in several places (safe-zone semantics, weapon reach
geometry, three fixed prototype bugs), all recorded in `docs/DECISIONS.md`.

**Ground-truth override protocol:** if something recorded as a decision or
a documented bug looks *wrong* rather than merely different from a new
design direction, raise it with the project owner and wait for a yes
before writing it down as superseded. Don't decide unilaterally, even when
the reasoning seems solid. See DECISIONS.md #20 and #22 for the live
example — a documented bug whose advice was correct for its own design and
only became wrong once the design changed underneath it.

## Keeping the docs current

`docs/PROGRESS.md` is the handoff mechanism for a solo project developed
across two machines — it is how the next session (on either machine)
recovers context. **Update it at the end of any session that covers
meaningful ground**, following the format described at the top of that
file: what shipped, what was discussed, what was decided, what's planned.
New decisions go in `docs/DECISIONS.md`; anything discovered-but-deferred
goes in `docs/BACKLOG.md`.

## Stack

- Vite + TypeScript + HTML5 Canvas 2D + Web Audio API
- Target: GitHub Pages deployment, Firebase for the leaderboard
- No framework (no React/Vue) — this is a game loop over a canvas, not a UI app

## Build / run commands

- `npm install` — install dependencies (Node version pinned in `.nvmrc`)
- `npm run dev` — local dev server with hot reload
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run typecheck` — TypeScript check only, no build
- `npm run test` — run Vitest once
- `npm run test:watch` — Vitest in watch mode

## Conventions

- **One system per module**, and keep update logic separate from canvas
  draw calls. `systems/` updates, `render/` draws, and they don't mix.
- **Game state lives in one central object** (`src/state.ts`'s
  `freshState()`); avoid scattering mutable state across modules.
- **Never mutate state during a draw call.** Three separate prototype bugs
  came from this (see DECISIONS.md #4 and #7). Lifetimes and decay belong
  in an update pass.
- **The simulation tick** (growth spread, node influence, frontier
  targeting, contact damage) runs on a fixed timestep via an accumulator,
  independent of render framerate. Keep that decoupling.
- **Numeric tuning constants live in `src/tuning/`** so balance work is one
  directory rather than a hunt through logic. They are not finalized — see
  the balance pass at the top of `docs/BACKLOG.md`.
- **Guard bugs with tests, not memory.** Prefer testing the *invariant*
  over the *mechanism* where possible: an outcome test ("an undefended core
  dies") survives a redesign that a mechanism test ("sampled at radius X")
  would not. See DECISIONS.md #20.

## Known sharp edges

Full detail in `docs/DECISIONS.md` under "Documented prototype bugs."

- Reaction-diffusion must respect `D * step <= ~0.25` or it silently
  diverges to `NaN` — a blank field with no thrown error, not a crash.
- Anything granting XP or dealing contact damage must gate on **revealed**
  density (`growth > threshold`), never raw density. Raw density can cross
  a threshold before a cell is actually visible.
- Collectibles must always drift toward the (stationary) core — never gate
  drifting behind a pickup radius, or XP can never accumulate.
- Tower-centered weapon radii must never be smaller than `safeRadius`;
  use `towerCenteredRadius()` in `tuning/weaponGeometry.ts`. Getting this
  wrong made a whole weapon silently non-functional in the prototype.

## Workflow

- This is a solo project developed from two machines (home/work) via git.
  Commit and push before switching machines; pull before starting a session.
- Update `docs/PROGRESS.md` before switching machines — the code syncs via
  git, but the *context* only survives if it's written down.
- `CLAUDE.local.md` (gitignored) is the right place for any machine-specific
  notes — don't put those here.
