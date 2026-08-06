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

### 🔴 Phase 3A — Teardown (unblocked, ready to build)

The design rework is agreed (DECISIONS.md #23–#46). Reasoning lives in two
session records: `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
(what the game is) and
`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md` (how it
works). First implementation step:

- Remove growth nodes entirely — `systems/nodes.ts`, `tuning/nodes.ts`,
  node targeting in `weapons/poison.ts` and `weapons/missile.ts`, node
  damage in `grid/clear.ts`, `nodes` on `GameState`, `render/nodes.ts`,
  `systems/nodes.test.ts`.
- Rename `safeRadius` → `perimeter` throughout (Decision 36).
- Demote `TIERS_LIST` to flavour — names, announcements, colour only, no
  mechanical weight (Decision 33).
- Perimeter becomes a **fixed constant** (Decision 38), since the tier
  table no longer drives it.

Expect Missile and Caustic Cloud to lose their secondary behaviour until
Wave 1 coagulants land in 3C — intended, not a regression.

### The rest of the phase plan

Full detail in the session record §17.

| Phase | Content |
|---|---|
| **3B** | Infection Events framework — vein + bloom, full lifecycle |
| **3C** | Coagulants Wave 1 — conservation rules, Mote/Congealer/Behemoth → **playtest gate** |
| **3D** | XP economy rework → **playtest gate** |
| **4A–4C** | Maturity field, two-axis visuals, Coagulants Wave 2 → **playtest gate** |
| **5** | Arsenal framework — slots, gems, inventory UI, passives dissolved |
| **6** | Arsenal content — **own design session first**, then toward 20 weapons |
| **7** | Meta — currency, unlocks, deck builder |
| **8** | Terminal phase, real balance pass, leaderboard |
| **9** | VFX and feel |

**Known risks:** coagulant formation ("contiguous mass in a region" inside
the tick budget) is the one real technical unknown — prototype it first.
The test suite takes a hit; `nodes.test.ts` goes entirely and
`contact.test.ts`/`growth.test.ts` need rework. **Keep
`contact.test.ts`'s "undefended core dies" outcome test** — it survives
this redesign intact and is the best available proof the rework didn't
break lethality.

### 🟡 Balance pass — moved to Phase 8

Was Decision 13's "next step before all other work"; **superseded**. The
playtest found the problem is not numeric: player power scales 17–21×
across a run while the infection scales 3.1×, so no single value of
`CONTACT_SCALE` can be right at both ends. Tuning constants against a
threat model that is about to be replaced would be wasted work.

Balance math from 2026-08-05 preserved in the session record §3, including
the weapon DPS table (Blades 534 DPS vs Frost 17 DPS at level 8 — a 31×
spread), the Blades/Chain count-and-damage double-dip, and the hidden XP
distortion where gems track *hit count* rather than damage.

Still true and still unvalidated when the pass happens: `CONTACT_SCALE`,
`CREEP_RAMP`, and the fact that every run generates a fresh maze
(Decision 10) so runs are **not directly comparable**. A fixed-seed debug
option is the fix if that bites — don't reuse the field.

---

## Bugs and known limitations

### Found in the 2026-08-05 playtest — all absorbed by the rework

**None of these are worth fixing before their phase.** Every one sits
inside a system being replaced; fixing now means fixing twice. Listed with
the phase that absorbs each.

| Bug | Absorbed by |
|---|---|
| **Card descriptions read as "this does nothing."** Not a pool-filter bug — `buildCardPool()` filters maxed upgrades correctly. `frost`/`poison`/`missile` have *static* descriptions (`desc: () => '...'`, no level argument), and `bladeCount(7) === bladeCount(8) === 4` because the `min(…, 5)` cap is never reached at `maxLevel: 8` (same for `chainCount`, capped at 6 but topping out at 5). So a card correctly grants a damage increase and tells the player nothing changed. | Phase 5 — **killed at the root** by Decision 40: weapon *level* cards stop existing, so the failure mode has nowhere to live |
| **Ward Pulse has no visual whatsoever.** No `render/ward.ts` exists; `updateWardPulse` calls `clearAt` and nothing else. | Phase 5/6 — Ward becomes a gem |
| **Frost Nova's ring is nearly invisible.** 3px stroke, 0.4s life on a 3.6s cooldown (~11% uptime), fading alpha, low-contrast `#bfe9ff`. Also an expectation gap: it reads as an "aura" but is coded as an instantaneous pulse. | Phase 9 |
| **Frozen cells have no visual at all.** Confirmed by grep — zero references to `frozen` in `src/render/` or `grid/slimeLayer.ts`. A 2-second growth-suppression mechanic the player can never see. | Phase 4B |
| **Density palette collapses.** 5 buckets read as ~3: `#5c2430`/`#8a2f42` are both dark maroons, `#ff3f68`/`#ff7590` both bright pinks. Matters because density drives a ~10× resistance swing — it's a tactical readout the player can't read. | Phase 4B |
| **Screen shake fires only on contact damage.** Nothing else in the game shakes. | Phase 9 |
| **`pickThree` uses a biased shuffle** — `sort(() => Math.random() - 0.5)` is not a uniform permutation, so card appearance rates are skewed. | Phase 5 |

**Process finding:** Decision 11 established "a weapon's signature visual
is part of the weapon, not polish." Ward Pulse slipped through because
it's classed as a *passive*, and freeze slipped through because it's a
*field state*. **The rule should be scoped to any mechanic with a
world-space effect, not just weapons.**

### 🟡 Difficulty plateaus after Apocalypse (t = 560s)
`tuning/tiers.ts` has five tiers and stops escalating at the last one. A
strong build can coast indefinitely past ~9 minutes with no further
pressure.

**Superseded in approach, not in substance.** The rework removes the tier
table as a difficulty mechanism entirely (Decision 33) and replaces it
with emergent pressure plus a terminal phase (Decision 34). The plateau
still needs solving — Decision 35's currency model depends on runs
actually ending — it just isn't solved by extending the tier curve any
more.

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

### 🟡 Per-variable weapon upgrade tiers — absorbed into Phase 5
The original idea (separate upgrade paths per variable — Chain Bolt gets
more hops *or* more bolts *or* shorter cooldown as distinct choices) is
now the **extensions half of the PoE-style arsenal framework**
(Decision 32). Weapon data already lives in one central library
(`tuning/weapons.ts`, Decision 1) specifically so this expansion is one
file to edit.

`towerCenteredRadius()` (Decision 16) was built with a `base + perLevel`
term precisely so **range can become an upgradeable variable** rather than
being welded to the perimeter. Still the hook for a range-upgrade path —
and note Decision 26 makes range a genuinely *double-edged* stat, since a
wider engagement zone means a wider scar ring and more armoured spawns.

### 🟢 VFX and game feel — Phase 9
Deferred deliberately; shaping the game comes first. Running list beyond
the bug table above:

- Shake on missile impact, nova pulse, coagulant death, arrival, and tier
  escalation — currently contact damage is the only source.
- **Level-up has no moment** — the card overlay just appears. No flash, no
  time dilation, no sound.
- **Tier escalation should be a dramatic beat**, not a line of HUD text.
- Hit flash on cleared cells; gem pickup pop; low-HP vignette or
  chromatic pulse.
- Coagulant formation visual (tell → drain → rise → detach → crater) is
  **not** in this list — it's the telegraph system and ships with Phase 3C.

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

### 💭 Spontaneous coagulation — an anti-boredom floor
*Raised by the project owner, 2026-08-06. Agreed as an idea, deliberately
not a decision.*

Decision 28 makes infection events the **only** trigger for coagulant
formation. The owner's concern: veins and blooms rotate on a timer, and any
timer-driven system has dead air by construction, so a run could have long
stretches where nothing forms and nothing happens. A rare random spark
would set a floor.

**The framing that keeps it compatible with Decision 28:**

> Events set the rhythm. Spontaneous sparks set the floor.

It must never be a meaningful *fraction* of what spawns — only a minimum
below which the arena is never silent.

**Why it is dangerous.** It is Decision 28's problem restated: the
wilderness is ~76% of the arena and saturates in ~46 seconds, so anything
letting standing mass self-ignite at scale gives behemoths on tap from
minute one. That arithmetic does not change because the trigger is random.

**Guard rails agreed if it gets built:**
- A hard **global rate limit**, never a per-region probability — per-region
  probability times a large saturated wilderness is exactly how the failure
  happens.
- The **same bounded flood-fill mass check** as event formation, so a spark
  can never produce anything larger than the local field justifies.
- A **bias toward distant sites**, so it reads as a long dramatic charge
  rather than an ambush the player could not have anticipated.

Cheap to add once Decision 43's coarse density index exists. Revisit after
the 3C playtest, when it's clear whether dead air is actually a problem.

### 💭 "Orbital trade ship" — buying specific gems with score points
*Raised by the project owner, 2026-08-06.*

A deterministic escape hatch against card RNG: the player spends score
points to buy the gem they actually want, rather than waiting for the pool
to offer it.

**The problem it solves is real and sharper than pool size.** With gems
universally live once unlocked (Decision 41), the worry isn't that the pool
is too big — it's *bad luck*. Never being offered armor penetration in a
run where a Sclerotic is the thing killing you is a frustrating way to
lose, and it is not a loss the player could have played around.

Needs its own design pass before it's a decision: what score points are and
how they're earned, whether they compete with meta-currency (Decision 35's
survival-time currency) or are a separate in-run resource, and whether the
shop appears mid-run or between runs. Belongs with Phase 6/7.

### 💭 Filter the card pool by equipped weapons
The fallback if the gem half of the pool dilutes badly as the gem catalogue
grows (Decision 41's recorded consequence — fine at 15 gems, a problem at
60). Cards would only offer gems that fit a weapon actually being run.
Preferred over restricting unlocks, which would cost the emergent-build
discovery that made gems universal in the first place. Not needed until the
catalogue is large.

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
