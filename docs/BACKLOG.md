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

### 🟡 Phase 5 — Arsenal framework

**Phase 4 is fully shipped as of 2026-08-07** (4A/4B: Decisions 63–67;
4C-1/4C-2: Decisions 68–69) — the full coagulant roster from the 2026-08-05
design record §10 exists and forms from field state alone (mass, maturity,
mass-shape, corridor density), armour is live, and Carrier/Bulwark shipped
as the pair §10 asked for. Both 4C-1 and 4C-2 were self-greenlit per the
owner's standing 2026-08-07 instruction once each was tested and verified
live; see `docs/sessions/2026-08-07-phase-4c-wave2.md` for the full
account, including the two balance bugs the live debug-harness caught that
no unit test would have (bloom maturity rates too low to ever form a
Sclerotic; the mean-over-footprint dilution that made the original
threshold unreachable).

**Next up is Phase 5**, per the project's own go-linearly rule (below):
weapon/extension/gem slots, an inventory UI, and dissolving the current
flat passives into that slot system. See the session record §17 for scope.

**The arsenal design is settled at revision 3:**
`docs/plans/phase-5-6-arsenal.md` — 18 weapons, 65 support gems in six
classes, slot/socket/point economics, and a phasing that puts a four-stage
weapon *pipeline* (§4 of that doc) ahead of all content, because
transformative gems otherwise cost N-weapons × M-gems in hand-written
special cases. **23 calls settled** by the owner across 2026-08-08; what
remains open is measurement, not design.

**No decision is superseded** — the owner's one-+/-per-weapon model and
the no-cap/no-DR call between them left Decision 40 completely intact, so
socket-opening is a pure addition and the ground-truth override protocol
was never invoked.

