# Slime TD — Decision Register

Every load-bearing decision on this project, with its reasoning.

**Read this before changing anything that looks odd.** A lot of "odd" here
is deliberate, and several entries exist specifically because the obvious
"fix" would reintroduce a bug that already cost real debugging time.

**Adding a decision:** append with the next number, dated, with the
*reasoning* not just the outcome — the reasoning is what stops a future
session from re-litigating it. Never renumber; other documents and code
comments reference these by number. If a decision is later reversed, mark
it superseded in place and add a new one rather than editing history (see
#14 and prototype bug #2 for how that reads).

**Status legend:** ✅ implemented · 📋 policy (ongoing, not code) ·
⚠️ superseded

---

## Architecture and code shape

**1. Weapon data lives in one shared library file, not one file per
weapon.** ✅
*2026-08-05.* `tuning/weapons.ts` holds all six weapons' upgrades, tiers,
and tunable variables together, so balance edits mean opening one file
instead of six. Behavior code still splits per weapon (`weapons/*.ts`)
where that helps, but the *data* stays centralized. Changed from an
initial "one file per weapon" proposal.

**5. HUD and upgrade cards are DOM/CSS overlaid on the canvas.** ✅
*2026-08-05.* Ported from the prototype's markup rather than redrawn as
canvas calls. Consequence, accepted deliberately: the HUD lives in
*screen* space, so it does not scale with the letterboxed 1920×1080 arena
and will sit over the letterbox bars on non-16:9 windows. Intended — HUD
text stays crisp and readable at any window size.

**16. Tower-centered weapon radii use an anchor as a *floor*, never a
lock.** ✅
*2026-08-05.* `towerCenteredRadius()` in `tuning/weaponGeometry.ts`
returns `max(safeRadius + margin, base + perLevel * (lvl - 1))`.

The first term guarantees a weapon can always at least reach the
infection boundary at any tier, however the tier table is later retuned.
The second keeps reach as something levels — and future explicit
range-upgrade paths — can push outward.

Deliberately *not* welded to `safeRadius`: that would corner the upgrade
design by making range un-upgradeable. Collapsing to either pure behavior
later is a one-line change. Applies to Orbiting Blades, Frost Nova, and
Ward Pulse. See prototype bug #5 for what this prevents.

---

## Port fidelity — deliberate deviations from the prototype

> The prototype is archived and non-authoritative as of 2026-08-05, but
> these entries explain *why* specific behavior differs, which still
> matters when reading old code comments.

**4. `novaFx` frame-rate-dependent decay is fixed at port time.** ✅
*2026-08-05.* The prototype decremented `novaFx.life` by a hardcoded
`1/60` *inside its render call* — mutating state during a draw and going
wrong at any framerate but 60fps. Ported correctly from the start
(`systems/novaFx.ts`) rather than porting the bug and fixing it later.

**7. The prototype's double-level-up bug is fixed at port time.** ✅
*2026-08-05.* `grantXp()` looped `while(xp >= xpToNext)` calling
`onLevelUp()` each pass, which rebuilt the upgrade overlay from scratch —
so crossing two thresholds in one grant showed cards twice and the second
render replaced the first, silently costing the player an upgrade. Not
reachable at the prototype's numbers, but it becomes reachable the moment
gem values or the XP curve are tuned up. Level-ups now queue
(`pendingLevelUps`) and are consumed one card at a time.

**A third instance, same class:** `bubbleSeeds` for Caustic Cloud were
lazily created *inside the draw call* in the prototype. Now generated
once at cloud creation (`weapons/poison.ts`), and
`CausticCloud.bubbleSeeds` is required rather than optional.

**10. The vein maze is regenerated on every run.** ✅
*2026-08-05.* Restart re-runs the reaction-diffusion, so each run gets a
different pattern — suits a roguelite. Costs ~200ms of startup hitch per
run, accepted. Note this makes runs *not* directly comparable for balance
work; if that bites while tuning, a fixed-seed debug option is the fix,
**not** reusing the field.

**17. Orbiting Blades render as ninja stars.** ✅
*2026-08-05.* A 4-pointed shuriken with its own spin independent of
orbital position, rather than the prototype's plain cyan dots, so they
read as blades rather than orbiting blobs.

---

## Safe-zone semantics

> Decisions 14–20 came out of reviewing Phase 2E and are one connected
> problem: the prototype's safe zone was too large, impassable, and
> measured in absolute units no weapon could reach out of. Shipped
> together as commit `081e07a` (2E-1).

**14. The safe-radius tier table shrinks to 100 → 85 → 70 → 58 → 45.** ✅
*2026-08-05.* From the prototype's 190 → 170 → 145 → 120 → 95. The
infection now sits visibly close from the start and genuinely crowds the
core at Apocalypse.

**This does not make the game harder** — and that was checked, not
assumed. Contact damage sampled at `safeRadius + 1.5` cells, so the damage
ring moved inward with the zone, and the growth ramp there is a function
of distance-past-boundary, not absolute position (measured: 0.096 →
0.091, ~5% *slower*). This buys tension and weapon viability, not
difficulty. Difficulty lives in `CONTACT_SCALE` / `AMBIENT_BASE` /
`infectionMult`.

*(The ring-sampling rationale above is superseded by #18, which replaced
the ring entirely. Kept for the historical reasoning on why the table
shrank.)*

**15. Ambient growth creeps *into* the safe zone at a damped rate.** ✅
*2026-08-05.* The prototype's `applyAmbientGrowth` did
`if (d < safeRadius) continue`, so infection could **never** physically
reach the tower — only growth nodes could push density inside, and a lost
run meant dying to slime still 100+px away. Confirmed with the project
owner as unintended prototype behavior, not a design choice. The safe zone
is now a strong *resistance gradient* instead of a wall, so "Core
Overwhelmed" means the core is actually being consumed.

**Damping curve.** The naive approach — multiply growth by a damping
factor inside the line — does not work: the outside ramp
`pow(clamp((d-safeRadius)/span, 0, 1), 0.6)` is *already exactly 0* at
`d = safeRadius`, so any product with it is 0 everywhere inside. The two
formulas cannot share a root. So the inside gets its own rate:

```
proximity = clamp((d - towerRadius) / (safeRadius - towerRadius), 0, 1)  // 0 at tower, 1 at line
inside:   rate = AMBIENT_BASE * infectionMult * CREEP_RAMP * proximity   // linear
outside:  rate = AMBIENT_BASE * infectionMult * max(ramp, CREEP_RAMP)    // unchanged, floored
```

Proximity is **linear, not squared** — squared was computed and rejected:
it damps growth 30px from the core to a ~1900s time-to-visible, which is
effectively "never" and defeats the purpose. Linear gives ~110s for an
*undefended* core: survivable with any working weapon, lethal if ignored.

This keeps outside pacing and both global multipliers untouched, so *"make
the whole game harder"* (`AMBIENT_BASE`, `infectionMult`) and *"make
breaches specifically more punishing"* (`CREEP_RAMP`, the proximity
exponent) stay **independent knobs** rather than coupled through one
formula.

