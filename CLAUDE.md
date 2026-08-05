# Slime TD

Browser-based roguelite tower defense. A stationary core sits at the center of
the screen; infection spreads inward as a continuous procedural density field
(not discrete enemies) and the player levels up auto-firing weapons
Vampire-Survivors-style to carve it back.

## Before doing anything else

- Read `docs/PROTOTYPE_HANDOFF.md` — full mechanics, exact formulas, visual
  style decisions, and a list of real bugs already found and fixed once.
  Don't reintroduce them.
- `reference/slime-td-prototype.html` is a working single-file prototype of
  the full game. It is the ground truth for exact behavior — if the handoff
  doc and the prototype code ever disagree, trust the code.
- **Ground-truth override protocol:** neither the prototype code nor the
  handoff doc gets overridden or superseded without asking the project
  owner first, even when the reasoning seems solid. If a piece of ground
  truth looks wrong rather than just different from a new design
  decision, raise it explicitly and wait for a yes before writing it
  down as superseded. See docs/PROGRESS.md's "documented prototype bugs"
  list for a live example (bug #2, superseded 2026-08-05 with the
  owner's explicit go-ahead).

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

- One system per module (grid/reaction-diffusion, weapons, entities,
  simulation tick, render, UI) — see the suggested layout at the bottom of
  `docs/PROTOTYPE_HANDOFF.md`. Keep update logic and canvas draw calls
  separate.
- Game state lives in one central object (`freshState()` pattern in the
  prototype); avoid scattering mutable state across modules.
- The simulation tick (growth spread, node influence, frontier targeting,
  contact damage) runs on a fixed timestep independent of render framerate —
  keep that decoupling when porting.
- Numeric tuning constants (growth rate, contact damage scale, node cap, XP
  curve) should stay easy to find and change — they are not finalized, see
  Balance Notes in the handoff doc.

## Known sharp edges (see handoff doc for full detail)

- Reaction-diffusion diffusion step must respect `D * step <= ~0.25` or it
  silently diverges to `NaN` with no error — no visible pattern, not a crash.
- Anything that grants XP or deals contact damage must respect the
  distinction between raw density and *revealed* (visible) density. Using
  raw density for either one has caused real, hard-to-spot bugs before.
- Pickup/magnet mechanics: the core never moves, so collectibles should
  always drift toward it rather than only activating within a fixed radius.

## Workflow

- This is a solo project developed from two machines (home/work) via git.
  Commit and push before switching machines; pull before starting a session.
- `CLAUDE.local.md` (gitignored) is the right place for any machine-specific
  notes — don't put those here.
