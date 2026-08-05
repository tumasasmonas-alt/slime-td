> # ⚠️ DEPRECATED — ARCHIVED 2026-08-05
>
> **This document is no longer authoritative. Do not treat it as ground
> truth, and do not "fix" the codebase to match it.**
>
> The port completed on 2026-08-05 (Phase 2E). An audit confirmed all 86
> prototype functions, all 20 DOM targets, and every weapon/passive
> formula are implemented in `src/`. The real project has since
> **deliberately diverged** in several places — safe-zone semantics,
> tower-centered weapon reach, and three fixed prototype bugs. Those
> divergences are intentional.
>
> **Where authority lives now:** `src/` for behavior,
> `docs/DECISIONS.md` for why, `docs/PROGRESS.md` for current state,
> `docs/BACKLOG.md` for known bugs and TODOs.
>
> Kept only for historical context. See `archive/README.md`.
>
> ⚠️ **Specifically stale in this document:** the safe-radius tier table
> (190/170/145/120/95 — now 100/85/70/58/45), Orbiting Blades' and Frost
> Nova's flat radii (now anchored to the safe radius), and documented bug
> #2's advice about contact-damage sampling (superseded — sampling near
> the core is now correct). See `docs/DECISIONS.md` 14-20.

---

# Slime TD — Prototype Handoff Notes

This documents the working single-file HTML prototype (`slime-td-prototype.html`)
built in a Claude.ai chat session, for migrating into a proper Vite/TypeScript
project with Claude Code. Keep the prototype file in the repo as ground truth —
this doc explains *why* things work the way they do; the prototype file is the
exact, unambiguous *what*.

## Core concept

Not a wave-based tower defense. A single stationary core sits in the center of
a screen-sized field. Infection spreads inward from the edges as a **continuous
density field**, not discrete enemies. The player never aims — six auto-firing
weapons (chosen via Vampire-Survivors-style level-up cards) carve the infection
back. Danger comes from infection reaching a shrinking "safe radius" around the
core, and from periodic **growth nodes** that must be destroyed before they
thicken the wall around themselves.

## Why a density grid instead of enemy objects

The original ask was a "never-ending wall" that spreads like a Turing/coral
pattern (reaction-diffusion), not bouncing balls. A discrete-enemy approach
can't produce that look or that "carve back a advancing tissue" feel, so the
whole enemy system was replaced with:

1. A **static coral/maze pattern**, generated once via a Gray-Scott
   reaction-diffusion simulation (this *is* the visual reference — same family
   of pattern as the ad screenshot).
2. A **growth field** (0–1 per cell) that rises over time and "reveals" the
   static pattern once it crosses that cell's individual threshold. Sparse,
   low-threshold veins reveal first; the whole area only fills in once density
   is high everywhere. This is what produces the organic spreading look.

## Key mechanics and exact formulas

**Grid**: 13px cells, sized to the screen at run start (not regenerated on
resize mid-run — see Known Limitations).

**Reaction-diffusion (vein pattern)**: Gray-Scott model, `feed=0.0545,
kill=0.062` (classic "coral" parameter set), `Du=1.0, Dv=0.5`. Run at **half
the grid's resolution** then upsampled 2x (nearest-neighbor) to keep one-time
startup cost under ~200ms even on large screens, ~2000 iterations.

> **Stability gotcha (real bug, cost real time to find):** explicit-Euler 2D
> diffusion is only stable when `D * step <= ~0.25`. The first version used
> `step=1` (implicit) and diverged to `NaN` within ~25 iterations regardless of
> feed/kill values. Fix: sub-step with `step=0.15` and more iterations. If you
> reimplement or tune this, respect that bound or it silently produces a blank
> field with no runtime error.