**Nodes bypass this damping.** Ambient is the slow tide; an uncleared node
is the breach. That distinction is what makes a node near the tower a
genuine emergency. No *additional* "nodes spawn closer at higher tiers"
lever was added — that already happens for free, since node spawn distance
is derived from `safeRadius` (`rand(safeRadius + 70, maxRange - 30)`),
which #14 shrinks across tiers: closest possible spawn goes 170px → 115px,
~32% tighter. Stacking an explicit multiplier on top of both the free
shrink *and* the damping bypass was judged likely to overshoot. Revisit in
the balance pass if it doesn't bite hard enough.

**18. Contact damage is a depth-weighted average over the disc inside the
line.** ✅
*2026-08-05.* Not a fixed ring sample outside it:

```
weight   = 1 - (d / safeRadius)          // 1 at the core, 0 at the line
pressure = sum(revealed density * weight) / sum(weight)
damage   = pressure * contactMult * CONTACT_SCALE * dt
```

Zero when the zone is clear (a real grace period — clearing a breach
genuinely stops the bleeding), volume-aware (a wide breach hurts more than
a narrow finger), and depth-aware (slime touching the core counts far more
than slime just over the line, so a nibble is survivable but being
engulfed is fast and lethal).

Side benefit: `contactPressure` already drove the tower's danger-pulse
ring from Phase 1, so that visual now reads true instead of reflecting a
fairly meaningless ring-average.

