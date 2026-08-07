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

**13. ⚠️ SUPERSEDED — A balance + playtesting pass follows the port**,
before any other backlog work. 📋
*2026-08-05. Superseded the same day by #23–#37.* Before the
endless-scaling tail, the weapon upgrade-tier system, audio, or the
leaderboard. The port's completion is the first point balance can be
judged honestly — the prototype's numbers were validated against exactly
the six-weapon, eight-passive state that now exists.

*The playtest happened and produced the opposite conclusion: the problem
is not numeric. Player power scales 17–21× across a run while the
infection scales 3.1×, so no value of `CONTACT_SCALE` can be right for
both ends of a run. Balance moves behind the slime and arsenal rework
(#23 onward) and lands in Phase 8. See
`docs/sessions/2026-08-05-slime-and-arsenal-rework.md` §3.*

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

## The design rework — target design for the game

> Decisions 23–37 came out of the design session on 2026-08-05 (evening),
> after the first full playtest of the completed port. They describe the
> **target** design, not the shipped one — as of writing, none of it is
> implemented. The full reasoning, including every rejected alternative
> and the numbers behind each call, is in
> **`docs/sessions/2026-08-05-slime-and-arsenal-rework.md`**. Read that
> before revisiting any of these.

**23. The game is a no-aim autoshooter, and that is a hard design
constraint.** 📋
*2026-08-05.* The player never aims and never moves. The reference is a
PoE character standing still against a charging horde until overwhelmed;
survival time is the leaderboard score. **Three decision surfaces exist in
total:** the pre-run deck, in-run card picks, and gem socketing.

The consequence that matters:

> **The slime's job is not to create tactical decisions. It is to create
> pressure that tests the build. Each distinct slime behaviour is a
> question the build has to answer.**

One behaviour = one question = one viable build, which is exactly the game
the playtest found. The whole rework is "add questions." Any proposal
requiring the player to choose *where* to apply force is invalid — several
otherwise-good ideas died on this and are listed as rejected in the
session record.

Asymmetric threats still work: weapons auto-target the nearest frontier,
so concentrated pressure pulls the turret's fire toward it. The game aims;
the slime decides where.

**24. The field is the horde's economy, not the threat itself.** 📋
*2026-08-05.* Density accumulates, dense regions congeal into coagulants
that charge the core, and those are the acute threat. The field still
bleeds the core inside the perimeter, but slowly — it is the clock, not
the executioner.

**Field control sets spawn *distance*, not spawn rate.** An earlier
framing ("clear the field to starve the horde") is wrong and was corrected
in session: the wilderness reservoir is unreachable (#28) so it can never
be starved. Keep the near field clean and mass can only bank far away, so
threats spawn far and you get runway. Fall behind and mass banks close, so
threats land before you can chew through them. Better than "fewer spawns"
because it is visible, and because distance is the only resource a
stationary turret has.

**25. The field splits into two decoupled layers.** 📋
*2026-08-05.* `growth` (quantity — the horde's fuel, consumed by weapons
*and* by coagulant formation) and `maturity` (quality — terrain, consumed
by **nobody**).

This resolves a real contradiction: if coagulants eat dense regions, dense
regions never persist, so high density tiers would never appear. **The
horde eats mass but not maturity**, so stripped ground stays mature and
regrows tougher.

Visual consequence: density → thickness/opacity, maturity → colour and
texture. **5 density steps × 4 maturity steps = 20 states from two axes**,
none hand-authored. This — not more buckets — is the answer to "5 density
levels isn't enough." The channels must stay strictly separated or 20
states read worse than 5.

Cost: one extra `Float32Array` over a 150×86 grid, ~52 KB.

**26. Maturity comes from scarring, not age.** ✅ *(design)*
*2026-08-05.* The most-worked problem of the session; the first proposal
was wrong and the reasoning is worth preserving.

Weapons target `nearestFrontierPoint` — the *nearest* revealed cell — so
the engagement zone is pinned to the inner edge of the slime **regardless
of weapon range**. The outer ~70% of a 1920×1080 arena is therefore
*structurally unreachable* in any run, at any build, ever.

Age-based maturity therefore produces a permanent max-calcified border by
minute three, armoured coagulants as the default rather than the
exception, and zero escalation (it front-loads, then sits still). The
mechanic points the wrong way.

Inverted: **the battlefield hardens, the wilderness stays soft.** Maturity
accrues where the player actually clears, so a hardened ring grows exactly
where they fight — rarity metered by survival duration, always under their
guns, and thickening forever with no table.

A **slow age component is retained with a low ceiling** (~⅓ of maximum,
where scarring reaches full) so the wilderness is not visually static and
long runs toughen globally — but it can never approach a calcified wall,
by construction rather than by tuning.

Mature ground regrows **slower to a higher ceiling** — a *durability*
threat, not a *speed* threat. Making the kill zone grow faster would be
unfair, since it is the one place the player is forced to fight.

Emergent build tension, not designed in: **range gets you fresh mass,
penetration gets you through your own callus.**

**27. Four conservation rules govern the coagulant economy.** 📋
*2026-08-05.* Formation and death move mass around; without rules this is
either a runaway loop or perpetual motion.

1. **Formation is a sink** — a coagulant consumes the density it forms
   from.
2. **Killing is a sink** — damage dealt is mass permanently destroyed;
   death yields XP/gems plus only a small fixed splatter by size class.
3. **Arrival is the only real source** — reaching the core delivers full
   mass as damage *and* dumps it inside the perimeter, seeding a breach.
4. **Size is emergent** — determined by contiguous mature density
   available, not by a spawn table.

Rule 3 inverts an earlier proposal (splatter as a penalty for killing
close), which made success feel punishing. **Splatter is the consequence
of failing to kill, not of killing.**

Rule 4 answers "won't three behemoths appear after I kill a few motes?" —
no, because a behemoth needs a large neglected region and motes dying does
not create one. Coagulant size becomes an automatic readout of how badly
the player is losing.

Agreed tuning dials if this misbehaves in play: **arrival speed and
arrival mass.**

**28. The wilderness is a reservoir; events are the pumps.** 📋
*2026-08-05.* Standing mass never spontaneously coagulates — a vein or
bloom must initiate it.

Forced by arithmetic. The wilderness is ~76% of the arena
(2,073,600 px² total vs. a ~502,000 px² cleared disc) and saturates in
~46 seconds (`dens(t) = 1 - e^(-0.05t)`). Under Rule 4 alone that is
unlimited contiguous mass from minute one — behemoths on tap, forever,
from unreachable ground. Local depletion does not save it either: ~22
non-overlapping patches refilling in ~60–90s sustains roughly **one
behemoth every four seconds**.

Making events the trigger collapses pacing to **one lever** (event
frequency and reach), makes unreachable ground a non-problem, and turns
veins and blooms into load-bearing systems rather than flavour.

Threats from unreachable ground are *good* — thematically the premise, and
the only way to get a long dramatic charge — provided they are rare,
telegraphed, slow, and answerable by build. The player's field lever
against them is indirect but real: a clean near field means auto-targeting
is not chewing on chaff while a behemoth closes. **Field control buys
weapon attention.**

**29. Growth nodes are deleted and replaced by Infection Events — the vein
acts on density, the bloom acts on maturity.** 📋
*2026-08-05.* Nodes were correctly diagnosed as feeling bad for three
separate reasons: `state.nodes.find(n => !n.dead)` targets the *first node
in array order* (arbitrary); picking Missile or Caustic Cloud silently
reduced frontier DPS, making them a stealth tax; and a discrete HP-bar mob
is a genre mismatch in a game whose identity is a continuous field.

Replaced by one system with two variants and the organising principle:
**events are sparks, and the terrain decides what burns.**

- **Vein** — linear, edge→inward, injects fresh soft mass, punches through
  the scar ring and temporarily softens it. Short-runway threats. Reaching
  the ring is a two-part beat: fresh chaff *plus* it wakes Sclerotics from
  the player's own callus. Reuses the existing `veinField`
  reaction-diffusion pattern, currently pure wallpaper.
- **Bloom** — radial, local, rapidly ages ground, creating hardened spawn
  sites. **Does double duty by location:** deep + virgin → mass dominates
  → Behemoth; mid-field + older → maturity dominates → Sclerotic/Bulwark.

Veins also supply the thing the game has never had: **rhythm.** Pressure
currently is a flat line. Veins make it build from a direction, peak,
subside and move.

Note that the runway shrinks over a run *not* because the front moves in —
a stronger build pushes it outward — but because **spawn sources migrate
inward** (wilderness → scar ring → veins/blooms).

**30. Coagulant identity is derived from field state, not a spawn
table.** 📋
*2026-08-05.* Four readings at the spark point: contiguous mass → size;
maturity → armour/type; mass shape (solid vs. fragmented) → whether it
holds together; corridor density → whether it can feed en route.

No spawn weights to tune, and the player can always read *where something
came from* by looking at what it is.

Seven types in two waves. **Wave 1** (Mote, Congealer, Behemoth) is pure
density and needs no maturity — see #36. **Wave 2** (Blastoma, Carrier,
Sclerotic, Bulwark) is where maturity pays off.

Several types are **gated on player failure rather than elapsed time** — a
Carrier literally cannot form without a dense corridor, so a player on top
of the field never meets one. Difficulty reads as consequence, not as a
timer.

**Carrier and Bulwark should ship as a pair.** Carrier makes the Threat
Priority gem meaningful (something that worsens when ignored); Bulwark
makes it a genuine tradeoff (threat-first targeting sometimes feeds damage
into a wall). Without Bulwark the gem is a flat tax rather than a
decision.

One formation visual for all types — tell → drain → rise → detach →
crater — which makes Rule 1 visible and doubles as the entire telegraph
system with no UI.

**31. XP tracks destroyed mass, wherever that mass is.** 📋
*2026-08-05.* One unit of slime destroyed pays the same whether destroyed
loose in the field or packed inside a coagulant, plus a modest **risk
premium (~25–50%)** on horde kills.

The trap avoided: if horde kills paid meaningfully more per unit mass,
*neglecting the field becomes an XP strategy.* Under this model there is
no farming incentive — the same mass either way — but horde kills still
feel huge because a behemoth concentrates enormous mass in one place.

The intended pacing then comes free from existing mechanics: soft slime
scales `clearAt`'s radius up (fast early XP), hardened slime scales it
down against ~10× resistance (field XP dries up), so **the XP source
migrates onto the horde exactly when the horde becomes the main threat.**

Two existing distortions must go: the `clamp(…, 0, 10)` value cap, and
dropping one gem per `clearAt` call regardless of area — which currently
makes XP track *hit count* rather than damage (Blades at level 8 fires
~18 `clearAt` calls/sec and prints gems; Frost fires ~0.7/sec). The level
curve also goes superlinear; `12 + level * 6.5` is linear against a
super-linear clear rate.

**32. Passives are dissolved into gems, and the Core gets its own gem
slots.** 📋
*2026-08-05.* PoE-style: weapon slots (unlocked with currency), per-weapon
extension slots, universal support gems. Every passive becomes a gem —
Amplifier is a `+damage` support gem, Overclock is `+attack speed` — and
defensive passives (Vitality, Regen, Armor, Magnetism) socket into the
Core itself.

One unified system instead of two, one card category instead of two, the
Core becomes part of the build rather than a stat block, and an entire
axis of card-pool dilution disappears.

**Deliberately more extensions than slots**, so the choice is contested —
that is what makes the inventory screen earn its existence.

**The pre-run deck defines the card pool.** This is the main defence
against the real risk of a 20-weapon arsenal: naively pooled, level-ups
stop being choices and become lottery draws. It also makes
meta-progression a deckbuilding system rather than a grind gate.

**Targeting becomes a gem** (Threat Priority / Field Priority), which
permanently retires the "it takes away my weapons" problem — targeting
moves from hardcoded per-weapon behaviour to a build decision.

**33. `TIERS_LIST` is demoted to pure flavour.** 📋
*2026-08-05.* Difficulty becomes emergent from field state, maturity and
event frequency. Tiers survive as naming and presentation — announcements,
colour themes on a time curve — with **zero mechanical weight**. A real
change to how `tick.ts` works, made deliberately rather than by drift.

**34. The endgame is a terminal phase, not an unkillable boss.** 📋
*2026-08-05.* An unkillable boss is a timer wearing a costume and it
flattens the leaderboard — everyone dies at roughly the same minute
regardless of build. Instead, at some deep time a permanent escalating
condition begins (arena calcifying inward, perimeter contracting, veins
ceasing to expire). Death is guaranteed, but *how long you last inside it*
still differentiates builds.

Built from levers the design already has. Specifics deferred to Phase 8;
the levers must exist by then rather than being bolted on.

**35. Meta-currency scales with survival time, superlinearly.** 📋
*2026-08-05.* Spends on weapon unlocks, turret weapon slots, and gem
types. Early runs earn little, so the interesting material gates behind
progressively deeper runs.

Rejected: currency from *slime killed* — rich-get-richer (it rewards the
DPS a strong build already has), and unbounded under a plateau, making
farming a safe tier optimal over pushing.

**Dependency worth naming:** this only works if there is no plateau (#34).
The currency design and the difficulty design are the same problem solved
once.

**36. `safeRadius` is renamed, and maturity ships *after* Wave 1
coagulants.** 📋
*2026-08-05.* Two sequencing calls.

`safeRadius` is a misnomer — it is a breach threshold, not a sanctuary,
and the name has been quietly steering the design language. Renamed to
`perimeter` during the teardown.

Maturity was originally planned as the *first* step of the rework. Working
through coagulant formation showed **Wave 1 needs no maturity at all** —
Mote, Congealer and Behemoth are pure density readings. Putting maturity
first would block the single most important playtest behind the largest
visual system. So: identity change on screen early, conservation rules
tuned against something playable, terrain layered on afterwards.

**37. Long-form session records live in `docs/sessions/`.** 📋
*2026-08-05.* `PROGRESS.md` becomes a heartbeat file — what changed, what
was decided, what is planned, which commit — pointing into dated session
files that hold the full reasoning. Design discussions produce far more
context than a status document should carry, and cramming it in makes
`PROGRESS.md` unreadable on a cold start, which defeats its whole purpose
as the two-machine handoff mechanism.

---

## The mechanism — arsenal structure and how coagulants work

> Decisions 38–46 came out of the design session on 2026-08-06. Where
> 23–37 settled *what the game is*, these settle *how it works* — the
> layer below. Full reasoning, including every rejected alternative, is in
> **`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`**.
>
> These close every open question the previous session left. **Phase 3A is
> unblocked.**
>
> **47–53 are later additions**, not from that design session — findings
> and calls made during the Phase 3A, 3B, and 3C implementations
> themselves. Kept in this section because they're still "how it works,"
> not "what it is." No session record covers them individually; the
> reasoning lives here and in `docs/PROGRESS.md`'s session log.

**38. The perimeter is a fixed radius. 📋**
*2026-08-06.* It shrank 100 → 45 via `TIERS_LIST`, which #33 strips of
mechanical weight. Fixed for now; revisit in Phase 8.

Its job in the new model is much smaller — it is the line where breach
splatter starts bleeding the core, not the primary difficulty lever. An
independent time curve was rejected for re-adding a scripted difficulty
lever the rework exists to make emergent. Breach-driven (shrinking as hits
land) fits the consequence philosophy best and remains the interesting
option, but it is an untested feedback loop with spiral risk, and tuning it
*before* the horde exists means tuning against a threat model that is not
there yet.

**39. Meta-currency buys unlocks only, never permanent stats.** 📋
*2026-08-06.* Confirms what was recommended-but-unconfirmed in the previous
session. Spends on weapon unlocks, turret weapon slots, and gem bundles.

Permanent stat upgrades would compound the 17–21× in-run scaling problem
this entire rework exists to fix, on top of a curve that is already the
diagnosed disease.

**40. Weapon levels leave the card pool and become enhancement points.** 📋
*2026-08-06.* Cards offer **only** weapon-specific extensions and support
gems. Every card is therefore a build decision rather than a treadmill
step — the PoE shape, where a gem's level is power but the support links
are the game.

**This also kills a shipped bug at the root.** The playtest's "cards appear
to do nothing" finding was caused by static and plateauing *level* card
descriptions (`bladeCount(7) === bladeCount(8)`). Remove level cards and
that failure mode has nowhere to live.

The hole it opens — no guaranteed payout when the pool offers nothing you
want — is filled by **enhancement points**, proposed by the project owner:
one point per level-up, spent via +/- next to each weapon in the inventory
screen. Agreed refinements:

- **One point every level**, not every other. Tune per-point *magnitude*
  instead; magnitude is a smooth dial and rate is a lumpy one, and every
  level-up giving *something* is the entire reason the mechanic exists.
- **A point buys one scalar** — `clearAt`'s existing `power` argument — not
  a stat bundle. Keeps the meaning legible and stops enhancement competing
  with gems, which own speed/multishot/pierce.
- **Freely reassignable.** The +/- is the best part: mid-run respec, which
  this game specifically wants because the threat model shifts across a run
  (wilderness behemoths early → armoured close-range late). It also gives
  the inventory screen a reason to be opened more than once.

**Known risk, accepted knowingly:** with free reassignment and no
diminishing returns, the optimal play is "dump everything into the weapon
with the most gems socketed" — a slider, not a decision. Shipped anyway,
because enhancement's job is the **pacing floor**, not the build. Flagged
for the playtest gate; if it collapses, the fix is diminishing returns per
weapon, not a hard cap.

**41. Support gems unlock in themed bundles and are then universally
live.** 📋
*2026-08-06.* Unlocking gems one at a time was rejected by the owner as a
drag. Currency buys **thematic** bundles — "Ballistics Package: Multishot,
Pierce, Velocity" — which read as unlocking a *playstyle* rather than three
nouns, and teach the game by suggesting a build from the name alone.

**Once unlocked, a gem is live in every run, no deck slot required.**
Claude proposed making bundles the unit of *decking* too (bounding the card
pool permanently); the owner rejected it, correctly — locking gems behind
deck slots makes combinations you did not foresee at deck time unreachable,
and emergent mid-run builds are the more interesting game.

**Consequence recorded rather than solved:** the gem half of the card pool
grows with every gem the project ships and is not deck-bounded. Fine at 15
gems, a problem at 60. If it bites, the fix is a filter on the *pool* (only
offer gems that fit a weapon being run), not on unlocks. In BACKLOG,
alongside the owner's "orbital trade ship" idea for buying specific gems
with score points.

**42. One mass, two containers — coagulants are entities with no HP.** 📋
*2026-08-06.* The load-bearing mechanical decision of the session.

> **Mass is the only currency in the game. It lives in two containers: the
> grid, and entities.**

A coagulant holds `mass`, which *is* simultaneously its hit points, its
arrival damage, and its XP value. Radius is `r = k·√mass`, so area is
proportional to mass — **a behemoth is big because it is big.** A separate
HP number was rejected as redundant: it would need manual syncing with
three things mass already expresses, and it would break conservation.

**Why it works: a coagulant is dense slime that walks.** `clearAt` already
contains `resistance = clamp(1.3 - dens, 0.12, 1.3)` and a
density-shrunken hit radius. If a coagulant's local density is high by
definition, the *existing* formula makes it tanky with no new mechanic —
and tanky for two compounding reasons that are both already in the
codebase: it is dense (resistance per hit) and it is massive (total mass to
chew).

**The refactor:** split `clearAt` into a damage half and a reward half. The
damage half gains a second loop over coagulants overlapping the hit disc,
applying the *same* falloff and resistance maths, subtracting from `mass`
instead of `growth[i]`. Both loops feed one `totalRemoved`.

What that buys, all automatically:

- **#31 satisfied by construction** — XP tracks destroyed mass wherever it
  is, because it is the same accumulator. The risk premium is one
  multiplier on the coagulant portion.
- **Rule 2 is automatic** — damage dealt is mass destroyed; there is
  nowhere else for it to go.
- **Rule 1** is the flood-fill draining grid cells into `mass`; **Rule 3**
  is dumping `mass` back into grid cells on arrival.
- **Mass is conserved game-wide as one number**, which is a testable
  invariant — exactly the invariant-over-mechanism guard #20 argued for.
- **Every weapon works on them unmodified**, including ones not yet
  designed, because everything routes through `clearAt`.

**Hard constraint: coagulants must never be composited into the world
grid.** They stay entities. In the grid they would scar terrain as they
walk (Phase 4A) and nothing could distinguish coagulant from ground.

Movement is a straight line to the core at a per-entity `speed`, with a
hook left in place for the Wave 2 Carrier to feed off the field it crosses
— cheap to leave, annoying to retrofit.

**43. Formation uses a bounded flood-fill, plus a coarse index for site
selection.** 📋
*2026-08-06.* This was the project's one named technical unknown. Grounded
against the real numbers, **the risk was overstated**: the grid is
150 × 86 = 12,900 cells at 13px, formation happens on discrete event
*moments* rather than every tick, and even a whole-grid flood is a few
hundred microseconds. The frame budget was never the problem.

**The real problem is a design problem wearing an algorithm costume:** an
unbounded flood across saturated wilderness returns *the entire wilderness*
as one contiguous region — #28's arithmetic in code form.

Two structures, two jobs:

**(a) A coarse density index**, for *choosing* sites. A separate read-only
side array summing revealed density per 4×4 block: ~836 entries, refreshed
each tick at ~6% of a grid pass. Answers "where is mass banked" in one
lookup. Bloom placement, behemoth site selection and spontaneous sparking
all need exactly that.

> **The simulation grid does not change.** It stays 150 × 86 at 13px, fully
> simulated and rendered — the density is what makes the slime read as
> *liquid* rather than pixels. The index is a table of contents beside the
> map; it is never rendered and never simulated from.

**(b) A bounded flood-fill**, for *executing* formation. From the spark
point, flood through **revealed** cells only (`growth > threshold` —
prototype bug #3 discipline, never raw density), capped at ~180px (≈14
cells, ~600 cells worst case) and a cell count. Sum `growth` over what it
reached; that is the available mass.

**The radius cap is the entire design.** "Contiguous mass" becomes "mass
inside a formation footprint," and size emerges from how *full* that
footprint is — saturated wilderness → behemoth, half-cleared near field →
mote. Rule 4 with no spawn table, and behemoth size capped by construction
rather than by tuning.

**The flood-fill result is also the crater shape**, so the hollow follows
the vein pattern organically with no geometry to author.

Rejected: a summed-area table. O(1) arbitrary-region queries, but it only
pays off at thousands of queries per second against the handful actually
needed, and the invalidation complexity is real on a field that changes
every tick.

**44. Armor is flat reduction on `power`, with a floor.** 📋
*2026-08-06.*

```
effectivePower = max(power - armor, power * 0.15)
```

Percentage reduction (`* (1 - armor)`) was rejected: it scales every build
down equally — a bigger health bar, not a question — and trends toward
immunity, which is exactly the "a crust that neutralises your main weapon
feels awful" risk flagged as open question #4.

Flat reduction says something specific: **armor makes many small hits
worthless and leaves big hits nearly intact.** That makes the roster's
existing counter language mechanical rather than flavour — Behemoth
answered by burst and single-target, Sclerotic by penetration.

Three things fall out free:

- **A Penetration support gem becomes obvious and load-bearing** — it
  subtracts from armor, useless against soft targets and essential against
  hard ones. Genuinely situational, which is rare.
- **It is a natural corrective to the Blades problem.** Blades at level 8
  fires ~18 `clearAt` calls/sec and is simultaneously top DPS and a gem
  printer; flat reduction stops many-small-hits being universally correct
  without nerfing a number.
- **The 15% floor guarantees nothing is ever immune** — a bad matchup,
  never a brick wall.

The field ships in Wave 1 at **~0** (Mote, Congealer and Behemoth are all
low-maturity by definition) and starts mattering in 4C. Building the term
now with a zero value costs nothing and spares Wave 2 a damage-path
refactor.

**45. Default targeting stays nearest-thing-wins.** 📋
*2026-08-06.* Coagulants do not get special targeting treatment.
`nearestFrontierPoint` gains a pass comparing coagulant *surfaces*
(`dist − radius`) against the 48-sector frontier raycast and returns
whichever is nearer. Threat Priority remains a Phase 5 gem that *changes*
the default rather than introducing targeting as a concept.

Coagulants become simply another close thing — which is what #28 predicted:
a dirty near field means the guns chew motes while a behemoth walks in, and
that pressure emerges with no special-casing anywhere.

**46. Coagulants render into the slime layer, in the slime palette.** 📋
*2026-08-06.* Not as a separate sprite layer on top.

**The identity risk is real:** the instant mass detaches from the field it
can stop reading as slime and start reading as a monster, and the game's
whole look depends on it not doing that. A coagulant's density maps to a
bucket colour exactly as a grid cell does, so a behemoth renders as the
brightest, densest slime in the game — which is *true*. It reads as the
field getting up and walking.

**Blob shape:** 5–9 seed circles of varying radius scattered in the body,
filled flat in one colour. Overlapping flat circles merge into a lumpy
organic silhouette automatically — no metaballs, no blur, no per-pixel
work. Slow orbital drift plus a `sin(t·f + phase)` radius wobble makes it
breathe; one inset lighter fill supplies the wet highlight.

**Seeds are generated at formation and stored on the entity — never lazily
inside a draw call.** That is the exact bug class that bit the prototype
three times (#4 and #7); `bubbleSeeds` was this precise mistake.

Wave 2 comes nearly free: Blastoma is the same renderer with more seeds and
less overlap (visibly a bag of blobs, which is what it must communicate);
Sclerotic is the same shapes in the mature palette with flatter, plated
edges.

This is the shipping approach for 3C, not final art — polish belongs to
Phase 9.

**47. Ambient escalation and contact damage are decoupled from
`TIERS_LIST` during 3A, not just the perimeter.** 📋 ✅
*2026-08-06, during Phase 3A implementation.* Reviewing the teardown found
`TIERS_LIST` carried four mechanical values, not the one (`safeRadius`)
Decision 38 addressed — `nodeInterval` (dies with nodes), `infectionMult`
(1.0→3.1 across a run), and `contactMult` (1.0→2.1) both needed a home now
that the tier table itself is presentation-only (#33).

**`infectionMult` becomes its own time-driven curve**
(`ambientInfectionMult()` in `tuning/growth.ts`), same breakpoints and
values as before, decoupled from tier lookup. This is axis 3 of the five
organic escalation axes named in the 2026-08-05 record §15 ("ambient
rate — the existing lever") — the rework retires the *tier table* as
difficulty mechanism, not ambient escalation itself. Stripping it with
nothing to replace it would have left the game with zero escalation for
the three phases (3B/3C/4A) before events, coagulants, and maturity exist
to take over.

**`contactMult` is retired outright, folded into the existing
`CONTACT_SCALE` constant** rather than kept as a second multiplier frozen
at 1. Decision 24 already establishes contact damage as "the clock, not
the executioner" — it isn't meant to escalate on a timer any more, its
pressure rises through Rule 3 (arrival splatter seeding breaches) via the
*existing* depth-weighted formula. Two constants permanently multiplying
into one number is redundant; `CONTACT_SCALE` alone is the knob.
`contact.test.ts` gained a regression guard asserting tierIndex no longer
affects damage, replacing the old test that asserted the opposite.

`applyAmbientGrowth()` now takes `infectionMult: number` directly instead
of a `Tier` object — growth math no longer depends on the tier table at
all, which is the cleaner shape now that tiers are pure flavour.

**48. Bloom ships in Phase 3B, alongside vein, despite its real payload
waiting for Phase 4C.** 📋 ✅
*2026-08-06, during the 3B review — the project owner's call: "build it
now."* (Corrected 2026-08-07 — this originally said 4A; scoping Phase 4A
made clear the payload belongs in 4C, since 4A already changes clear
resistance globally and stacking bloom-hardening on top would make that
gate unreadable. See Decision 63.) Bloom's design job (§11) is
accelerating maturity, which doesn't
exist until 4A; in 3B alone it is elevated growth in a radius and little
else, nearly invisible against the field.

Considered and rejected: deferring bloom to 3C so it arrives alongside
formation logic that gives it a purpose (would shrink 3B but load more
onto 3C, already the phase carrying the project's one real technical
unknown); inventing a temporary 3B-only job for it, e.g. locally raising
the density cap past 1.0 (rejected as guessing at a mechanic maturity is
supposed to own).

Building it now keeps the event framework uniform — one lifecycle, two
variants, exactly as designed — rather than bolting a second variant onto
3C later. Its lifecycle, placement, and visual are real work that has to
happen regardless of when the payload lands.

**49. Vein geometry is a generated branching polyline, not a reuse of
`veinField`.** 📋 ✅
*2026-08-06, during the 3B review.* The 2026-08-05 record's one-line plan
— "reuses the existing `veinField` reaction-diffusion pattern" — turned
out to describe something that couldn't actually deliver a vein: the
field is a static *texture* consumed only as a threshold map, with no
traceable edge-to-core routes baked into it. The project owner's own
read, on review: probably a remnant of an idea that sounded economical in
the moment but never got developed.

Built instead as a jagged branching polyline via recursive midpoint
displacement — the standard lightning-bolt construction, generated once
at telegraph time and stored on the event (`systems/veinPath.ts`), never
regenerated per frame (the bubbleSeeds/novaFx bug class, #4/#7). The same
geometry drives both the rendered stroke and the growth-injection sample
points, so what's drawn is exactly what's growing — direct service of the
playtest lesson that a mechanic without its visual reads as broken.

**Branching was a deliberate choice beyond "looks more like lightning."**
Wave 2's Blastoma coagulant (§10) is specified to form where a vein has
"webbed" through an area, leaving a lattice rather than a solid sheet — a
branching vein produces exactly that shape as a side effect, with no
extra system needed in 4C.

Genuine pathfinding through the coral maze (`grid.vein`) was considered
and is preserved as an idea, not rejected outright — the owner's instinct
that "the infection follows its own veins" is thematically appealing. Not
built now because the coral pattern offers no guarantee a route exists at
every possible spawn angle, whereas the polyline construction can never
fail to reach the core. See BACKLOG for the compromise considered (biasing
displacement toward the coral pattern rather than true pathfinding).

**50. Coagulant damage scales by hit/body overlap area, not a flat
per-hit constant.** 📋 ✅
*2026-08-06, during the 3C planning pass.* The original Decision 42 sketch
implied one damage number could stand in for "how much grid an equivalent
hit would have covered." The project owner pushed back: a missile splash
and a Chain Bolt's first hit shouldn't land the same on a blob, and that
information already exists per-weapon as each weapon's own `radiusPx`.

```
overlapArea = circleOverlapArea(hitDisc, blobDisc)   // util/math.ts
cellsEquivalent = overlapArea / cellSize²
effectivePower = max(power - armor, power * COAGULANT_ARMOR_FLOOR)
removed = effectivePower * DAMAGE_COEFF * cellsEquivalent
        * COAGULANT_RESISTANCE * coagulantMult * COAGULANT_DAMAGE_SCALE
```

`DAMAGE_COEFF` and `COAGULANT_RESISTANCE` are the same constants the grid
loop uses (`COAGULANT_RESISTANCE` = `clamp(1.3 - 1, 0.12, 1.3)`, since a
coagulant's local density is always 1 — it *is* the densest slime in the
game, per #46). This self-limits in both directions without a table: a
small mote inside a huge Frost Nova only takes mote-sized damage (overlap
caps at the mote's own area), while a Bolt clipping a huge Behemoth only
does Bolt-sized damage — and a wide-splash weapon genuinely excels against
big targets, which a flat constant could never express.

Two dials, not one: `COAGULANT_DAMAGE_SCALE` (`tuning/coagulants.ts`) is
the master knob — the project owner's requested hook for a future support
gem. `WeaponDef.coagulantMult` (`tuning/weapons.ts`), defaulting to 1 on
every weapon, is the per-weapon hook — the requested "base stat you could
later level with enhancement points." Every weapon's `clearAt` call site
was updated to actually read its own `coagulantMult` rather than relying
on the default, specifically so a future edit to that field isn't silently
ignored by weapons that never look at it.

**51. Arrival deposit grows outward until all mass is placed, rather than
clipping to a fixed disc.** 📋 ✅
*2026-08-06.* Grid cells cap at `growth = 1`, and the perimeter disc holds
only ~150 cells — nowhere near enough for a large arrival (or even a
max-size splatter) to fit without evaporating some of it. The project
owner's proposed fix, converging independently with the mechanism the
session had been reaching for: `depositMass()` fills outward ring by ring
from the arrival point until the full amount is placed.

This makes total mass (grid + entities) **exactly** conserved on arrival —
not merely "never destroyed" as an earlier draft of this decision assumed
— and it's a better outcome dramatically too: a behemoth's ~600 mass
needs real area to land in, so arrival reads as a large, arena-visible
mess rather than politely fitting inside the ring. Verified directly:
`systems/coagulants.test.ts`'s formation → transit → arrival cycle test
asserts the grid's total mass returns to within floating-point tolerance
of where it started.

**52. The formation flood-fill's radius cap is a true circle, not a
Chebyshev box.** ✅
*2026-08-06, found live during the 3C browser verification pass, not by a
unit test.* The first implementation bounded the flood-fill with
`max(|dx|, |dy|) > radiusCells` — cheap, and the mass-sum tests all
passed, because a test asserting a mass *number* can't see the *shape* of
what produced it. In the browser, a coagulant that formed against an
already-saturated field left a crisp square crater — the box bound had
become the binding constraint on every side at once, which a unit test
checking only the summed mass could never have caught.

Fixed to real Euclidean distance (`dx² + dy² > radiusCap²`, compared once
per visited cell — negligible added cost on a ≤700-cell bounded search).
Restores what #43 actually promised: a crater "shaped exactly like the
flood-fill's reach... following whatever pattern the field was already
in," not a shape imposed by the bounding check's own geometry. **Recorded
as a reminder that shape/visual bugs need eyes on the running game, not
just an assertion on a derived number** — the same lesson #11 drew from
the playtest, applied to a bug the test suite structurally could not
catch.

**53. Vein rendering strokes the trunk as one continuous path, and tapers
each branch to a genuine point.** ✅
*2026-08-06, folded into the 3C commit at the project owner's request
after flagging the visual in the 3B follow-up ("veins are very round at
the points... should all end in small points like lightning").* 3B's
`drawVein` stroked every segment as its own `moveTo`/`lineTo` subpath, so
`lineCap: 'round'` put a rounded cap at *every* joint — with 32 trunk
segments that reads as a string of beads, not a single bolt.

The trunk is contiguous end-to-end by construction (proven in
`veinPath.test.ts`), so it now strokes as a single path — one `moveTo`,
then `lineTo` through every segment's endpoint — with `lineCap: 'butt'`
and `lineJoin: 'round'` for smooth interior joints and no caps at all.
Branches are also individually contiguous but stroked as separate
per-segment subpaths on purpose, so `lineWidth` can taper toward zero
across the branch — a single `stroke()` call only has one width, so
tapering requires the per-segment form the trunk deliberately avoids.
`'butt'` caps on a narrowing line read as a genuine point.

---

## The 3C playtest gate — first-round fixes

> Decisions 54–60 came out of the project owner's first live playtest of
> Phase 3C (2026-08-06) and a follow-up round the next day, kept dated
> 2026-08-06 per the owner's request since it's a direct continuation of
> that gate rather than new scope. Four bugs were reported from one
> sitting — slime speed, a vein reaching the core, instant coagulant
> formation, and a 5–10fps stretch during vein/coagulation activity — plus
> a direct question about whether the browser was the wrong platform. No
> long-form session file for this one; the reasoning is dense but each
> item is small, so it lives here and in `docs/PROGRESS.md`'s session log
> rather than a dedicated `docs/sessions/` file.

**54. Coagulant formation gets a visible 'forming' phase — rising and
fading in over `FORMATION_RISE_DURATION` (1.8s) — before it can move, be
targeted, or arrive.** ✅
*2026-08-06.* The playtest's sharpest bug: "a behemoth spawned and
insta-exploded on me." Formation was instant — a full-mass, full-speed,
already-lethal coagulant could appear with zero warning, which no amount
of retuning speed or distance alone would fix, since the player never got
a frame to react in the first place.

New `CoagulantPhase = 'forming' | 'active'` (`state.ts`), mirroring
`InfectionEvent`'s existing `phase`/`phaseTimer` shape. While `'forming'`
a coagulant does not move (`updateCoagulants`), cannot be hit
(`findCoagulantHit` skips it), and is invisible to targeting
(`nearestFrontierPoint` skips it too) — it reads as still part of the
field, not yet a detached threat, which is also the visual
(`render/coagulants.ts` scales it from 0 to full radius and fades alpha in
across the rise). It only becomes `'active'` — mobile, targetable,
damageable — once the timer expires.

**55. A hard distance gate blocks formation within `perimeter +
FORMATION_MIN_DISTANCE` (30px) of the core, however much mass is
available.** ✅
*2026-08-06.* A backstop, not the primary mechanism — that's #56 for veins,
and blooms already place no closer than `perimeter + 70` by construction.
Found live: a coagulant sparking with almost no runway to the core is a
distinct failure from the mass being too large, and deserves its own guard
rather than trusting every upstream placement to never produce a close
point. `attemptFormation` (`systems/formation.ts`) checks this before the
flood-fill runs, so a rejected spark drains nothing.

**56. Veins stop short of the perimeter — at `perimeter +
VEIN_STOP_MARGIN` (60px) — instead of aiming at the tower.** ✅
*2026-08-06.* The other half of the insta-death bug: a vein aimed
straight at the tower flooded mass right at the defended ring, so a
coagulant sparked from that mass could form inside or barely outside the
ring with almost no distance to cross before arrival. `veinTargetPoint()`
(`systems/events.ts`) computes a target short of the core along the same
bearing; `generateVeinPath`'s midpoint displacement never moves the two
endpoints, so the trunk's tip lands exactly at the stop distance
regardless of how jagged the path is.

**57. Coagulant speed and ambient growth were both cut roughly in half a
second time, in the same playtest round, on top of the cut already made
at the 3C gate — with the escalation curve left untouched both times.** ✅
*2026-08-06.* The first cut (3C gate, discrete per-kind speeds — mote 70 /
congealer 45 / behemoth 25 — replaced by the continuous
`coagulantSpeed(mass) = clamp(K/√mass, MIN, MAX)`, and `AMBIENT_BASE`/
`CREEP_RAMP` trimmed ~40%) wasn't enough on its own: a second playtest,
run only with the starting weapon since no arsenal exists yet to balance
against, still read as overwhelming early. Both cut again by half —
`COAGULANT_SPEED_K/MIN/MAX`: 120/8/45 → 60/4/22.5; `AMBIENT_BASE`: 0.03 →
0.015; `CREEP_RAMP`: 0.054 → 0.027.

**`AMBIENT_ESCALATION`'s time-driven multiplier curve was not touched by
either cut.** The owner's request was specifically "half the speed at the
start... keep the curve the same" — since the escalation table is a
multiplier applied on top of the base rate, scaling the base uniformly
halves every point along the curve including its start, without changing
the curve's relative shape. Same logic applied to the coagulant speed
constants: `K`/`MIN`/`MAX` scaled together preserves the inverse-sqrt
*shape* ("big mass, slow movement"), only the absolute speeds it produces
move.

**This is a playability floor, not a balance pass.** The owner named the
real blocker directly: pacing can't be honestly tuned against an arsenal
that doesn't exist yet — the balance pass stays Phase 8, gated on Phase
5/6 first, per Decision 13's supersession. Live-verified afterward
(2026-08-07): a fresh run reached level 7 / t=1:29 with core integrity
still full, a coagulant already killed, and two more coagulants active on
screen without threatening the core — a different outcome from the first
playtest's early death, on the same starting loadout.

**58. `depositMass` walks ring *perimeters*, not ring bounding boxes.** ✅
*2026-08-06, found via the targeted stress test in #59.* The original
walked a full `(2·ring+1)²` box per ring and re-deposited into
already-full cells near the center every time, which is O(ring³) worst
case across a fully-saturated field. Rewritten to walk only the O(ring)
cells actually on each ring's edge. Confirmed by direct iteration counts
in the pathological fully-saturated-map case: ~1.9M → ~30K. Genuine
algorithmic fix, not proven to be the cause of the reported lag — see #59.

**59. Suspected lag was investigated with a deterministic debug harness,
not by chasing it through noisy normal play.** ✅ *(investigation, no
mechanic changed)*
*2026-08-06, methodology proposed by the project owner.* Early attempts to
reproduce the reported 5–10fps stretches through ordinary play kept
getting interrupted by level-up cards pausing the simulation before
anything conclusive built up. The owner's redirect: *"write a specific
test, remove level ups, give core all the weapons at max level... measure
the performance of the whole coagulant and vein issue."* A temporary
`window.__debug` bridge (`grantMaxWeapons`, `saturateArena`,
`forceFormation`, all in `main.ts`, all removed afterward — nothing
shipped) made the worst case reproducible on demand instead of anecdotal.

**Findings:** no individual system exceeded ~8ms even in an artificial
8,150-dirty-cell stress tick (`performance.now()` wrapping with
max-tracking, since an aggregate total hides which system caused a
specific spike). A **corrected** canvas benchmark — matching
`flushDirtyCells`'s real *scattered* dirty-cell pattern rather than an
earlier synthetic benchmark's full-canvas-clear assumption — showed the
current per-cell repaint is faster than a "batch fills by colour"
alternative at every realistic size (18× faster at 12,900 cells). **That
fix idea is retracted**, and the retraction is written directly into
`flushDirtyCells`'s own comment so it isn't re-attempted from the same
false start. The browser's own Long Task API (`PerformanceObserver`,
`entryTypes: ['longtask']`) recorded **zero** long tasks during a 100+ms
frame gap deliberately provoked during the stress test — the most
authoritative signal available, since it catches deferred layout/paint
work a manual JS wrapper can't see. Conclusion communicated honestly as an
open uncertainty, not a closed case: the spikes are **likely** an
automation/remote-browser artifact rather than reproducible game-code
cost, but not proven absent.

**Real, if unproven-to-be-causal, fix made anyway:** `ui/hud.ts`'s
`updateWeaponTray` was rebuilding every weapon chip via `innerHTML = ''` +
`appendChild` on *every* frame regardless of whether the loadout changed.
Gated on a loadout snapshot string; only rebuilds on an actual change. A
real anti-pattern worth fixing on its own merits even though the Long Task
profiler cleared it as the spike's cause.

**60. The game stays a browser/Canvas 2D game — no port to a standalone
engine.** 📋
*2026-08-06.* Raised directly by the owner after the lag report, worried
the platform itself might be the ceiling: *"can it be a browser game? Are
we limiting ourselves too much?"* Assessed and rejected porting: the
investigation in #59 found no evidence Canvas 2D itself was the
bottleneck — every measured system cost was small, and the one genuine
perf fix found (#58) was an algorithmic one that ports identically to any
target. Procedural generation (the density field, vein polylines, seed-
circle coagulant blobs) is plain code with no baked art pipeline behind
it, so it is not a reason to leave the browser either — it would need
re-authoring in a new renderer's terms regardless of engine, at the same
cost. Staying on web keeps the GitHub Pages deployment plan (`CLAUDE.md`)
intact with no migration cost paid for a problem that, on the evidence
gathered, the platform did not actually cause.

---

## Phase 3D — the XP economy

> Decisions 61–62 came out of the 2026-08-07 session, which implemented
> Phase 3D and closed Phase 3. Full reasoning, including the premise
> correction that reshaped 61's second half, is in
> **`docs/sessions/2026-08-07-xp-economy.md`**.

**61. The XP economy's pacing lever is what a level *costs*, never what a
kill *grants*.** ✅
*2026-08-07.* Decision 31 said the level curve goes superlinear and left
the shape open. The project owner supplied the governing principle:
*"balance the levels not by how much XP is given, but by how much XP is
needed to level up."*

**This is load-bearing, not stylistic.** Granted XP must stay honest to
destroyed mass or Decision 31's anti-farming guarantee collapses — the
moment grant value becomes a tunable pacing dial, "which mass is worth
more" becomes a strategy, and deliberately letting the field mature to
farm behemoths becomes optimal play. Putting the entire pacing lever on
*cost* leaves the grant side physically honest. Four parts:

**(a) `xpToNext` is quadratic**, `12 + 6.5·L + 0.45·L²`. Identical to the
old linear curve at level 1 by construction, so §12's intended early rush
(soft slime → wide `clearAt` radius → fast early XP) is untouched; it bends
from there — ~1.6× the old cost by level 10, ~2.3× by level 20. Geometric
(`base · rᴸ`) was the alternative, rejected for hard-coupling the whole
curve to one growth constant where quadratic gives one legible coefficient.

**(b) The risk premium is 15%**, applied to **only the coagulant share** of
a `clearAt` call's removed mass. Decision 31 floated 25–50%; the owner went
lower, correctly — the farming failure mode gets worse the higher this
goes, and the honest-grant rule above removes every alternative defence
against it. `clearAt` now tracks `coagulantRemoved` alongside
`totalRemoved`, exactly as Decision 42 anticipated (*"one multiplier on the
coagulant portion"*); `totalRemoved` stays the honest physical figure its
return value and the gem-drop threshold use.

**(c) Gem showers are a rate limiter, not juice.** The problem the owner
named — *"one behemoth kill can cause 3 level ups"* — cannot be fixed by
the curve alone: at low level a threshold is ~19–30 XP while a behemoth
pays hundreds, and no plausible curve closes that. The fix was already in
§12 unrecognised: **gems are the XP delivery mechanism, and delivery takes
time.** A behemoth dying 600px out showers gems that drift in over several
seconds, so XP arrives as a stream and the level-ups spread themselves
rather than stacking into one modal queue. `dropGemShower` splits large
values into up to `GEM_SHOWER_MAX_COUNT` gems.

**Per-gem drift jitter (`Gem.driftJitter`) is required, not decorative** —
without it a behemoth killed *at the perimeter* has no drift distance and
its whole shower lands simultaneously, reintroducing the clump in the exact
case where it matters most. Each shower gem samples its own 0.7–1.3× speed
multiplier; ordinary single drops default to 1 and are unaffected.

**(d) No fast first level.** `freshState()`'s hardcoded `xpToNext: 10` —
prototype parity that bypassed the formula for level 1 only — is removed;
level 1 comes from the curve like every other level.

**Deliberately not done:** removing the modal pause on level-up. That is
the real fix if showers prove insufficient, but it belongs with Phase 5's
card-pool restructure rather than being pre-empted here.

**62. Behemoth formation stays ungated — the "behemoths too early"
question is deferred until the full system set exists.** 📋
*2026-08-07.* The owner reported that an early-run behemoth is
unstoppable, and it's a real observation: a vein injects mass far faster
than ambient growth, so it can manufacture a dense enough patch to spark
one early.

**Raised as a conflict rather than implemented**, per the ground-truth
override protocol (#22). A level- or time-gate on behemoth formation
contradicts **Rule 4** (#27): size is emergent from available mass, never
scripted, which is precisely what makes coagulant size *an automatic
readout of how badly the player is losing*. A spawn gate is the scripted
difficulty lever the whole rework exists to delete.

Non-scripted levers reaching the same outcome already exist —
`MASS_BEHEMOTH`, `FORMATION_RADIUS_CAP`, and per #28 the intended one,
event frequency and reach. It is also possible the previous session's speed
halving already largely addressed it.

**Owner's call: defer entirely** until the remaining systems (maturity,
arsenal) exist, since the answer likely changes once the player has real
counterplay. Recorded so a future session re-derives neither the problem
nor the objection. See BACKLOG.

---

## Phase 4A — the maturity field

> Decisions 63–65 came out of the 2026-08-07 session that planned and built
> Phase 4A. The plan, its scope conversation, and a full as-built delta are
> in **`docs/plans/phase-4a-maturity.md`**; the design they implement is
> §6/§7 of the 2026-08-05 record plus Decisions 25 and 26.

**63. Maturity ships as a second grid layer — accrued by clearing, decayed
toward a capped global age floor, never consumed.** ✅
*2026-08-07.* Decision 25's split made real: `growth` is quantity (the
horde's fuel, eaten by weapons and formation), `maturity` is quality
(terrain, consumed by nobody). Three mechanical effects, all reading the
cell's maturity: clear yield drops (floored, so nothing is ever
unclearable — Decision 44's guarantee restated for terrain), ambient
regrowth slows, and the ambient growth ceiling rises.

**The age floor is the one piece of design the record didn't specify.**
§7 wants both a slow global age drift *and* passive decay of scarring, and
those fight if age is a per-cell gain — every cell settles wherever the two
rates happen to cross. Resolved by making age a **floor** rather than a
gain: `maturity = max(ageFloor(t), maturity - decay·dt)`. Scarring pushes a
cell above the floor, decay returns it to the floor rather than to zero.
Needs no per-cell age state and costs one scalar per tick.

**Scope, agreed with the project owner before building:** 4A ships a
deliberately crude placeholder visual rather than shipping blind (a field
state with no visual is the mistake `frozen` still represents); events
inject full-thickness slime regardless of maturity; bloom's maturity
payload stays in 4C; maturity is bucketed for the dirty set; and every
constant is tuned gently, because §7's designed counters (penetration,
range) don't exist until Phase 5, so the player's only answer to their own
callus in 4A is raw DPS.

**64. The growth ceiling is a fraction of a cell's headroom above its own
threshold — never an absolute density.** ✅
*2026-08-07, found in the project owner's playtest.* The first
implementation used absolute values (0.85 virgin / 1.0 mature). But
`grid.threshold` runs up to 0.94 (`clamp(1 - vein, 0.045, 0.94)`) and
`cellBucket` renders nothing at all while `growth <= threshold` — so an
absolute 0.85 virgin ceiling made **22.3% of the arena, 2,876 cells,
permanently unrevealable.** That is exactly the *"top left area all black,
the slime never was there"* the playtest reported: the field traced the
coral pattern and never filled between the veins.

Expressed as a fraction of headroom, `ceiling > threshold` holds for every
cell at any positive fraction, so **the failure mode is impossible by
construction rather than avoided by picking a lucky number.** 0.75 rather
than higher because `cellBucket` quantizes that same headroom into 5 steps
— at 0.8+ virgin ground lands in the top bucket anyway and the mechanic is
visually inert.

**Two corollaries fell out of the same fix, both load-bearing:**

- **Ambient growth may only ever add.** Treating the ceiling as a target to
  converge *to* would claw vein- and bloom-injected full-thickness slime
  back down within a few ticks, silently undoing every event. A cell at or
  above its ceiling is now skipped entirely — the ceiling caps what ambient
  *grows to*, not what a cell may hold.
- **Rate and ceiling must be independent levers.** With the logistic term
  normalized against remaining headroom, mature ground's larger headroom
  exactly cancelled its slower rate — measured as *identical* regrowth
  speed, collapsing §7's "slower, to a higher ceiling" into "same speed."
  Normalizing against full density instead separates them cleanly.

**65. A world-state placeholder must be legible against the empty
background, not just against the thing it overlays.** ✅
*2026-08-07.* The maturity placeholder shipped as a dark overlay and was
invisible — for a structural reason, not a tuning one. Scarring
concentrates exactly where the player clears, and cleared cells have growth
bucket 0, so nothing is drawn underneath them: **64% of all scarred cells
were black drawn on black**, measured on a max-weapons run. The rest was
dark-on-dark maroon.

Now neon green, a colour used nowhere else in the game so it cannot be
mistaken for finished art. Kept at the project owner's request — *"we can
keep it green for a placeholder to identify it's working."* (Caustic Cloud
is `#c9ff8a`, the same family; distinguishable in practice — blocky grid
cells vs. a smooth rimmed circle — but noted in BACKLOG in case it
confuses.)

**The generalisable rule**, and the reason this is a decision rather than a
bug note: BACKLOG's existing process finding says a signature visual is
part of any mechanic with a world-space effect, not just weapons. This
sharpens it — **it isn't enough for the visual to exist; it has to be
legible in the state the mechanic actually produces.** Scarring's natural
habitat is cleared ground, so that is what it had to be readable against.

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