**Density → toughness**: a hit's clear radius and the amount removed both
shrink as local density rises — sparse tissue clears in one big chunk, mature
tissue only chips down a little per hit. See `clearAt()`: radius multiplier is
`clamp(1.25 - density, 0.4, 1.25)`, per-cell removal is `power * 0.022 *
falloff * resistance` where `resistance = clamp(1.3 - density, 0.12, 1.3)`.

**Safe zone**: ambient growth is hard-gated to zero within `safeRadius` of the
core. This radius shrinks each difficulty tier (190 → 170 → 145 → 120 → 95px).
Growth nodes can push density closer than that via their own influence radius.

**Contact damage**: sampled as an average of **revealed** (visually present)
density around a ring at `safeRadius + 1.5 cells` — deliberately *not* raw
density. See Known Bugs below for why that distinction matters.

**Targeting**: no per-enemy list to search. Instead, 48 angular sectors are
ray-cast each simulation tick to find the nearest *revealed* cell in each
direction (`computeFrontier()`). Weapons aim at whichever sector is closest.
Missiles prefer any live growth node over the frontier point.

**Simulation cadence**: growth/frontier/nodes update on a fixed 0.18s tick via
an accumulator, decoupled from render framerate — cheap enough to run the
ambient-growth pass over the whole grid every tick without profiling issues.

**Weapons** (level 1–8, `lvl` below):
| Weapon | Damage | Cooldown / other |
|---|---|---|
| Bolt Turret | `10 + (lvl-1)*5` | `max(0.16, 0.55-(lvl-1)*0.045)` |
| Orbiting Blades | `7 + (lvl-1)*3.2` | count `min(1+floor((lvl-1)/2),5)` |
| Chain Bolt | `11 + (lvl-1)*4` | hops `min(1+floor((lvl-1)/1.6),6)`, cd `max(0.4,1.15-(lvl-1)*0.08)` |
| Frost Nova | `9 + (lvl-1)*3.4` | radius `115+(lvl-1)*12`, cd `max(1.5,3.6-(lvl-1)*0.24)`, also freezes growth in radius for 2s |
| Caustic Cloud | `6 + (lvl-1)*2.4`/tick | radius `58+(lvl-1)*5`, cd `max(1.0,2.3-(lvl-1)*0.15)` |
| Homing Missile | `30 + (lvl-1)*10` | radius `58+(lvl-1)*5`, cd `max(1.2,2.7-(lvl-1)*0.18)` |

**Passives**: Vitality (+20 max HP), Regeneration (+0.3 HP/s per level),
Armor Plating (-7%/level dmg taken, capped 55%), Overclock (+9%/level atk
speed), Amplifier (+10%/level dmg), Magnetism (+35%/level gem drift speed —
see gem note below), Insight (+14%/level XP), Ward Pulse (periodic small AoE
purge around the core).

**XP economy**: gems drop from `clearAt()` when total density removed in one
hit exceeds a small threshold, value `clamp(round(removed*1.3), 0, 10)`.
Level curve is `xpToNext = round(12 + level*6.5)` — deliberately close to
linear; a much steeper or much flatter curve was tried and tuned back (see
Balance Notes).

**Difficulty tiers** (Risk-of-Rain-style escalating name + bar in the HUD):
Simple Infection (0s) → Localized Outbreak (90s) → Spreading Epidemic (220s) →
Full Outbreak (380s) → Apocalypse (560s). Each raises `infectionMult`,
shrinks `safeRadius`, and shortens `nodeInterval`.

## Visual/style decisions to preserve

- **Palette**: near-black maroon background (`#0b060a`/`#150a10`), infection
  in a red/magenta gradient (`#5c2430` sparse → `#ff7590` mature), core in
  electric cyan (`#6df0ff`) for strong complementary contrast against the
  infection, gold (`#ffcf4d`) reserved for growth nodes specifically.
- **Tower**: pulsing glow ring, extra decorative rotating rings that add up
  as more weapons are acquired (visual "growth" cue), plus a danger-pulse
  ring that intensifies with contact pressure.
