# Archive — superseded reference material

**Nothing in this directory is authoritative any more.** It is kept for
historical reference only: to understand *why* a piece of the game works
the way it does, or to check what the original intent was when something
looks odd.

## What's here

| File | What it was | Status |
|---|---|---|
| `slime-td-prototype.html` | The original working single-file prototype of the whole game, built in a Claude.ai chat session. Was the **ground truth** for exact behavior throughout the port. | Fully ported 2026-08-05. Superseded by `src/`. |
| `PROTOTYPE_HANDOFF.md` | Mechanics narrative, exact formulas, visual-style decisions, and documented bug history, written to guide the port. | Superseded. Its content now lives in `src/` (as code + comments), `docs/DECISIONS.md`, and `docs/BACKLOG.md`. |

## Why they were archived

Phase 2E completed the port on 2026-08-05. An audit at that point
confirmed **all 86 prototype functions, all 20 DOM targets, and every
weapon/passive formula** are accounted for in `src/`. The prototype has
no remaining behavior the real project lacks, so continuing to treat it
as ground truth would mean deferring to a less-capable version of the
game.

The real project has already **deliberately diverged** in several places
(safe-zone semantics, weapon reach geometry, three fixed prototype bugs).
Those divergences are intentional and recorded in `docs/DECISIONS.md`.
Treating the prototype as authoritative now would actively cause
regressions.

## If you are tempted to "fix" something back to match the prototype

Don't — check `docs/DECISIONS.md` first. Several differences are
deliberate, and at least one (contact damage sampling near the core) is
a case where the prototype's own documented advice became *wrong* once
the design changed underneath it. See documented prototype bug #2 in
`docs/DECISIONS.md`.

## Where authority lives now

- **`src/`** — the actual behavior. This is the ground truth.
- **`docs/PROGRESS.md`** — current state, session history, what's next.
- **`docs/DECISIONS.md`** — every load-bearing decision and why.
- **`docs/BACKLOG.md`** — known bugs, TODOs, and ideas.
