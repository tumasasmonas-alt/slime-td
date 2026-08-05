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

### 🔴 Balance + playtesting pass
The agreed next step (Decision 13), gating all other work.

The port is complete, so for the first time all six weapons and eight
passives exist together — which is exactly the state the prototype's
original numbers were validated against. But the safe-zone rework changed
the geometry those numbers assumed, so **treat them as fresh guesses, not
carried-over constants.**

Specifically unvalidated:
- `CONTACT_SCALE = 15` (`tuning/growth.ts`) — tuned for the *old*
  ring-outside-the-line sampling; damage is now a depth-weighted disc
  inside it. Almost certainly wrong now.
- `CREEP_RAMP = 0.09` (`tuning/growth.ts`) — first guess. Controls how
  fast a breach turns lethal.
- Safe-radius tier table `100/85/70/58/45` (`tuning/tiers.ts`) — shrunk
  for tension and weapon viability, deliberately *not* for difficulty.
  Does the tension actually read? Is Apocalypse's 45px too claustrophobic
  against a 22px tower?
- **Weapon relative power.** Six weapons have never coexisted before.
  Orbiting Blades and Ward Pulse in particular have *never* been balanced
  against anything — they were non-functional in the prototype (see
  prototype bug #5 in DECISIONS.md).
- **Whether growth nodes bite hard enough.** They bypass creep damping and
  spawn ~32% closer across a run, but that's an automatic consequence of
  the shrinking safe radius rather than a deliberate lever. If it's not
  enough pressure, an explicit per-tier spawn-distance field is the next
  knob — deliberately not added yet to avoid stacking difficulty levers.

Note: every run generates a fresh maze (Decision 10), so runs are **not
directly comparable**. If that gets in the way while tuning, add a
fixed-seed debug option — don't reuse the field.

---

## Bugs and known limitations

### 🟡 Difficulty plateaus after Apocalypse (t = 560s)
`tuning/tiers.ts` has five tiers and stops escalating at the last one. A
strong build can coast indefinitely past ~9 minutes with no further
pressure. Needs an endless-scaling tail — e.g. tiers 5+ generated
procedurally from the same curve. Do this *after* base balance feels
right, since it extrapolates from those numbers.

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

### 🟡 Per-variable weapon upgrade tiers
All six weapons are currently single-behavior, single-scaling-curve ports.
The plan is to expand each with **separate upgrade paths per variable** —
e.g. Chain Bolt: more hops *or* more simultaneous bolts *or* shorter
cooldown, as distinct choices rather than one linear track.

This was deliberately deferred until six real working weapons existed to
design against, rather than guessed at up front. That condition is now
met. Weapon data lives in one central library (`tuning/weapons.ts`, per
Decision 1) specifically so this expansion is one file to edit.

Relatedly: `towerCenteredRadius()` (Decision 16) was built with a
`base + perLevel` term precisely so **range can become an upgradeable
variable** rather than being welded to the safe radius. That's the hook
for a range-upgrade path when this lands.

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