- **Gems**: small **pastel-green diamonds** (`#b6ffd1`) with a white corner
  highlight — deliberately not circular or cyan, after they were originally
  mistaken for "bullets bouncing back to the core" (they're circular cyan
  drift-toward-core gems that looked identical to Bolt Turret's projectile).
- **Chain Bolt**: needs a visible jagged lightning-arc effect between each
  hop (`pushChainFx`/`chainFx` array in the prototype) — without it, Chain
  Bolt is functionally identical to Bolt Turret and reads as "not working"
  even though it's dealing damage correctly.
- **Caustic Cloud**: toxic green (`#8aff4d`), ~55% opacity, bright rim, plus
  a few small animated pulsing "bubbles" inside — a flat 30%-opacity purple
  circle was nearly invisible against the busy background and also read as
  broken even though it was ticking damage correctly.
- **Growth nodes**: pulsing gold core with a faint influence-radius tint and
  a red HP bar — should always be the most visually "important-looking"
  thing on screen since they're the priority target.

## Known bugs found during development (do not reintroduce)

These cost real debugging time and are exactly the kind of thing that's easy
to silently reintroduce during a rewrite:

1. **Gems only drifted once already within a fixed pickup radius.** Weapons
   clear targets well outside any modest radius, so gems spawned outside it
   and never moved — XP could never accumulate. Fix: gems always drift
   toward the (stationary) core; "Magnetism" boosts drift *speed*, not a
   radius gate.
2. **Contact damage sampled too close to the core** (a small fixed offset),
   which was always inside the safe zone where growth is hard-gated to zero.
   The core was structurally unkillable by the infection. Fix: sample right
   at the visible safe-zone ring instead.
3. **Contact damage used raw density, not revealed/visible density.** Raw
   density can cross the damage threshold before a cell individually crosses
   *its* reveal threshold, causing HP loss with no visible slime on screen.
   Fix: gate the contact-damage sample on the same "is this actually
   revealed" check used for targeting.
4. **Reaction-diffusion numeric instability** — see the stability gotcha
   above. Diverges to NaN silently (no thrown error), producing a blank vein
   field. If the pattern generation ever looks wrong, check this first.

## Balance notes (tune, don't trust blindly)

Numbers were tuned using an automated headless script that pumped simulated
gameplay through a stubbed DOM and randomly picked upgrade cards — good for
catching whether XP/HP/nodes move at all and whether the game is completable
or literally unkillable/unloseable, **not** a substitute for real playtesting
feel. Current tuning knobs, all near the top of the script:

- `AMBIENT_BASE = 0.05` — global infection growth rate multiplier.
- `CONTACT_SCALE = 15` — how hard contact pressure translates to HP loss.
- `MAX_NODES = 5` — concurrent growth-node cap.
- XP curve and per-hit XP conversion (see formulas above).

A random-upgrade bot reached level ~26 with a healthy mix of all 6 weapons by
minute 11, died occasionally but not constantly. Treat this as "not broken,"
not "correctly tuned" — real balance needs your own playtesting pass.

## Suggested project structure (a starting point, not gospel)

Given the existing Vite + TypeScript + Canvas 2D + Web Audio setup already
planned for this project:

```
src/
  grid/        density field, reaction-diffusion, reveal/threshold logic
  weapons/     one module per weapon + shared cooldown/targeting helpers
  entities/    tower, nodes, projectiles, gems, particles
  systems/     simulation tick (growth/nodes/tiers), contact damage, frontier
  render/      canvas draw calls, separated from update logic
  ui/          HUD, upgrade cards, difficulty bar (could stay DOM/CSS or move to canvas)
  state.ts     central game state + freshState()
  main.ts      game loop
```

The prototype deliberately keeps everything in one file/closure for
portability; splitting along these lines should be mechanical rather than a
redesign, since the systems are already fairly decoupled (grid vs weapons vs
render).
