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

- **Upgrade cards gave no visible confirmation of what they changed.**
  Found during the first human playtest (2026-08-05): a pick applied
  correctly but nothing on screen showed it — passive picks especially,
  since the weapon tray only ever displayed weapons. Fixed in Phase 2D:
  an always-visible modifier readout (`ui/hud.ts`) shows all five
  multiplier stats live, reading `systems/passives.ts`'s existing mult
  functions as its source of truth, so a pick's effect is confirmable
  the instant it's made.

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
Weapon data (upgrades, tiers, tunable variables) lives in one central
library module by decision, so that expansion is one file to edit rather
than six — see "Confirmed decisions" in docs/PROGRESS.md.

### Slime layer resolution is fixed at 1x, with no user control
The slime layer renders at world resolution (1x) regardless of display
density, so on a 4K screen it is upscaled and soft. Deliberate for now —
the softness may read as "organic tissue" rather than "low-res," but that
is untested on real high-DPI hardware. If it does bother in practice, the
preferred fix is a **user-facing resolution slider** (backing-store scale
for the slime layer) rather than silently hardcoding a higher multiplier —
it doubles as a performance escape hatch on weak GPUs. Not built yet.

### `novaFx` was frame-rate dependent in the prototype
The original decremented `novaFx.life` by a hardcoded `1/60` inside
`render()`, and mutated state during a draw call — both against this
project's update/draw separation. Port with a real `dt`-based decay in an
update pass instead; the visible effect is the same ring animation, just
correct at any framerate.

### A single XP grant crossing two levels ate an upgrade
In the prototype, `grantXp()` loops `while(xp >= xpToNext)` and calls
`onLevelUp()` each pass, which rebuilds the upgrade-card overlay from
scratch — so crossing two thresholds in one grant showed the cards twice
and the second render replaced the first. The player silently got one
pick for two levels. Not reachable at the prototype's numbers (you'd need
~35 XP from a single 10-XP gem), but it becomes reachable the moment gem
values or the XP curve are tuned upward, which is likely given balance is
explicitly unfinished. Fixed at port time rather than ported — level-ups
queue and are consumed one card at a time. Same precedent as the `novaFx`
decision above; see "Confirmed decisions" in docs/PROGRESS.md.

### Safe-zone semantics deliberately deviate from the prototype
The port is parity-first (see `CLAUDE.md`), so the three deviations
decided on 2026-08-05 are recorded here as intentional, not drift. All
three are detailed as Confirmed decisions 14-16 in docs/PROGRESS.md:
- **Safe-radius tier table shrunk** to 100/85/70/58/45 from the
  prototype's 190/170/145/120/95.
- **Ambient growth creeps into the safe zone** at a damped rate instead
  of the prototype's hard `if (d < safeRadius) continue` gate, which
  made the infection physically unable to reach the tower. Confirmed as
  unintended prototype behavior. *Not yet implemented.*
- **Tower-centered weapon radii anchor to `safeRadius` as a floor**,
  fixing a prototype bug where Orbiting Blades could never hit ambient
  infection at all (see prototype bug 5 in docs/PROGRESS.md).

Consequence worth remembering: the prototype's tuning numbers were
validated against the *old* geometry, so the bot-validation result cited
below is now a weaker signal than it was. The balance pass after 2E
should treat the numbers as fresh rather than merely confirmed.

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