**Phase 4's gate passed** — played by the owner 2026-08-08, *"all good."*
The scar ring did not read as oppressive (the design's own risk #4).

**A pre-refactor audit on 2026-08-08** re-read every decision, session and
plan against the arsenal design. It found **Ward Pulse is a working weapon
misfiled as a passive** — it has a cooldown, a tower-centred radius and
calls `clearAt`, but was classed as a passive since the port, which is why
it never got a visual and why it is the only weapon whose `clearAt` omits
`coagulantMult` despite Decision 50. It becomes **Immolation Ring** in
Phase 5A, which resolves all three at once. Two other work items came out
of the same pass; both are in §13 of the plan.

**Three things to read before starting**, all recorded in §12/§14 of the
plan:

- **Assist credit is the largest hidden cost.** Support weapons destroy no
  mass, and XP *is* destroyed mass — so targets must carry a short-lived
  record of which weapons affected them. New state on coagulants *and*
  grid cells, on hot paths. Scheduled into 5B; if it slips, five pieces of
  content ship as traps.
- **Phase 5 ships with pool dilution deliberately unmitigated.** All three
  fixes were declined in favour of measuring the real number, so the 5B
  gate is an explicit go/no-go on the 65-gem count.
- **Enhancement is a slider until the gate says otherwise** — that is
  Decision 40's own recorded, accepted risk, with the socket ladder as the
  only counterweight.

Note the plan also closes two items further down this file if built:
**More AoE weapons** (seven AoE weapons against today's two) and the
arsenal half of **Per-variable weapon upgrade tiers**.

### Phase 4C — done, for reference

Plans: `docs/plans/phase-4c1-wave2-armour.md` (Sclerotic, Blastoma, armour
from maturity, bloom's maturity payload, +50% weapon damage) and
`docs/plans/phase-4c2-carrier-bulwark.md` (Carrier's corridor-gated
identity and field-feeding, Bulwark's multi-part cluster-of-circles body).
Both carry "What changed during implementation" sections documenting the
as-built deltas. 4A's scoping conversation and as-built delta are in
`docs/plans/phase-4a-maturity.md`; the debugging account is in
`docs/sessions/2026-08-07-phase-4a-maturity.md`. 4B's plan and its single
as-built delta are in `docs/plans/phase-4b-two-axis-visuals.md`.

Projectile-blocking (an open question raised during 4C scoping) was scoped
**out** and moved to *Ideas* below.

### Standing rule — go phase by phase

Settled 2026-08-07, the owner's words: *"don't add answers that there are
no questions for yet."* Phase 4 was the **questions** (armor, penetration,
range-vs-callus, the full threat roster); Phases 5/6 are the **answers**,
now with a settled threat model to author against. Jumping to the arsenal
before Phase 4 closed would have been the ordering mistake §13 of the
design record and Decision 36 both warn against — which is exactly why 4C
wasn't compressed or skipped despite five sub-phases landing in one day.

**Where the reasoning lives:**
`docs/sessions/2026-08-05-slime-and-arsenal-rework.md` (what the game is —
**§4's no-aim premise especially; it has been violated twice and needed
correcting both times**), `2026-08-06-arsenal-and-coagulant-mechanism.md`
(how it works), `2026-08-07-xp-economy.md` (Phase 3D),
`2026-08-07-phase-4a-maturity.md` (Phase 4A),
`2026-08-07-phase-4c-wave2.md` (Phase 4C), and DECISIONS.md #23–#69.

**Still open, not urgent:** whether a behemoth crossing the arena reads as
dramatic or tedious, and whether the conservation rules feel right in
practice (motes shouldn't chain into behemoths — Rule 4). Both need more
playtesting than we've done to judge; neither blocks Phase 5.

### The rest of the phase plan

Full detail in the session record §17.

| Phase | Content |
|---|---|
| **3A–3D** | ✅ Complete — teardown, Infection Events, Coagulants Wave 1, XP economy |
| **4A** | ✅ Maturity field — scar accumulation, capped age floor, decay, resistance/regrowth/ceiling effects |
| **4B** | ✅ Two-axis visuals — density → alpha, maturity → colour; palette collapse and `frozen` visual both fixed |
| **4C** | ✅ Coagulants Wave 2 — Blastoma, Carrier, Sclerotic, Bulwark. **Phase 4 complete.** |
| **5** | Arsenal framework — slots, gems, inventory UI, passives dissolved → **next up** |
| **6** | Arsenal content — **own design session first**, then toward 20 weapons |
| **7** | Meta — currency, unlocks, deck builder |
| **8** | Terminal phase, real balance pass, leaderboard |
| **9** | VFX and feel |

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
| **Ward Pulse has no visual whatsoever.** No `render/ward.ts` exists; `updateWardPulse` calls `clearAt` and nothing else. **Root cause found 2026-08-08:** it is a *weapon* misfiled as a passive, so Decision 11's "a weapon's signature visual is part of the weapon" never applied to it — the same classification gap that hid `frozen`. **Reclassification shipped 2026-08-08** (Decision 70) — it is now `weapons/immolation.ts`, a real weapon, with its missing `coagulantMult` fixed. The visual itself is still open, deliberately deferred to Phase 6B as real content rather than retrofitted during the architecture-only 5A pass. | Phase 6B |
| **Frost Nova's ring is nearly invisible.** 3px stroke, 0.4s life on a 3.6s cooldown (~11% uptime), fading alpha, low-contrast `#bfe9ff`. Also an expectation gap: it reads as an "aura" but is coded as an instantaneous pulse. | Phase 9 |
| ~~**Frozen cells have no visual at all.**~~ ✅ **Fixed in Phase 4B** (Decision 66) — now a `#bfe9ff` rim, reusing Frost Nova's existing colour. Open since Phase 2; it was the precedent that forced 4A to ship a placeholder rather than shipping blind. | ✅ Done |
| ~~**Density palette collapses.**~~ ✅ **Fixed in Phase 4B** (Decision 66). The cause turned out to be uneven *spacing*, not bad hues — density now rides evenly-stepped alpha, so recollapse is structurally impossible and mechanically tested. | ✅ Done |
| **Screen shake fires only on contact damage.** Nothing else in the game shakes. | Phase 9 |
| **`pickThree` uses a biased shuffle** — `sort(() => Math.random() - 0.5)` is not a uniform permutation, so card appearance rates are skewed. **Priority raised 2026-08-08:** the 5B gate exists to *measure* card-pool dilution, and a skewed shuffle measures a distribution the game doesn't have. | Phase 5B — **before** the gate, not after |

**Process finding:** Decision 11 established "a weapon's signature visual
is part of the weapon, not polish." Ward Pulse slipped through because
it's classed as a *passive*, and freeze slipped through because it's a
*field state*. **The rule should be scoped to any mechanic with a
world-space effect, not just weapons.**

### 🟡 Immolation Ring is missing three balance passes the other six weapons got
*Discovered 2026-08-08 during the Ward Pulse → Immolation Ring promotion
(Decision 70).* Preserved deliberately, not fixed — 5A's charter was
architecture only, zero behaviour change. Immolation Ring currently:

- Does not respond to **Overclock** (`atkSpeedMult`) — its cooldown is a
  fixed 1.1s regardless of the passive.
- Does not respond to **Amplifier** (`damageMult`) — its damage is a bare
  `10 * lvl`.
- Never received Phase 4C-1's **`WEAPON_DAMAGE_SCALE`** (+50%) pass, which
  every other weapon's damage function carries.

All three exist because Ward Pulse wasn't classified as a weapon when
each of those was wired up, so its inline formula in the old
`systems/ward.ts` was never touched. `weapons/immolation.test.ts` pins the
Overclock gap with a regression test so it isn't undone by accident.

**This is a balance call, not a bug** — whether Immolation Ring should
join its six siblings on all three is the owner's decision. Natural home
is Phase 6B, when the weapon gets its actual content pass (visual,
extensions, attributes) alongside the rest of the new roster.

### 🟡 Infection events fire too often at the start of a run
*Found in the 2026-08-07 Phase 3D playtest.* The owner's read: the opening
minute has more veins/blooms than it should. Not fixed in 3D, which was
deliberately kept to the XP economy only.

The lever is `eventSpawnInterval()` in `tuning/events.ts` — currently a
straight lerp from `EVENT_INTERVAL_BASE` (26s) down to
`EVENT_INTERVAL_FLOOR` (10s) over `EVENT_INTERVAL_RAMP_TIME` (420s), plus
`EVENT_INITIAL_DELAY` (8s) before the first one. Raising the base and/or
the initial delay is the obvious fix; note per Decision 28 that event
frequency is *the* single pacing lever the design deliberately concentrates
everything into, so changes here move the whole game's rhythm, not just
its opening.

**Extended 2026-08-07 by the project owner, after the 4B playtest:**
*"we will have to tune the events, because I don't think the veins and
blooms should happen from the get-go, it's too hard — and veins are
significantly harder than blooms."*

Two separate levers, and the second one doesn't exist yet:

- **Delay the first event further.** `EVENT_INITIAL_DELAY` alone, cheap.
- **Weight vein vs. bloom by elapsed time.** `VEIN_WEIGHT` is currently a
  flat 0.6 for the whole run, so a vein is the *more likely* event from
  second one. Since a vein delivers mass close and on a short runway
  (§11) while a bloom is radial, local and further out, that ordering is
  backwards for the opening minutes. Ramping the weight — blooms early,
  veins increasingly likely later — is a new curve, not a constant tweak.

This also gives Decision 62's deferred "behemoths form too early" problem a
non-scripted lever, which is exactly the kind that decision asked for:
event *reach and frequency* rather than a spawn gate.

Worth doing alongside the Phase 4C playtest gate rather than alone —
maturity changes what an early event actually produces.

### 🟡 Coagulant formation has no drain — the crater appears instantly
*Raised by the project owner after the 4B playtest, 2026-08-07:* the
telegraph exists but is too weak, and *"when they do coagulate the crater
appears instantly and it just looks bad — it should visibly concentrate
slime towards a point and birth a coagulant, or some other way to smooth
out the transition."*

**This is a known gap, not a new idea** — §10 specifies a five-beat
universal formation visual and only three of them were built in 3C:

| Beat | State |
|---|---|
| **Tell** — region pulses, colour shifts | ❌ missing |
| **Drain** — density visibly flows inward toward a point | ❌ missing — this is the one the owner is describing |
| **Rise** — mass gathers and lifts out | ✅ (3C, `FORMATION_RISE_DURATION`) |
| **Detach** — separates and begins moving | ✅ |
| **Crater** — depleted hollow remains | ✅ but instant |

The drain matters beyond looks: §10 calls it **"Rule 1 made visible"** —
formation as a sink, shown rather than explained — *and* the entire
telegraph system for free, since a behemoth draining a crater is visible
from across the arena with no UI at all.

Implementation sketch: `attemptFormation` currently zeroes every flood-fill
cell in one frame. Instead it could stage the drain over
`FORMATION_RISE_DURATION`, decaying the cells toward zero while the blob
rises — the mass accounting is already correct, it's the *timing* that's
instant. Needs care with the mass-conservation invariant (mass would be
in-flight between containers for a second or so) and with the dirty set.

Natural fit alongside 4C, since Wave 2 adds four more formation events to
watch, or as part of the Phase 9 visual work.

### 🟢 More AoE weapons
*Project owner, 2026-08-07.* The current roster is thin on area damage:
Frost Nova and Caustic Cloud are the only real AoE, and both are among the
weakest (Frost is 17 DPS at level 8 against Blades' 534 — a 31× spread,
2026-08-05 record §3).

This matters more once Wave 2 lands: **Blastoma's stated counter is "AoE
cleanup"** and Bulwark's is "AoE, orbitals, pierce" (§10). Shipping enemies
whose counter barely exists is the same shape as the penetration problem
4A/4C already carry.

Belongs with **Phase 6's arsenal design session** rather than being bolted
on early — that session authors the catalogue against a settled threat
model, and Wave 2 is precisely what settles it. Noted here so the gap is
on the record when that session happens.

### 🟡 Behemoths can form too early in a run — deferred by decision
*Raised by the owner in the 2026-08-07 session; deferred deliberately —
see DECISIONS.md #62.* An early-run behemoth is effectively unstoppable,
and a vein injects mass fast enough to manufacture one before the player
has any answer to it.

**Do not fix this with a level gate or a time gate.** That contradicts
Rule 4 (Decision 27) — coagulant size is meant to be an emergent readout
of how badly the player is losing, never a script, and a spawn gate is
exactly the scripted difficulty lever the rework exists to remove.

Non-scripted levers if it's still a problem later: `MASS_BEHEMOTH`,
`FORMATION_RADIUS_CAP`, and per Decision 28 event frequency and reach
(which overlaps with the item above). Revisit once maturity and the
arsenal exist, since the answer likely changes once the player has real
counterplay.

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

### 🟢 Scarring may want its own colour, not the clay/bone ramp
*Project owner, 2026-08-07, on accepting the Phase 4B palette: "I think
scars will have to have a different colour, but we will see later."*

The shipped maturity ramp (hot pink → coral → clay → bone) reads correctly
as "drying and hardening," and the owner accepted it — but scarring
specifically may want to be more distinct rather than sitting on a
continuum with fresh slime.

Constraints if this is revisited: it has to stay legible against **cleared
black ground**, since that's where most scarring lives (Decision 66's 64%
figure), and it must not collide with the colours already spoken for —
cyan (tower/gems/UI), yellow-green (Caustic Cloud), purple (chain), orange
(missile), pale blue (frost/frozen rim). Cheap to change now that the whole
palette is one file (`src/tuning/palette.ts`) with invariant tests around
it. Natural companion to the Phase 9 visual overhaul.

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

### 💭 Does calcified tissue block projectiles?
*Open question 4 from the 2026-08-05 record §18. Its recommendation was
"prototype in Phase 4 and decide from feel"; the project owner scoped it
**out of 4C** on 2026-08-07 — recorded here rather than left dangling.*

**High impact, and the riskiest single item in the design.** It would
differentiate whole weapon families (projectile vs. orbital vs. aura) and
revive the parked Scalpel/Lance, which lost its justification when the
no-aim correction killed artery-cutting. It also directly answers §13's
finding that the arsenal has **nothing that scales up against density** —
every weapon is currently *worse* against dense tissue.

**Why it's dangerous:** a crust that neutralises your main weapon could
feel awful, and the player has no way to reposition around it (no aiming,
no movement — §4). Decision 44's armor floor addresses the milder version
of the same risk; there is no equivalent floor for "the shot doesn't
arrive at all."

Now more prototypeable than when it was written: 4A/4B mean calcified
ground both exists and is visible, so a prototype can be judged on feel
rather than imagined. Natural home is the Phase 4C playtest gate or Phase
5, once penetration exists as a real counter.

### 💭 Genuine pathfinding for vein geometry
*Raised by the project owner, 2026-08-06, during the 3B review.*

Veins currently generate a jagged branching polyline via recursive
midpoint displacement — a lightning-bolt construction, unrelated to the
field's own terrain (Decision 49). The owner's original instinct was that
a vein should genuinely route through the coral maze pattern
(`grid.vein`/`veinField.ts`) rather than draw an independent shape over
it — "the infection follows its own veins" as a thematic idea, not just a
visual one.

**Why it didn't ship now:** the coral pattern is a static texture with no
traceable edge-to-core routes baked into it — turning it into a graph
means either a real pathfind (A* or similar over low-threshold cells) or
a corridor-following walk, and either way there's no guarantee a route
exists at every possible spawn angle. The lightning-bolt approach ships
today with zero risk of failing to find a path and produces the branching
lattice Blastoma (Wave 2) needs for free.

**Worth exploring later:** blend the two — bias the recursive
displacement's midpoint offsets toward locally low-threshold cells (dense
coral) instead of pure randomness, so the vein still can't fail to reach
the core but visibly prefers to travel along the existing pattern. Cheaper
than real pathfinding and keeps the "no path exists" failure mode
impossible by construction. Not blocking anything; revisit whenever the
vein's current look feels too generic against the field it's punching
through.

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

Cheap to add once Decision 43's coarse density index exists.

**Update, 2026-08-07 — the 3C/3D playtests have now happened, and they
found the opposite problem.** No dead air was reported; the owner's note
was that events fire *too often* early (see the Bugs section above). So the
floor this idea exists to provide isn't currently needed, and adding it now
would push in the wrong direction. Not rejected — the underlying concern
(timer-driven systems have dead air by construction) is still sound and may
resurface once event frequency is retuned downward. Just no longer waiting
on a trigger that has already fired.

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

- **Phase 3A — Teardown.** *(2026-08-06)* Growth nodes removed entirely
  (`systems/nodes.ts`, `tuning/nodes.ts`, `render/nodes.ts`, node targeting
  in `poison.ts`/`missile.ts`, node damage in `clear.ts`). `safeRadius`
  renamed to `perimeter` throughout and fixed as a constant (Decision 38).
  `TIERS_LIST` demoted to name/t/color only; the mechanical values it used
  to carry moved to their own owners — ambient escalation is now its own
  time-driven curve and contact damage no longer scales by tier at all
  (Decision 47, found mid-implementation — the original plan only accounted
  for the perimeter). 136/136 tests passing (down from 153 — `nodes.test.ts`
  removed, node-dependent cases pruned from six other files), typecheck and
  build clean, verified live in-browser (level-up, card picks, and Homing
  Missile's now-fixed description all confirmed working with no console
  errors).

  **Left deliberately incomplete, both by explicit instruction — both
  closed out by Phase 3C, below:**
  - ~~Homing Missile no longer homes onto anything~~ — resolved for free
    once `nearestFrontierPoint` gained a coagulant surface pass (Decision
    45); missiles now home on coagulants without any missile-specific code.
  - ~~The kill counter (`nodesPurged`) is dormant~~ — wired to coagulant
    kills in `splatterOnDeath`.

- **Phase 3B — Infection Events.** *(2026-08-06)* One system, two variants
  (Decision 29), sharing a lifecycle: telegraph -> active -> peak -> decay
  -> removed (`systems/events.ts`, `tuning/events.ts`, `render/events.ts`).
  Vein geometry is a branching polyline built once at telegraph time via
  recursive midpoint displacement — the standard lightning-bolt
  construction — rather than the originally-sketched `veinField` reuse,
  which turned out to be a texture with no traceable edge-to-core routes in
  it (Decision 49). Bloom ships now despite its real payload (accelerating
  maturity) waiting for Phase 4A, so the event framework has one lifecycle
  from day one instead of a second variant bolted on later (Decision 48,
  the project owner's call: "build it now"). Growth injection for both
  reuses the existing "read density, converge toward 1, update
  bucket/dirty" shape from `applyAmbientGrowth`/the old node influence —
  events are just another source writing into the same grid.

- **Phase 3C — Coagulants Wave 1.** *(2026-08-06)* The identity change
  lands: coagulants (`state.coagulants`) form from infection events at
  peak, walk a straight line to the core, and either get killed or arrive.
  New modules: `systems/formation.ts` (bounded flood-fill),
  `systems/coagulants.ts` (movement/arrival/death/collision),
  `render/coagulants.ts` (seed-circle blob rendering), `tuning/coagulants.ts`.

  **Mass is one currency in two containers, exactly as Decision 42
  specified.** Coagulants carry `mass` and nothing else as HP — `clearAt`
  (`grid/clear.ts`) gained a second loop damaging coagulants via
  hit/body overlap area (`circleOverlapArea`, `util/math.ts`) rather than a
  flat per-weapon constant, so a wide splash weapon genuinely excels
  against big targets and a precise weapon isn't wasted on a mote inside
  its blast (Decision 50). Two damage dials: `COAGULANT_DAMAGE_SCALE`
  (global, the requested support-gem hook) and `WeaponDef.coagulantMult`
  (per-weapon, defaulting to 1 but actually *read* by every weapon's
  `clearAt` call — not just some of them, so a future edit to the field
  can't silently do nothing).

  **Collision needed its own pass beyond damage math.** Coagulants are
  entities, not grid cells, so `isRevealedIdx`-gated collision (bolt,
  chain, missile, blades) couldn't see them at all — each gained an
  explicit coagulant check alongside its grid check
  (`findCoagulantHit`/`systems/coagulants.ts`). This is also what restored
  Homing Missile's homing, for free, once `nearestFrontierPoint` started
  returning coagulant surfaces too (Decision 45).

  **Arrival deposits mass by growing outward until it all fits** (Decision
  51), not a fixed disc — grid cells cap at 1, so a large arrival needs
  real area or it evaporates. Verified as an exact invariant: total mass
  (grid + entities) returns to where it started across a full
  formation → transit → arrival cycle with no combat involved
  (`systems/coagulants.test.ts`).

  **The XP value cap was pulled forward from Phase 3D**, per the project
  owner's agreement during planning — `gemValueFromRemoved`'s
  `clamp(…, 0, 10)` is gone, so a 20-second behemoth kill doesn't pay the
  same as a routine bolt hit. The rest of Decision 31 (superlinear curve,
  gem showers, risk premium) stays in 3D.

  **Two bugs caught during the live verification pass, not by the test
  suite** — recorded because the class matters as much as the fix:
  - The flood-fill's radius cap used a Chebyshev (square) bound; against
    a saturated field it produced a crisp square crater on screen, which
    no mass-summing unit test could have caught. Fixed to true Euclidean
    distance (Decision 52).
  - Folded in per the project owner's request: 3B's vein rendering put a
    round cap on every segment joint (a string of beads, not a bolt) —
    fixed to one continuous stroked path for the trunk and tapered
    per-segment strokes for branches, so branches end in genuine points
    (Decision 53).

  217/217 tests passing (up from 165 across `formation.test.ts`,
  `coagulants.test.ts`, and extensions to `clear.test.ts`,
  `frontier.test.ts`, `projectiles.test.ts`, `blades.test.ts`,
  `math.test.ts`, `xp.test.ts`), typecheck and build clean. Verified live
  in-browser across several runs: watched coagulants form out of both vein
  and bloom peaks, walk toward the core, take damage from Bolt/Chain/
  Missile, and a core death from an early arrival — a legitimate first-pass
  balance outcome, not a bug, and exactly what the playtest gate exists to
  surface. No console errors in any run beyond the documented Vite
  self-reload quirk.

  **Left for the playtest gate, not this phase:** every number
  (thresholds, radii, speeds, arrival damage, splatter). Agreed dials:
  arrival speed and arrival mass (Decision 27).

  164/164 tests passing (up from 136 — 28 new: 6 pure-geometry tests for
  the vein polyline, 22 for lifecycle/injection/spawning), typecheck and
  build clean (59 modules, up from 53). Verified live in-browser across two
  runs: watched a vein telegraph faintly, activate and visibly extend
  inward with branches, and inject growth that shows up in the slime layer
  as the vein's own shape; watched a bloom telegraph as a pulsing ring and
  inject a visible radial bump of denser slime. No console errors in either
  run beyond the documented Vite self-reload quirk.

  **Left for the idea backlog rather than built now:** biasing the vein's
  displacement toward the field's own coral pattern instead of pure
  randomness, raised by the owner as "the infection follows its own veins."
  See *Ideas* above.

- **First 3C playtest-and-fix round.** *(2026-08-06, second playtest and
  final speed cut 2026-08-07, kept dated 2026-08-06 as one gate)* Four
  bugs from the first playtest, all fixed: coagulants now rise and fade in
  over 1.8s before they can move, be targeted, or arrive
  (`CoagulantPhase`, Decision 54); formation is hard-gated away from the
  core (`FORMATION_MIN_DISTANCE`, Decision 55) and veins stop short of the
  perimeter instead of aiming at the tower (`veinTargetPoint`, Decision
  56); coagulant speed became a continuous mass-based function and, along
  with ambient growth, was cut roughly in half twice across the two
  playtests (Decision 57) — the escalation curve and the inverse-sqrt
  mass-to-speed shape were both left alone on purpose, only the base
  magnitude moved. `depositMass` also picked up a genuine O(ring³) →
  O(ring) algorithmic fix (Decision 58) during a debug-harness-driven lag
  investigation (Decision 59) whose honest conclusion was "probably not
  the game" rather than a confirmed fix — the browser's own Long Task
  API recorded zero long tasks under a provoked worst case. A direct
  question about whether the browser itself was the ceiling was raised and
  answered no (Decision 60): no evidence Canvas 2D was the bottleneck, and
  the procedural asset generation ports to any target at the same cost
  regardless.

  231/231 tests passing (up from 217 — 14 new across `coagulants.test.ts`,
  `formation.test.ts`, `frontier.test.ts`, `events.test.ts`), typecheck and
  build clean. Verified live in-browser after the final speed cut: a fresh
  run on the starting weapon plus organic level-up picks reached level 7 /
  t=1:29 with core integrity still full and two active coagulants on
  screen not threatening the core — a different outcome from the first
  playtest's early death on a comparable loadout.

- **Phase 3D — the XP economy. Phase 3 closes.** *(2026-08-07, Decision
  61)* The pacing lever for levelling is what a level **costs**, never what
  a kill **grants** — the project owner's framing, and load-bearing rather
  than stylistic: granted XP has to stay honest to destroyed mass or
  Decision 31's anti-farming guarantee collapses the moment "which mass is
  worth more" becomes tunable. `xpToNext` went quadratic
  (`12 + 6.5·L + 0.45·L²`), identical to the old linear curve at level 1 so
  the intended early rush survives, ~2.3× its cost by level 20. The risk
  premium landed at **15%** — below Decision 31's floated 25–50% and below
  Claude's own recommendation, because the field-neglect farming failure
  mode gets worse the higher it goes — and applies to the coagulant share
  of a hit only, exactly as Decision 42 anticipated.

  **The "one behemoth kill = three level-ups" problem had its fix already
  in the plan, unrecognised.** The curve alone can't solve it (at low level
  a threshold is ~19–30 XP against a behemoth paying hundreds), but §12's
  two separate notes — gem showers on big kills, and gems staying physical
  and drifting — read together are a *rate limiter*: gems are the XP
  delivery mechanism and delivery takes time, so a shower arrives as a
  stream and level-ups spread themselves. One genuine addition on top:
  per-gem drift jitter, since a behemoth killed *at the perimeter* has no
  drift distance and would otherwise clump in exactly the case that matters
  most. The `freshState()` fast-first-level shim (`xpToNext: 10`) is gone.

  241/241 tests passing (up from 231 — 10 new, written against the curve's
  *shape* rather than its coefficients so a retune doesn't break them),
  typecheck and build clean. **Playtested by the owner: "it plays much
  better now."**

  **Deliberately not done:** removing the modal level-up pause (the real
  fix if showers prove insufficient — belongs with Phase 5's card-pool
  restructure), and gating behemoth formation (Decision 62, deferred; see
  Bugs above).

- **Phase 4A — the maturity field.** *(2026-08-07, Decisions 63–65)* The
  terrain layer exists: `growth` is quantity, `maturity` is quality, and
  the arena now hardens exactly where the player fights while the
  wilderness stays soft. `tuning/maturity.ts` + `systems/maturity.ts`, with
  scar gain riding the loop `clearAt` already runs. §7's unspecified
  age-vs-decay conflict resolved by making age a **floor** rather than a
  gain — one scalar per tick, no per-cell age state.

  **The reason this entry is long: five defects, all found by running the
  game, none by the test suite — and three had passing tests written
  against the broken behaviour.** The transferable lesson is the pattern,
  not the fixes:
  - Scar accumulation produced *literally zero* net maturity anywhere,
    because decay ran flat every tick while gains arrive tiny and sparse.
    The existing outcome test passed because it hit the same cell every
    single tick — gain landing as often as decay always wins, whatever the
    rates.
  - An **absolute** virgin growth ceiling (0.85) sat below `grid.threshold`'s
    0.94 cap, making **22.3% of the arena permanently unrevealable** —
    caught in the owner's playtest ("top left area all black"). Now a
    fraction of each cell's headroom above its own threshold, so the
    failure is impossible by construction (Decision 64).
  - Ambient growth was clawing density back down to the ceiling, which
    would have silently undone every vein and bloom.
  - Rate and ceiling cancelled each other exactly — "slower, to a higher
    ceiling" had become "same speed."
  - The placeholder was invisible by construction: scarring lives on
    cleared ground, which has no slime beneath it, so 64% of it was black
    drawn on black (Decision 65). Now neon green, kept deliberately garish
    at the owner's request until 4B replaces it.

  273/273 tests passing (up from 241), including replacements for the three
  tests that had been passing against broken behaviour. Verified live: map
  fills edge to edge with zero permanently-stuck cells, green scar ring
  forms around the cleared combat zone.
