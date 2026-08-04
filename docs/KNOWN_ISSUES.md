# Known Issues / Deferred Work

Running list of gaps and limitations found while porting the prototype
(`reference/slime-td-prototype.html`) to the real project. These are
deliberately deferred, not forgotten — the port targets behavioral parity
first (see `CLAUDE.md`), and this file is where the "fix later" list lives
so it survives past the conversation that found it.

Add to this file as new gaps turn up. Remove an entry when it's actually
fixed, not when it becomes inconvenient to look at.

## Resolved during the port

- **Resize used to mean "see more world."** The prototype sized its grid to
  the window (`W/H` at run start), so a wider monitor was a measurably
  different, easier-to-see game, and a mid-run resize couldn't be handled
  without rebuilding the grid (freezing and wiping the field). Phase 1
  replaced this with a fixed 1920x1080 world and a fit-to-window camera —
  every player gets an identical arena, and resizing only changes the
  camera scale, never the simulation.

## Open

### Difficulty plateaus after Apocalypse (t=560s)
The tier table (`src/tuning/tiers.ts`) has five tiers and stops escalating
at the last one. A strong build can plateau indefinitely past ~9 minutes
with no further pressure. Needs an endless-scaling tail (e.g. tiers 5+
generated procedurally from the same curve) once base balance feels right.

### Weapons are intentionally barebones
All six weapons are single-behavior, single-scaling-curve ports of the
prototype. The plan is to expand each with per-variable upgrade tiers
(e.g. Chain Bolt: more hops *or* more simultaneous bolts *or* shorter
cooldown, as separate upgrade paths) and likely add new weapons. Don't
treat the current weapon files as final shape — they're a parity baseline.

### `novaFx` was frame-rate dependent in the prototype
The original decremented `novaFx.life` by a hardcoded `1/60` inside
`render()`, and mutated state during a draw call — both against this
project's update/draw separation. Port with a real `dt`-based decay in an
update pass instead; the visible effect is the same ring animation, just
correct at any framerate.

### `bladeNextHit` keying is fragile
Keyed by blade index (0..count-1) and never cleared when blade count
changes on level-up. Harmless today because indices are stable within a
frame, but worth revisiting once blades get more per-level variation.

### No audio
Web Audio is in the stack (`CLAUDE.md`) but the prototype has zero sound.
Out of scope until the core game loop is ported and feels right.

### No leaderboard / Firebase
Also planned per `CLAUDE.md`, not started. Depends on deciding what a
"run" and a valid score even are once balance and the endless-scaling tail
exist.

### GitHub Pages requires a public repo (or paid plan)
The repo is currently private. The Actions deploy workflow
(`.github/workflows/deploy.yml`) is wired up but dormant — Pages on a
private repo needs a paid GitHub plan. Nothing to do until you're ready to
share the game; flagged here so it isn't a surprise on launch day.

### Balance is bot-validated only, never human-playtested
Per the handoff doc: an automated headless script confirmed the game is
completable and not trivially broken, reaching level ~26 by minute 11 with
a random mix of upgrades. That's "not broken," not "correctly tuned." Real
balance needs a human playtesting pass, and is explicitly a known TODO
independent of the porting work.