`CONTACT_SCALE = 15` was tuned for the *old* sampling method — treat it as
a fresh guess, not a carried-over constant. `CONTACT_FLOOR` landed at 0.02
so a single revealed edge cell doesn't chip the core. Cost is negligible
(~237–289 cells/tick at 5.5 ticks/sec).

**19. The danger-line ring keeps its cyan "sanctuary" framing and reacts
to breach.** ✅
*2026-08-05.* Rather than being restyled as a hazard colour. The line
meaning what it should — cross it and the core is threatened — reads as
*more* tense precisely because the space inside still visually says
"yours to defend," not because the ring looks dangerous by default. It
shifts colour, thickens, and brightens toward danger red as
`contactPressure` rises, making the ring itself a live "how badly is this
being breached" signal. In `render/background.ts`'s `drawSafeZone`.

**20. Documented prototype bug #2 is superseded, not merely re-guarded.**
✅
*2026-08-05, with the project owner's explicit go-ahead per the
ground-truth override protocol (#22).*

Bug #2's rule — "sample at the ring, never closer" — was correct advice
*only* because growth was hard-gated at the line, making near-core space
guaranteed empty; sampling closer really was sampling nothing. #15 removes
that gate on purpose, so the specific rule no longer applies. The
underlying invariant it protected — **the core must actually be
killable** — matters as much as ever.

So the regression test was replaced with an **outcome test rather than a
mechanism test**: run the real simulation with no weapons and assert the
tower (a) takes lethal damage when the zone is left dirty, and (b) takes
none when it's kept clear. This is strictly stronger than asserting
"sampled at the correct radius" — it also catches a reintroduced hard
gate, a wrong sample region, a broken damage formula, or a bad damping
constant, none of which would trip the old assertion.

In `systems/contact.test.ts`: an undefended core dies in ~520 ticks
(budget 5000, ~10× margin for retuning), and takes zero damage across 3000
ticks when scrubbed clean despite growth ticking throughout.

---

## Process and workflow

**3. Pause after 2C for a real playtesting pass.** ✅
*2026-08-05.* Before building the remaining systems on top of it — feel
problems are far cheaper to catch early than at the end of the port. This
paid off: the playtest found the upgrade-visibility gap that became #8.

**8. The modifier readout ships as part of 2D.** ✅
*2026-08-05, after the first playtest.* Not as a later pass. 2D introduces
Armor Plating, Regeneration, and Vitality — the three least-visible
passives in the game — so deferring it would have hit the "did my pick do
anything?" blind spot three more times, on the picks where it's hardest to
self-verify.

**11. Phase 2F is dissolved into 2E; each weapon ships with its
visual.** ✅
*2026-08-05.* Everything 2F held — chain lightning arcs, caustic cloud
bubbles, nova ring — is the signature visual of a weapon shipping in 2E,
and these aren't cosmetic: Chain Bolt and Caustic Cloud both *"read as
broken"* without them, and Frost Nova is an invisible untargeted pulse
without its ring. A playtest of a weapon that misrepresents itself is
worthless.

This was the third application of the same principle, after gem diamonds
moved 2F→2C and node gold pulse moved 2F→2D. **Generalized rule: a
weapon's signature visual is part of the weapon, not polish.**

**12. Weapons are committed one per commit.** ✅
*2026-08-05.* Each independently verifiable in the browser — easier to
review, easier to bisect if one misbehaves, and it leaves room to playtest
partway through.

**13. A balance + playtesting pass follows the port**, before any other
backlog work. 📋
*2026-08-05.* Before the endless-scaling tail, the weapon upgrade-tier
system, audio, or the leaderboard. The port's completion is the first
point balance can be judged honestly — the prototype's numbers were
validated against exactly the six-weapon, eight-passive state that now
exists.

**21. PROGRESS.md is compressed once the port completes.** ✅
*2026-08-05.* The per-phase entries carried a lot of "why we decided this"
detail that earned its place during the work and became noise afterward.
Phase history compresses; decisions move here; PROGRESS.md becomes a
living session tracker. *Done — this file is part of that restructure.*

**22. Ground-truth override protocol.** 📋
*2026-08-05.* Neither the prototype nor its handoff doc gets overridden or
superseded without asking the project owner first, **even when the
reasoning seems solid**. If a piece of ground truth looks wrong rather
than just different from a new design decision, raise it explicitly and
wait for a yes.

Recorded in `CLAUDE.md`. #20 is the live example — and note *why* it
needed the rule: bug #2 was correct advice for its own design and only
became wrong because the design changed underneath it. That's exactly the
category where asking matters, versus the clear self-contradictory bugs in
#4 and #7 which were flagged and fixed without ceremony.

*(Now that the prototype is archived and non-authoritative, this applies
mainly to reading archived material for historical context — but the
underlying instinct, "raise it rather than decide unilaterally," still
stands.)*

---

## Superseded / historical

**2. Slime layer renders at 1×.** ✅
*2026-08-05.* World units, even on 4K screens. Revisit only if it visibly
bothers on a real high-DPI display — and then as a user-facing resolution
slider rather than a hardcoded bump, since that doubles as a performance
escape hatch. See BACKLOG.

**6. 2C's upgrade-card pool offered five passives, not eight.** ⚠️
*2026-08-05. No longer in force — superseded by 2D shipping.* Vitality,
Regeneration, and Armor Plating were gated out of the pool during Phase 2C
because nothing damaged the core yet, making them dead, unverifiable
picks. Their numeric effects were also deliberately not built (untestable
dead code). All three landed in 2D alongside contact damage. Recorded
because the *pattern* is reusable: don't offer a player a choice the game
can't yet make meaningful.

**9. Start and game-over overlays both ship in 2D.** ✅
*2026-08-05.* The start overlay was ported alongside the game-over overlay
2D needed anyway — it gives restart somewhere to land, and its blurb is
the only place a first-time player learns what nodes are and why carving
matters.

---

## Documented prototype bugs

Bugs 1–4 came from the prototype's own handoff doc — each cost real
debugging time once already. Bug 5 was found during the Phase 2E review.

**These are guarded by tests, not by memory.** That's deliberate; the
whole category is "easy to silently reintroduce during a rewrite."

**1. Gems must always drift toward the (stationary) core.** Never gate
drifting behind a fixed pickup radius. Weapons clear tissue well outside
any modest radius, so a radius gate means gems spawn outside it and never
move — XP can never accumulate. Magnetism boosts drift *speed*, not a
radius gate.

**2. ⚠️ SUPERSEDED 2026-08-05 — do not "fix" this back.**
Originally: contact damage must sample right at the visible safe-zone ring
(`safeRadius + 1.5` cells), never closer, or the core is structurally
unkillable. That held *only* because ambient growth was hard-gated to zero
inside `safeRadius`. Decisions #15 and #18 removed that gate and replaced
the ring sample with a depth-weighted disc average — **sampling near the
core is now correct, not broken.** If you're reading this because contact
damage looks like it samples "too close": it's supposed to. See #20.

**3. Contact damage and XP must gate on `isRevealed`** (growth >
threshold), never raw density. Raw density can cross a damage/XP threshold
*before* a cell is actually visible, draining HP with no slime on screen.
Unaffected by #20 — this half of bug #2's guidance still fully applies.

**4. Reaction-diffusion must respect `D * step <= ~0.25`** or it silently
diverges to NaN — a blank field with no thrown error, not a crash. Guarded
by a canary test in `grid/veinField.test.ts` that proves the suite would
actually catch a regression rather than passing vacuously.

**5. Tower-centered weapons must never have a radius smaller than
`safeRadius`.** Density there is always lowest, so such a weapon is aimed
at effectively empty space. In the prototype, Orbiting Blades orbited at
64–78px while the *smallest* safe radius ever reached was 95 — and blades
only fire when the blade's own cell is revealed. **Result: Orbiting Blades
could not hit ambient infection at any tier, at any level, in any run.**
They only ever connected with density a growth node happened to push
inside. Ward Pulse and Frost Nova were degraded the same way, less
severely. Now structurally prevented by `towerCenteredRadius()` (#16) plus
a test asserting the invariant across every tier and level.
