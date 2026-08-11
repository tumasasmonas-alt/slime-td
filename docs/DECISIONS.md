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

> **Superseded 2026-08-08, restored 2026-08-10.** The arsenal design pass
> (`docs/plans/phase-5-6-arsenal.md` §5) merged extension slots and
> support-gem sockets into one shared pool per weapon, arguing it made
> "specialise vs. generalise" a live question every socket opens. That
> supersession was never recorded here — a real gap, caught during
> Phase 6B-1's planning when the owner asked "will the loadout screen
> change?" and the shared-pool model turned out to contradict what this
> decision actually says. **The owner reversed §5 on 2026-08-10**
> (Decision 77): extensions and gems are back to two independent socket
> lines, restoring this decision's original text without further
> edit. §5's argument is recorded as reversed, not deleted — the trade it
> named (one UI, one rule) is still the honest cost of the reversal.

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

## Phase 4B — the two-axis visual system

> Decisions 66–67 came out of the 2026-08-07 session that planned and built
> Phase 4B. Plan and scope conversation:
> **`docs/plans/phase-4b-two-axis-visuals.md`**. The design they implement
> is §6 of the 2026-08-05 record.

**66. Density and maturity render on two independent perceptual channels —
alpha and hue — and calcified ground is pale, not dark.** ✅
*2026-08-07.* §6 promised "5 density steps × 4 maturity steps = 20 states,
none hand-authored." Delivered as: **density → alpha** (on a black
background alpha *is* thickness, which is §6's "opacity, mass" directly),
**maturity → hue/saturation** on a pink → coral → clay → bone ramp. The
channels stay strictly separated, which §6 is emphatic about — bleed them
and 20 states read worse than 5.

**The collapse bug was fixed by construction, not by picking better
colours.** The old `BUCKET_COLORS` read as ~3 buckets instead of 5 because
its steps were *unevenly spaced* (two dark maroons, two bright pinks), not
because the hues were wrong. Moving density onto evenly-stepped alpha means
the ramp cannot collapse again regardless of what colour rides on top — and
unlike a hand-picked hex list, that is testable, which is now guarded.

**Calcified is pale — a deliberate supersession of §6**, made on the
project owner's instruction and recorded per the ground-truth protocol
(#22). §6 says *"Mature = dark, desaturated"* with a table reading *"Dark
thick crust — the worst ground in the game."* Three reasons pale wins, the
first being evidence §6 could not have had:

1. **Dark rebuilds the bug Phase 4A shipped with.** Measured at the time:
   **64% of all scarred cells sit on *cleared* ground**, which is black.
   That is exactly why 4A's dark placeholder was invisible. "Mature = dark"
   reproduces that failure at ship quality.
2. **§7 needs scarring legible on bare ground** — it wants the arena to be
   *"a legible record of the run"* where a veteran reads a screenshot and
   knows how long it's been going. Tree rings require reading scar on
   cleared ground.
3. **§6 is arguably self-inconsistent** — it also specifies
   *"crystalline/plated at the top,"* which reads pale and mineral.

**Two supporting rules:**

- **Bare scarred ground draws below the thinnest slime alpha.** Terrain can
  never read as "more" than actual tissue; it is ground, not growth. This
  is what replaces 4A's neon-green placeholder and makes tree rings legible.
- **`frozen` renders as a rim, never a fill**, so it cannot compete with
  either axis, and reuses Frost Nova's existing `#bfe9ff` rather than
  introducing a fourth colour language. This also closes a bug open since
  Phase 2 — the precedent that forced 4A to ship a placeholder (#63).

Palette moved to its own `src/tuning/palette.ts`; `BUCKET_COLORS` deleted
rather than left as a dead export, and coagulants now source
`MATURITY_COLORS[0]` — fresh slime at full density, which is exactly what
#46 says they are.

**67. Anything feeding the rendered colour must be quantized, and mark
cells dirty only on a *quantized* change.** 📋 ✅
*2026-08-07, generalised from three applications.* The slime layer repaints
only dirty cells, which is what keeps it at microseconds instead of
milliseconds. Any continuous value wired into the render therefore has to
be bucketed first, or the dirty set silently becomes the whole grid every
tick and the optimisation evaporates.

Applied three times now, each a different shape of the same rule:

- **`growth` → `bucket`** (5 steps) — the original, from the port.
- **`maturity` → `matBucket`** (4 steps, #63) — the case that made the rule
  explicit, since maturity decays on *every cell every tick*.
- **`frozen` → a boolean** (#66) — quantization can be as coarse as
  "nonzero," and then only the two transitions (freeze, thaw) mark dirty. A
  cell counting down mid-freeze marks nothing, and an AoE freeze re-hitting
  already-frozen cells marks nothing.

The rule is worth stating separately from any one mechanic because the next
field state added to the render will need it too, and the failure mode is
quiet: correct output, gradually worse frame time.

---

## Phase 4C — Coagulants Wave 2. Phase 4 closes.

> Decisions 68–69 came out of the 2026-08-07 session that planned and built
> both halves of Phase 4C back to back. Plans, scoping conversation, and
> as-built deltas: **`docs/plans/phase-4c1-wave2-armour.md`** and
> **`docs/plans/phase-4c2-carrier-bulwark.md`**; the full account, including
> two balance bugs found live, is
> **`docs/sessions/2026-08-07-phase-4c-wave2.md`**. The design is §10/§11 of
> the 2026-08-05 record.

**68. Coagulant identity gains a third reading — mass shape — and armour
finally derives from source maturity. Sclerotic and Blastoma ship.** ✅
*2026-08-07.* §10 names four identity readings; 3C only wired up the first
(mass). This is the second and third: **maturity** (already legible since
4B) and **mass shape**, measured for free off the existing flood-fill
traversal:

```
fillRatio = cells actually reached / (π · maxDist² / cellSize²)
```

Near 1 for a solid saturated patch; low for a thin corridor that reaches
far while visiting few cells — §10's "webbed through an area." Identity
checks in a fixed order: maturity beats mass or shape (*"my own kill zone
got up and walked at me"* should hold regardless of size), split by mass
into Bulwark vs. plain Sclerotic (the high-mass+scarred table cell falls
through to Sclerotic until #69 exists to claim it); then shape at
sufficient mass makes a Blastoma; then the ordinary Wave 1 tiers.

**Armour is a function of source maturity, never a per-kind table** — a
Sclerotic is armoured *because* it formed from hardened ground, so no
separate balancing pass is needed as kinds are added. Decision 44's
consumption path has been live since 3C at `armor: 0`; this is what
finally feeds it, deliberately gentle (~20 max flat reduction) since its
counter (Phase 5's penetration) doesn't exist yet — paired with a **+50%
weapon damage pass** (`WEAPON_DAMAGE_SCALE`, one dial multiplied into all
six weapons' damage functions) so the mechanic is visible without ending a
run in 30 seconds. The project owner's tuning posture, explicitly: *"tune
it gently... so we can see our things implemented working but also not be
overwhelmed."*

**Blastoma fractures at 50% of its starting mass**, into two fragments
sharing the remainder, rather than at death — by death mass is 0, so
there's nothing left to give children, and inventing some would break Rule
2 (killing is a sink). Each fragment's kind derives from its own
(smaller) mass via the plain Wave 1 function, per Rule 4, not inherited or
hard-coded — confirmed with the owner after the plan flagged that "two
little motes" isn't guaranteed at realistic split masses: *"I agree with
deriving it from the mass."*

**Two constants were wrong on first write, both caught by the same
debug-harness methodology as Decision 59, neither any other way:**

- Bloom's own formation attempt fires at the *instant* peak begins, not
  after peak's own duration — so only its 4s active-phase window had
  actually accumulated maturity by the time it tried to spark itself. The
  first-pass rate reached ~0.16 at the epicenter; retuned ~4x to reach
  ~0.6, restoring §11's *"blooms let armour appear mid-field, earlier."*
- `MATURITY_SCLEROTIC_THRESHOLD` (0.55) was never reached in practice.
  Formation reads *mean* maturity over the whole flood-filled footprint,
  which dilutes hard toward the surrounding region's average — the
  highest mean any coagulant sparked at across a 500s max-weapons run was
  ~0.46, even though individual cells scarred past 0.9. Lowered to 0.4.
  Zero Sclerotics formed before this fix; roughly 5 of 8 active coagulants
  were Sclerotic after it, in the same test conditions.

**69. Carrier and Bulwark complete the roster. Non-circular bodies are
modelled as a cluster of circles.** ✅
*2026-08-07.* The last two of §10's seven kinds, shipped together as the
design requires (*"Carrier and Bulwark should ship as a pair"*) even
though the reason given — both making Threat Priority a real decision —
names a Phase 5 gem that doesn't exist yet. Building them anyway is
correct under the project's own ordering rule: Phase 4 asks the questions
Phase 5 answers, and Carrier/Bulwark *are* that question.

**Carrier feeds off the field it crosses** — Decision 42's hook, left in
place since 3C for exactly this (*"cheap to leave, annoying to
retrofit"*). Consumes revealed growth in a small radius each tick, adds it
to its own mass, updates its own radius/speed to match, capped relative to
its own starting mass so it can't compound unbounded. Its formation gate —
§10's fourth and last identity reading — is mean revealed density sampled
along the straight line from the spark point to the core: a pure
failure-gate, unaffected by mass or maturity at the spark point itself.
*"Keep the field clear and there is no corridor... a good player never
meets one."* Verified live: forms correctly against hand-calculated
corridor geometry in tests; none formed under a max-weapons run, which is
the mechanic working as designed rather than a defect.

**Bulwark is "wide and flat rather than round," and every existing
coagulant system assumed a circle** — `clearAt`'s damage loop, hit
detection, targeting, the renderer. **Chosen: a body is a cluster of
circles offset from a centre**, not true ellipse geometry. `radius` stays
the bounding circle for every existing cheap broad-phase reject,
unchanged; when `parts` is populated, narrow-phase iterates the actual
parts. Absent/empty `parts` (every other kind, unchanged) is exactly
today's single-circle behaviour.

Rejected alternatives, both in the plan before building: approximating
Bulwark as one bigger circle loses the "wall" read entirely, since the
shape is what lets it screen whatever's behind it; true ellipse geometry
needs a new overlap-area formula alongside the existing
`circleOverlapArea`, real complexity for a first-pass body this simple.
The cluster approach reuses every piece of circle math already written and
tested, and composes for free with Blastoma's existing seed-based "bag of
blobs" rendering.

**One accepted simplification, documented in code rather than solved:**
overlapping parts' damage areas aren't de-duplicated, so a hit landing
where two parts overlap can be counted slightly more than once. Kept
modest by the part-count/spacing constants; proper silhouette-union math
would be real complexity for a body this simple to justify.

Two shared primitives (`systems/coagulants.ts`) replace what four call
sites used to compute inline — `coagulantSurfaceDist` (nearest-part
distance, feeding both `findCoagulantHit` and `nearestFrontierPoint`) and
`coagulantOverlapArea` (summed per-part overlap, feeding `clearAt`'s
damage formula). Verified live: a 600s max-weapons run produced 7
Bulwarks with correct armour, 4-part bodies whose bounding radius actually
enclosed every part, rendering as visually distinct pale, elongated shapes
against round pink Behemoths.

**Phase 4 is complete** as of this decision — the terrain layer (4A), its
visual system (4B), and the full coagulant roster reading all four of its
identity signals (4C-1/4C-2) — with no further sub-phases planned before
the design record's own next milestone, Phase 5.

---

## Phase 5A — the weapon pipeline

> The arsenal design (18 weapons, 65 gems, slot/socket economics) was
> settled across three review passes on 2026-08-07/08 and lives in
> **`docs/plans/phase-5-6-arsenal.md`**, not here — nothing in that
> document is a decision yet, per its own stated policy, since none of
> its content has shipped. Decision 70 below is different: it is the
> first *implemented* piece of Phase 5, the pipeline the whole catalogue
> depends on, built 2026-08-08 after a full pre-refactor audit of every
> prior decision and session record.

**70. Every weapon is refactored onto a shared four-stage pipeline —
ready → acquire → deliver → resolve — with the fourth stage deferred, and
Ward Pulse is promoted from a passive to a weapon in the same pass.** ✅
*2026-08-08.*

**Why now, not with the first gem.** Weapons were six bespoke
`updateXWeapon()` functions. A gem hooking any of them would need a
special case per weapon — at the planned catalogue's size, 18 weapons ×
14 transformative gems is 252 hand-written cases. `src/weapons/pipeline.ts`
makes a gem a hook on a named stage instead: `ready` owns cooldown
bookkeeping, `acquire` owns targeting (absent for self-centered weapons —
nothing for a Targeting gem to replace), `deliver` emits the effect. Adding
a gem becomes one hook, not N special cases.

**Stage 4 (resolve) is deliberately not generalized yet.** For instant
weapons resolution already happens inside `deliver` (a direct `clearAt`
call); for projectile/cloud weapons it happens later in
`systems/projectiles.ts`/`systems/clouds.ts`, untouched by this refactor.
Building a uniform resolve-stage hook before a single resolve-stage gem
exists to prove it against is exactly the over-built-abstraction risk the
arsenal plan itself flags (§4's own risk #1); it gets built in Phase 6
when Splash/Pierce/Detonation actually need it.

**Zero behaviour change, verified three ways.** All 23 pre-existing weapon
tests — which turned out to already be outcome tests (asserting
`state.projectiles`/`state.grid.growth`/`state.orbitals`, never mocking
internals) — pass unmodified against the refactored code. A live
debug-harness run (Decision 59's methodology: `window.__debug` bridge,
`fastForward`, removed before commit) confirmed all seven weapons fire
correctly over 60s at max level with the core untouched. Production build
output is byte-identical in size to the pre-refactor build.

**Ward Pulse becomes Immolation Ring — the one deliberate exception to
zero behaviour change.** It had a cooldown and a tower-centered radius —
Frost Nova's and Blades' shape exactly — but was gated behind
`state.passives.ward` since the port, a genuine misclassification rather
than a design choice. Consequences of being misfiled as a passive: it
never got a visual (Decision 11's "a weapon's signature visual is part of
the weapon" only ever applied to things classed as weapons), and its
`clearAt` call never passed `coagulantMult` (harmless today — defaults to
1 either way — but would have silently no-op'd a future Penetration gem).
Promoting it moves `'ward'` out of `PassiveKey` and `'immolation'` into
`WeaponKey`; the mechanic itself is unchanged, the visual stays deferred
to Phase 6B as real content, not retrofitted here.

**Three balance gaps discovered during the promotion, deliberately
preserved rather than silently fixed:** Ward Pulse's tick never divided by
`atkSpeedMult` (Overclock never sped it up), its damage was never
multiplied by `damageMult` (Amplifier never boosted it), and its damage
formula (`10 * lvl`) was never touched by `WEAPON_DAMAGE_SCALE` (the +50%
Phase 4C-1 dial every other weapon carries). All three are pinned exactly
as they were — one with a dedicated regression test
(`weapons/immolation.test.ts`) proving Overclock still has no effect —
because "the architecture moved" and "the weapon got stronger" are
different changes, and only the owner should choose the second. Recorded
as an open balance question in `docs/plans/phase-5-6-arsenal.md`, not
decided here.

**A pre-refactor audit found and fixed two more gaps before this shipped:**
`tuning/weaponGeometry.test.ts` tested `towerCenteredRadius()` generically
but never enumerated a single weapon calling it — exactly the blind spot
that let prototype bug #5 make Orbiting Blades non-functional in every
run while its own isolated tests passed. A new test now enumerates
`bladeRadius`/`frostRadius`/`immolationRadius` — the real functions each
weapon calls — across every level and a spread of perimeters. Separately,
`immolationRadius` was extracted into `tuning/weapons.ts` alongside
`bladeRadius`/`frostRadius` rather than left as an inline constant in
`weapons/immolation.ts`, so that enumeration test has a real function to
call rather than a private one to duplicate.

---

## Phase 5B — the enhancement, socket and card-pool economy

> Decision 71 came out of the 2026-08-08 session that implemented Phase
> 5B, immediately following 5A. Plan, scope conversation, and the
> as-built delta (assist credit withheld) are in
> **`docs/plans/phase-5b-framework.md`**. The design it implements is
> `docs/plans/phase-5-6-arsenal.md` §5, §6, §9F, §11, §12.

**71. Weapon-level cards are gone; enhancement points bank globally and
open sockets on a fixed ladder; five passives port onto three core-gem
slots; assist credit is withheld.** ✅ (partial — see below)
*2026-08-08.*

**Card pool restructuring, Decision 40 finally implemented.** Today's
`buildCardPool()` had offered `{kind:'weapon', nextLevel}` cards since the
port; that branch is deleted outright. Weapon power now comes only from
`state.enhancementPool` spend — banked one point per level crossed
(`systems/xp.ts`), not yet spendable until Phase 5C's `+/-` control ships.
Until then the pool is legible rather than silently inert: `updateHud`
gained a `PTS n` readout (Decision 65's rule — a mechanic's state must
stay legible even in placeholder form).

New-weapon cards are gated on free deck slots
(`Object.keys(state.weapons).length < state.weaponSlots`, starting count
3) — previously unbounded, a single run could equip all seven weapons at
once. Extension cards level 1→3 then leave the pool **permanently**, the
project owner's rule, better than either option originally offered
(Decision 40's "cards appear to do nothing" root cause, closed the same
way for extensions as it was for weapon levels). Core gems get one
**guaranteed slot every second level-up** rather than a separate draw or
a slot in every draw — the former goes dead once 3 sockets fill, the
latter permanently spends a quarter of the pool on defence — with an
exhausted-pool fallback to a weapon-side card so a full core never offers
a dead pick.

**Card logic moved to `systems/cards.ts`, pure and unit-tested**, with
`ui/upgradeCards.ts` reduced to a thin DOM wrapper — this project's
existing systems/render separation, applied to a UI module for the first
time, since testing DOM construction directly would need a browser
environment this project doesn't otherwise use.

**Core gems: five of seven existing passives (`maxHp`, `regen`, `armor`,
`pickup`, `xpGain`) port onto three fixed sockets** (`state.coreGems`),
chosen because `CoreGemKey` reuses `PassiveKey`'s own values directly
rather than inventing a translation layer — `state.passives[key]` stays
the exact field `damageMult`/`atkSpeedMult`/`pickupMult`/`xpMult`/
`armorMult` already read, untouched. `state.coreGems` is new bookkeeping
for which three sockets are filled with what; picking a core-gem card
increments `state.passives[key]` by 1 and fills the next empty socket,
exactly mirroring the old passive-card mutation. **`damage` and
`atkSpeed` (Amplifier/Overclock) deliberately stay on the pre-5B
unrestricted mechanism** — per the arsenal plan they become per-weapon
socketed gems in Phase 6A, not core gems, and building that now with no
real weapon-gems to socket would be speculative plumbing.

**Duplicates disallowed among core gems** — at most one of each of the
five types across the three sockets. Not specified anywhere in either
plan; the general weapon-gem duplicate rule (same gem across different
weapons, never twice in one) doesn't obviously transfer to a single
3-socket "weapon." Chose "5 types competing for 3 slots" as the more
legible framing for a first cut, flagged as revisable at the gate.

**`pickThree`'s biased shuffle is fixed** — `sort(() => Math.random() -
0.5)` is not a uniform permutation, and the 5B gate exists specifically to
measure real card-pool dilution (arsenal plan §11), so a skewed shuffle
would have measured a distribution the game doesn't have. Replaced with
an unbiased Fisher-Yates in `systems/cards.ts`'s `shuffled()`.

**Gem inventory and no-destructive-respec, built as plumbing with no live
trigger yet.** `systems/sockets.ts`'s `withdrawPoints()` implements "gems
in a closing socket return to inventory, most-recently-socketed first" —
but extensions have nowhere to return to (no extension-inventory concept
exists in the design), so a withdrawal that would destroy a committed
extension is **clamped** instead: points can never drop below whatever
`socketCount()` needs to hold the extensions already on that weapon.
Nothing in 5B can yet trigger a withdrawal (5C's `+/-` is the first real
caller); tested directly, the same "build plumbing, test it standalone"
pattern 5A used for its own removed debug bridge.

**Assist credit — planned, not built.** The original design (an
`AssistTag` splitting a coagulant kill's XP between the destroying
weapon and whatever softened/marked/displaced it first) was written to
stop Solvent/Repulsor/Marker generating zero XP once they ship. Building
it surfaced that it doesn't address that: **XP is a single global pool**
(`state.tower.xp`), not tracked per weapon anywhere, and enhancement
points bank the same way. Any kill by any weapon in a deck already pays
the full pool today — a Solvent+Bolt build gets complete credit right
now, with nothing to fix. Assist credit would be real code, permanently
exercising nothing, for a per-weapon economy that isn't planned to exist.
The narrower real risk it was reaching for — an all-support deck with no
damage dealer generates no kills, hence no XP — isn't fixed by credit
*redistribution* either, since there's no kill event to redistribute
when nothing ever calls `clearAt`. Read as a legitimate consequence of a
bad build (Rule 4/Decision 27's own philosophy: the field's state is an
honest readout, not a system with a safety net), not a defect. **Raised
for the owner rather than silently dropped**, per the ground-truth
override protocol (Decision 22) — the same posture Decision 62 used for
the behemoth-timing pushback.

**The owner confirmed dropping it the same session** — *"it's fine to
drop assist credit if the player will still get the XP after the mass is
dead"* — which is exactly the finding. Moved to `docs/BACKLOG.md` *Ideas*
with a note on what would revive it: any future feature needing to know
*which weapon* earned something (per-weapon XP so weapons level
independently, an end-of-run damage breakdown, weapon-specific unlock
conditions). None are planned; all would need this. The related **UX**
concern — a player watching Solvent visibly do nothing to their kill
count may feel bad even with the economy working correctly — is real,
separate, and belongs at the feedback layer in Phase 6, not the economy
layer here.

**Render structural pass, unrelated to the economy but shipped in the
same session.** `OrbitalVisual` gained `shape`/`color`/`glowColor`,
`state.novaFx` became a list rather than a single nullable slot — Blades
and Frost moved their hardcoded render constants onto the entity with
zero visual change (same hex values), and `render/orbitals.ts`/
`render/novaFx.ts` now dispatch on entity data instead of assuming a
specific weapon. Closes the latent overwrite bug flagged during the
visual-cost audit: two pulse weapons firing the same frame previously
clobbered each other's effect.

**Verified live**: an 8-level card-pool composition dump confirmed the
core-gem cadence (present on even levels, absent on odd) and the
permanent absence of any `'weapon'`-kind card; a 425-second/58-level
random-pick soak test on all seven weapons at max ran with zero console
errors, filled all three core sockets with no duplicates, and left the
production bundle's byte size identical after the debug bridge's
removal. 380/380 tests, typecheck clean, build clean.

---

## Phase 5C — the pause + inventory screen. Phase 5 closes.

> Decision 72 came out of the 2026-08-08 session that implemented Phase
> 5C, immediately after Phase 5B. Plan, scope conversation, and the
> as-built delta are in **`docs/plans/phase-5c-inventory-ui.md`**. The
> design it implements is `docs/plans/phase-5-6-arsenal.md` §5, §6.

**72. The pause + inventory screen ships, making 5B's economy spendable;
the Phase 5 gate moves to after 6A.** ✅ *2026-08-08.*

**The screen.** A DOM overlay (Decision 5's pattern, consistent with the
level-up card panel and start/game-over overlays), listing every equipped
weapon with a live stat line (`WeaponDef.stats(lvl)`, new — terser than
`desc(lvl)`, which stays card copy), a `+`/`−` pair spending
`state.enhancementPool`, and a socket-dot row that visibly grows as points
go in — the intended mechanism for teaching the socket ladder with no
tutorial. A core row shows the three fixed slots and what occupies them.

**Opened two ways**: a HUD button during normal play, or a "Manage
Loadout" button inside the level-up card screen — settled 2026-08-08,
*"just got a point is exactly when a player wants to spend one."*
`main.ts` tracks which entry point was used so closing returns to the
right place: resuming play, or re-showing the pending level-up cards
rather than silently discarding them. A key shortcut was deliberately not
built — this game has zero keyboard input today and no controls hint
anywhere, so a key-only binding would have been undiscoverable for a
screen whose whole purpose is being opened repeatedly. The button teaches
the shortcut's existence first; the shortcut itself is a later addition.

**A real bug in 5B's plumbing, found and fixed here.** `withdrawPoints()`
shipped in 5B as pure plumbing with no live caller, and it had a genuine
gap: withdrawn points were removed from the weapon but never credited
back to `enhancementPool` — harmless while nothing called it, a real bug
the instant something did. Fixed as part of wiring the `−` button, along
with a new `investPoints()` (the mirror on the spend side) and an
exported `minPointsForSockets()` so the button disables itself exactly at
the extension clamp rather than showing live and silently no-op'ing. Both
directions are tested for round-trip conservation.

**Build for reuse, per the settled plan.** `ui/weaponRow.ts` is a shared
row renderer parameterised by mode (`'loadout'` for this screen,
`'select'` scaffolded for Phase 6-0's pre-run weapon select) — one module,
intended two callers, following `systems/cards.ts`'s precedent of
separating pure/reusable logic from the DOM wrapper that consumes it.

**A weapon at 0 points stays equipped and fires weakly** (settled
2026-08-08) rather than unequipping — freeing a deck slot from a stat
control would be a surprising side effect, and mid-run deck management is
a Phase 7 concern. Noted during implementation: this produces stats
genuinely *below* the weapon's old "level 1" baseline (every formula
assumed `lvl >= 1`; the socket model lets it reach 0), not a floor at the
old minimum — a minor tuning observation, not a defect, flagged in the
plan for whoever tunes it later.

**The Phase 5 gate moves to after 6A.** Its central question — *is
enhancement a decision or a slider?* — cannot be answered while sockets
are empty: opening a 4th socket buys nothing until Phase 6A ships real
gems, so specialising has no benefit beyond raw power and the answer is
forced to "slider" regardless of whether the design is sound. Running the
gate now would have produced a known-meaningless result that could later
be mistaken for a real finding. Build order is unchanged (5C → 6-0 → 6A);
only the point where the full gate runs moved. 5C still passed its own
small immediate check — does it open, does the `+`/`−` read legibly, does
anything break — which is answerable without gems and was answered live.

**Phase 5 is complete as of this decision** — the pipeline (5A), the
enhancement/socket/card-pool economy (5B), and the screen that makes it
usable (5C) — with no outstanding items. Next: Phase 6-0, a minimal
pre-run weapon select.

**Verified live**: the full open/close cycle from both entry points; `+`
raising a weapon's points, live stats, and the enhancement pool
simultaneously; socket dots growing from 1 to 2 exactly at the 3-point
threshold; the `−` button correctly disabling when withdrawal would
destroy a committed extension; a core gem socketing and rendering its
icon and name in the core row; the manage-loadout round trip (cards →
inventory → resume → cards reappear) leaving `pendingLevelUps` untouched
throughout. Zero console errors across the sequence. 389/389 tests,
typecheck clean, build clean, production bundle byte-identical after the
debug bridge's removal.

---

## Phase 6-0 — the pre-run weapon select

> Decision 73 came out of the 2026-08-09 session that reviewed and
> re-planned Phase 6. Full account: `docs/plans/phase-6-roadmap.md` (the
> re-plan and its five findings) and
> `docs/plans/phase-6-0-weapon-select.md` (6-0's own plan and as-built
> delta). Session record for the whole day:
> `docs/sessions/2026-08-09-phase-6-replan-and-6a.md`.

**73. The deck fills every slot, is fixed for the run, and the card pool
never offers a weapon at all.** ✅ *2026-08-09.*

**The finding that forced this.** Reviewing `phase-5-6-arsenal.md` §13's
phasing table against **shipped** Phase 5 code (rather than the design it
was written against) found four built weapons — Blades, Frost, Missile,
Immolation Ring — were unreachable in any run. `startRun()` always
equipped exactly 3 weapons and `state.weaponSlots` was always 3, so the
`newWeapon` card's only gate (a free deck slot) was permanently false.
Both halves were individually correct; the interaction was not, and
neither the 380 nor the 389 tests then in the suite caught it, because
the deck-full case is exactly the scenario the gating test asserts should
offer nothing.

**The owner's answer reclassified the finding from bug to missing UI.**
Asked whether a pre-run deck must fill every slot, the answer set the
whole design: *"All of the slots equipped, as you will be able to buy
more slots with currency, there is no way to change weapons mid-run. And
the player should not be offered any weapons in the pool — only
weapon-specific extensions, support gems and core gems."* This
**supersedes** one clause of `phase-5-6-arsenal.md` §5 ("an unlocked slot
is optional to use") — a deliberate, disclosed supersession per
`CLAUDE.md`'s ground-truth override protocol, not a silent one.

**What shipped.** A `Choose Weapons` / `Change Loadout` overlay reachable
from the start and game-over screens, built on `ui/weaponRow.ts`'s
`'select'` mode (scaffolded in 5C for exactly this), enforcing an
exact-count deck with a visible capacity refusal on unselected rows once
full; a deck line of weapon icons on both screens so the current
selection is legible without opening anything; `Try Again` keeps the deck
in-memory (not `localStorage` — session persistence, not cross-reload,
per the owner's ask). The `newWeapon` `CardChoice` kind is deleted
outright from `systems/cards.ts` — with the owner's rule in place it was
dead code by definition, not a variant left disabled.

**This closes the four-unreachable-weapons finding by design, not by
patch** — the pre-run select screen is now the sole way any weapon is
ever equipped. 393/393 tests, typecheck clean, build clean, verified live
(a Blades/Chain/Immolation deck equipped, rendered, and ran correctly;
`Change Loadout` opens pre-checked with the run's actual deck).

---

## Phase 6A — the gem foundation and the Behaviour class

> Decisions 74–75 came out of the 2026-08-09 session that built all of
> Phase 6A in one sitting, greenlit in full by the owner with explicit
> autonomy. Plans, as-built deltas, and full reasoning:
> `docs/plans/phase-6a1-gem-foundation.md` (6A-1) and
> `docs/plans/phase-6a2-behaviour-gems.md` (6A-2). Session record for the
> whole day, including the owner's *"don't just not give the player
> gems"* correction and the rejected-ideas table:
> `docs/sessions/2026-08-09-phase-6-replan-and-6a.md`. Folded into the
> same batch on the owner's request: a persistent visual for Immolation
> Ring, open since the Phase 2 port.

**74. Gems reason about a weapon's `DeliveryKind` archetype, not the
weapon itself — and 6A-1 builds everything needed to make a gem change a
number.** ✅ *2026-08-09.*

**The abstraction.** `DeliveryKind` (`projectile | orbital | pulse |
cloud | ring`) sorts the seven weapons by *how they deliver damage*, not
by name. A gem is authored once per archetype instead of once per weapon
— the N×M authoring cost the arsenal plan's own pipeline design (Decision
70) exists to avoid. Reading the seven shipped weapons back showed the
earlier cost estimate ("18 × 20 authored meanings") had assumed
reinterpretation happens per weapon; it doesn't, it happens per
archetype, which is a small fixed set.

**`weaponMods(state, key)`** computes a per-weapon
damage/rate/area/duration/velocity multiplier struct from socketed
Amplifier gems. Every weapon's `stats()` and pipeline read it instead of
the deleted global `damageMult()`/`atkSpeedMult()` — power is now a
per-weapon composition of socketed gems, not two flat global passives.
Six Amplifier gems shipped (Amplifier, Overclock, Expansion, Extension,
Velocity, Attunement), sized large enough to compensate for the deleted
passives rather than at face value, per the owner's call.

**Gem cards open the socket picker immediately on pick** (`onGemPicked`,
mirroring the module-level-callback pattern `ui/weaponSelect.ts` already
used) — the same *"just picked it, want to spend it now"* moment 5C
already built Manage Loadout for, avoiding a repeat of the 2026-08-05
*"cards appear to do nothing"* playtest finding, this time for gems
rather than weapon levels.

**The HUD's `DMG`/`SPD` readout becomes one smoothed overall-DPS
number**, the owner's own answer when asked how the modifier readout
should represent a multi-weapon, multi-gem build — better than the three
options offered. `systems/dps.ts` accumulates `clearAt`'s removal total
each frame and exponentially smooths it (`DPS_TIME_CONSTANT = 1.5`)
rather than showing an instantaneous, spiky number.

**A real bug found and fixed during implementation:** `WeaponDef.stats()`
was pure `(lvl) => string` with no gem awareness, so the inventory
screen's live stat line silently ignored every socketed gem — passed its
own tests because nothing had tested it *with* a gem socketed. Fixed by
adding a `mods` parameter (default `IDENTITY_MODS`), threading
`weaponMods(state, key)` through `ui/weaponRow.ts`. Verified live: Bolt
Turret's line moved from "15 pwr" to "22 pwr" after socketing one
Amplifier gem (15 × 1.45 = 21.75 → 22).

495/495 tests (up from 393 across this session's two halves combined —
see Decision 75 for 6A-2's share), typecheck clean, build clean.

**75. The Behaviour class ships with the machinery Phase 5A deferred, and
every gem reinterprets creatively across every archetype rather than
refusing on ones it wasn't designed for.** ✅ *2026-08-09.*

**Four mechanisms, deferred in 5A precisely because nothing needed them
yet, built now against real gems:**
- **RESOLVE-stage options** as new `ClearOptions` fields on `clearAt`
  (`ignoreResistance`, `flattenFalloff`, `overflow`, `kickback`,
  `priming`) — carrying Splash, Overflow, Kickback, Priming.
- **Projectile behaviour flags** (`pierce`, `forks`, `chains`, `bounces`,
  `homing`, `ricochet`) generalizing Chain's existing native hop
  machinery, shared via `advanceHop()`.
- **A weapon registry** (`weapons/registry.ts`) driving all seven weapons
  from one `updateAllWeapons(state, dt)` loop instead of `main.ts` calling
  seven functions by hand, plus a deferred-emissions queue
  (`state.pendingEmissions`) for Echo/Barrage. **Load-bearing beyond this
  batch**: a registry that can invoke any weapon's `deliver` by key is
  exactly what Trigger (Phase 6I — *"this weapon deals no damage itself;
  on impact it fires the weapon socketed below it"*) needs, and the
  arsenal plan calls Trigger the single most build-generating mechanic in
  the catalogue. Building the registry here for Echo makes Trigger close
  to free later.
- **Emission multiplication** (Multishot, Formation) via a shared
  `emissionAngles()` helper.

All 14 Behaviour gems shipped on top of these four, plus a bundle card
(`tuning/bundles.ts`, six themed packages) every `BUNDLE_INTERVAL = 5`
levels, pre-empting the normal draw and granting every gem in the package
in one pick — deliberately held back from 6A-1 since six Amplifier gems
alone can't form a package worth offering ("Amplifier + Overclock"
teaches nothing a single card doesn't; twenty gems can).

**The owner's mid-planning correction shaped the whole batch, and matters
more than any single mechanism.** An early draft would have refused
Pierce/Bounce/Ricochet on non-projectile weapons as "doesn't apply." The
owner's response: *"lets revisit the pierce bounce and ricochet gems and
think what they could do if slotted in not projective weapon. You have to
be creative and not just not give the player gems."* The resolving
insight: every archetype has its own real analogue of "what stops a hit
from doing more" — a per-target hit-cooldown window for orbitals and
rings, the density-resistance curve itself for pulses and clouds — so
Pierce/Fork/Chain/Bounce/Ricochet reinterpret against *that*, per
archetype, rather than being whitelisted per weapon or shipped as inert
placeholders.

**One exception, deliberately scoped and disclosed rather than hidden:**
Homing and Multishot/Formation are not wired for Immolation Ring
specifically. Either would desync its persistent ring visual from its
actual hit logic — the ring is drawn once at a fixed radius around the
core, and both mechanics assume a discrete, per-shot origin. Left as a
documented gap in the weapon file, not silently dropped.

**Immolation Ring's missing visual, folded in on request.** Persistent
`#39ff6a` bright-green ring stroke (`render/immolationRing.ts`) at
`immolationRadius(lvl, perimeter) * mods.area`, closing the oldest open
item on the BACKLOG — open since the Phase 2 port, when Ward Pulse (now
Immolation Ring) was a weapon misfiled as a passive and so never got a
render pass at all (Decision 70's reclassification fixed the mechanic;
the visual waited for this batch). Two of Immolation's three other
long-open balance gaps (no Overclock response, no Amplifier response) are
now closed for free by `weaponMods` applying uniformly to every weapon
including this one; the third (the missing 4C-1 `WEAPON_DAMAGE_SCALE`
+50% pass) is deliberately left open for Phase 6B, alongside Immolation's
real extensions and its dead `maxLevel` field. See BACKLOG.

**A real bug found and fixed during implementation, caught by the test
suite before ever reaching the browser.** `spawnForks()` pushed forked
children directly onto `state.projectiles` while `updateProjectiles` was
still mid-iteration over that same array via `for...of`; since the
function ends by reassigning `state.projectiles = remaining`, every
forked child was silently discarded the instant it was created. Fixed by
changing the function's signature to return the children
(`spawnForks(p): Projectile[]`) for the caller to
`remaining.push(...spawnForks(p))` instead of mutating the live array
mid-loop.

**Deliberately not extended, and recorded rather than silently limited:**
Fork/Chaining/Bounce/Ricochet are real (not placeholder) only on the
`projectile` archetype. Extending them meaningfully to orbital/pulse/
cloud/ring weapons would need `clearAt` itself to report per-target kill
events back to the caller — a real architectural change, out of scope for
"make the existing gems mean something" and not attempted here.

**Verified live, with a documented environment workaround.** The Browser
pane was not compositing frames this session
(`document.visibilityState === 'hidden'`, confirmed directly), which
throttles `requestAnimationFrame` to near zero and makes screenshot
capture time out — an environment constraint, not a code bug. Per
Decision 59's own precedent (a deterministic debug harness for exactly
this situation), a temporary `window.__debugTick(n, dt)` /
`window.__debugState()` bridge was added to `main.ts`, used to drive
roughly 700 manual ticks confirming the full gem pipeline end to end —
socketing, `weaponMods`, RESOLVE options, projectile flags, deferred
emissions, and the Immolation ring visual — then removed completely.
Typecheck, the full test pass, and the production build were re-run after
removal; the bundle hash was byte-identical before and after the bridge
existed, confirming the removal left no trace. A final fresh-tab smoke
test confirmed zero console errors and `window.__debugTick === undefined`.

495/495 tests passing (up from 393 combined across 6A-1 and 6A-2 — 45
test files, 6 new: `weaponMods.test.ts`, `gemSockets.test.ts`,
`resolveOpts.test.ts`, `emissions.test.ts`, `registry.test.ts`, plus
extensive extensions to existing suites), typecheck clean, build clean,
production bundle byte-identical after the debug bridge's removal.
**Committed and pushed.**

---

## Phase 6A-3 — the loop fixes from the post-6A playtest

> Decision 76 came out of the 2026-08-09 session immediately following
> 6A-1/6A-2 — the owner played the just-shipped batch the same day and
> found six things, three of them structural. Full account:
> `docs/sessions/2026-08-09-post-6a-playtest-and-6a3.md`. Plan, its
> revision note, and as-built delta: `docs/plans/phase-6a3-loop-fixes.md`.

**76. The card pool becomes socket- and ownership-blind (superseding
arsenal plan §11), the XP curve goes geometric, and extensions/core gems
bank exactly like gems always did, behind a new click-to-place inventory
panel.** ✅ *2026-08-09.*

**The finding that forced this.** The owner's first playtest on real
gems surfaced three structural breaks, not balance noise: leveling every
few seconds by level 50 despite the curve being quadratic; the card pool
degrading to nothing but Emergency Repair once every socket filled,
because nobody had specified what to offer once everything was
legitimately full; and socketing so unclear the owner *"second guessed
if it worked or is there a bug."*

**The XP curve gained a geometric factor.** Cost was quadratic in level
while income (destroyed mass) scales with DPS, and 6A's Amplifier gems
made DPS grow multiplicatively — so `xpToNext`'s own growth, which is
`O(level²)`, was guaranteed to eventually fall behind, and time-per-level
started *shrinking* past roughly level 50. `xpToNext(level)` now
multiplies its existing quadratic base by `XP_GROWTH ** (level - 1)`.
The `- 1` is load-bearing, not cosmetic: it leaves `xpToNext(1)` exactly
as it was, so Decision 61's *"the intended early rush survives"* holds
by construction. `XP_GROWTH = 1.08` is an unmeasured first draft — the
owner declined an offered measurement pass in favour of shipping now,
which is a legitimate call but means a retune should be expected.

**The card pool's fix is a rule change, not a patch.** The owner's own
words: *"it shouldn't matter if I have open sockets or not, I should
still be offered the same pool. The pool should not care if I have
something."* `buildWeaponSidePool`, `buildBundlePool` and
`buildCoreGemPool` stopped consulting free sockets or ownership entirely
for gems, bundles and core gems. This **supersedes arsenal plan §11's
no-dead-card rule** — a deliberate, disclosed supersession per
`CLAUDE.md`'s ground-truth protocol, not an accident. §11 was not wrong;
its premise (an unplaceable card is worthless) stopped holding once
leftover gems gained a destination — Phase 7's currency conversion,
which the same conversation gave a second use: the "orbital trade ship"
idea now has a concrete job, recycling surplus gems into currency
mid-run.

**Extensions are the one deliberate exception**, carrying real
ownership-awareness the other three kinds don't: *"when you roll an
extension you already have — socketed or unsocketed — it increases the
level, regardless if it's used or not... extensions are the only thing
with levels."* A re-roll of an owned extension levels that exact
instance in place, wherever it lives, rather than creating a duplicate —
which also yields a clean invariant for free: at most one
`(weaponKey, kind)` extension instance ever exists across inventory and
every weapon's sockets combined. Recorded explicitly as an asymmetry to
preserve, not an inconsistency to unify with the gem rule later.

**The build grew mid-conversation, and that growth was the right call.**
A first plan draft read the socketing complaint as a click-target problem
and kept extensions gated on free sockets. The owner's actual request —
*"the inventory itself has to have 3 sections for extensions, core gems
and support gems... visible when opening the loadout screen on the
side"* — turned it into a full banking pass. Extensions and core gems now
live in their own inventories (`state.extensionInventory`,
`state.coreGemInventory`), exactly like support gems always did. This
also deleted a wart for free: `withdrawPoints()` used to clamp rather
than close a socket holding an extension, purely because an evicted
extension had nowhere to go; with an inventory to evict to, the clamp —
and its exported `minPointsForSockets()` helper — is gone, and
withdrawal always succeeds in full.

**A core gem's effect moved from card-pick time to socket time**
(`systems/passives.ts`'s new `applyCoreGemEffect`/`removeCoreGemEffect`),
which is what makes the owner's unsocket rule implementable: *"unsocketing
the core gem should remove what it gave — if it gives max HP, take it
away when unsocketed."* The `hp = min(hp, maxHp)` clamp on removal is
what closes the actual exploit: without it, socketing `maxHp`, taking
damage, and unsocketing would leave `hp` unclamped above the reduced
max, and re-socketing would silently re-heal past where the player
actually was. Tested in both directions — a damaged unsocket heals
nothing, and a full-HP unsocket clamps down rather than leaving HP
floating above the new maximum — and verified live, not just in the
suite.

**The socketing UI itself was rebuilt**, not just resized. The owner's
diagnosis was correct and more specific than "the dots are too small":
the only route to inventory was clicking an empty socket, which then
filtered to gems legal *for that one weapon* — so anything that fit
nothing currently equipped was invisible in the entire UI, and once the
pool went ownership-blind that would only get worse. The fix is the
owner's own shape: a persistent three-section panel (Extensions / Core
gems / Support gems) beside the weapon list, with click-a-gem-then-
click-a-socket placement — every legal socket lights up, illegal ones
dim, and an explicit hint line states the interaction rather than
trusting an affordance that has already failed to teach itself once
(the 2026-08-05 *"cards appear to do nothing"* finding, recurring one
layer down after 6A-1). The pre-6A-3 per-row picker was kept as a working
second route rather than torn out.

**Verified live**, this time with the Browser pane compositing normally
— no visibility workaround needed, unlike the 6A-1/6A-2 session. A small
temporary debug bridge (`window.__debugGrantXp`/`__debugState`,
Decision 59's precedent) was still used to reach level 60+ without a
real ten-minute playtest, then removed; the production bundle hash
matched exactly before and after. Confirmed by hand: a gem placement
live-updates a weapon's stat line (Amplifier: 30 → 44 pwr); an extension
lights up only its own weapon's sockets; a core gem lights up only the
core row and nothing on any weapon; click-again and Escape both cancel a
placement cleanly; the legacy per-row picker still opens and sockets
correctly when nothing is selected; and the maxHp heal exploit is closed
in both directions. Zero console errors throughout.

513/513 tests passing (up from 495 — 18 new, covering the curve's
superpolynomial-ratio invariant, the socket/ownership-blind pool per
card kind, the extension uniqueness invariant, extension/core-gem
socket-unsocket round trips, and the maxHp heal exploit in both
directions), typecheck clean, build clean. **Committed and pushed.**

---

## Phase 6B — the incumbents' real extensions, and two socket lines

> Decisions 77–80 came out of the 2026-08-10 session. The owner asked for
> a plan, corrected two things in it during review — the socket model and
> the extension count — then greenlit both halves (6B-1: the socket
> rework and framework; 6B-2: the 28 extensions and four new mechanisms)
> with full autonomy. Full account: `docs/plans/phase-6b-incumbent-
> extensions.md` (6B-1, the umbrella) and `docs/plans/phase-6b2-
> extension-content.md` (6B-2).

**77. Extensions and support gems get two independent socket lines,
reversing arsenal plan §5, restoring Decision 32.** 📋
*2026-08-10.* §5 (2026-08-08) merged them into one shared pool per
weapon; the owner reversed that after a scope conversation, asking
"will the loadout screen change?" and diagnosing the review's own
confusion as *"a miscommunication... we call a pool offered on level up
and a pool of sockets the same."* Two rules fall out:

- The **gem line** is unchanged: `gemSocketCount()`, 1→5 sockets at
  0/3/8/15/24 points invested.
- The **extension line** is new: `extensionSlotCount()`, 0→1→2 slots at
  0–4 / 5–9 / 10+ points invested — the owner's own sub-proposal,
  chosen over a flat 2-from-zero (which would let an uninvested weapon
  field 2 extensions + 1 gem, undercutting "points buy depth") and over
  1-from-zero-plus-a-second-at-8 (loses the single clean rule).

**The capacity increase (5 sockets → 7 at full investment) is
intentional, not a side effect** — confirmed explicitly by the owner
rather than flagged as a balance risk for the gate.

`systems/sockets.ts`'s `occupiedSlots()`/`freeSlots()` (one combined
count) are replaced, not widened, by `freeGemSlots()`/
`freeExtensionSlots()` — each line evicts independently on withdrawal,
which also deletes the arbitrary "gems evict before extensions" tiebreak
the old combined-pool code needed and documented as arbitrary.

**78. Four extensions ship per weapon, not three — supersedes arsenal
plan §12's call 20.** 📋
*2026-08-10.* §7's own tables always listed four *candidate* extensions
per weapon, with the intent that a batch would pick three and keep the
fourth as a designed spare if one proved weak in play. With two socket
lines now making the contest permanent (Decision 77) rather than
disappearing above 8 points invested, the owner shipped all four:
*"Four — ship all designed candidates."* 28 extensions across the seven
incumbents (72 once the full 18-weapon catalogue ships). Cost: the
designed-spare safety net is gone (nothing left on the page if one plays
badly), and six extensions that duplicate a 6A gem all ship rather than
being quietly dropped as the spare — survivable specifically *because*
Decision 77 means an extension no longer competes with its gem twin for
the same slot.

**Heavy Slug (Bolt) ships with a genuine downside** — the catalogue's own
"slower, much bigger hits," +45/70/100% damage traded against −25/30/35%
fire rate. The first content in either the gem or extension catalogue
that takes something away, deliberately: *"everything shipped so far is
pure gain... exactly the shape that makes enhancement read as a slider
rather than a decision."* Evidence for the Phase 5 gate, not a balance
afterthought.

**79. Immolation Ring's `WEAPON_DAMAGE_SCALE` gap closes; `WeaponDef.maxLevel`
is deleted.** 📋
*2026-08-10.* The last of Immolation's three balance gaps (open since
Decision 70's promotion from Ward Pulse) — `immolationDamage()` now
carries the same +50% Phase 4C-1 pass every other weapon's damage
function has. Confirms the reasoning Decision 70 and 75 already
recorded: the gap was a classification accident (Ward Pulse misfiled as
a passive when the 4C-1 pass shipped), not a design position.
`WeaponDef.maxLevel` — dead since arsenal plan §6 retired weapon-level
caps and 5B removed the last reader — is deleted from the interface and
all seven defs, closing the BACKLOG entry that also flagged Immolation's
own value as inconsistent (6 against everyone else's 8).

**80. Shatter Core's damage bonus is a fraction, not the multiplier —
and Second Ring/Counter-Rotation/Chill Field all read outward.** 📋
*2026-08-10, both found while writing this batch's own tests.*

The extension catalogue's `shatter` field was implemented as the literal
multiplier (`opts.shatter` applied directly), while every extension's
own **value** (0.3/0.45/0.6, "+30/45/60% damage") was authored as a
*bonus fraction*, matching every other "+X%" value in the codebase (the
Amplifier gem's `delta`, for instance). Applied directly, a level-1
Shatter Core hit for `×0.3` — a 70% damage **reduction**, the opposite of
what the card claims. Caught by the extension's own outcome test
(`grid/clear.test.ts`) before it reached the browser; fixed to
`1 + opts.shatter`, matching every sibling field's convention.

Separately: three extensions describe a "second" instance of something a
weapon already has — Immolation's Second Ring, Blades' Counter-Rotation,
Frost's Chill Field. Every tower-centred radius floors at `perimeter`
(`CLAUDE.md`'s own sharp-edge list, prototype bug #5 below) — so a
second ring placed *inward*, the plan's own first-draft reading, sits
inside the perimeter and sweeps space nothing has ever occupied: a card
that sockets fine, describes itself correctly, and does nothing. Fixed
before any code was written, once §1 of `docs/plans/phase-6b2-extension-
content.md` traced the geometry — all three now go strictly outward
(1.4×, 1.25×, and the nova's own un-fractioned radius respectively),
which reads better against each card's own name besides being the only
version that actually works.

**Shipped:** the two socket lines and their UI (`ui/weaponRow.ts` split
into per-line rendering and per-line pickers, `ui/inventory.ts`'s
placing-mode highlight split into `{gems, extensions}`); the real
extension catalogue (`tuning/extensions.ts`, `systems/extensions.ts`,
folded into `weaponMods()`); all 28 extensions across the seven
incumbents, including four genuinely new mechanisms — coagulant
chilling (Shatter Core), a coagulant armour debuff respecting
`COAGULANT_ARMOR_FLOOR` (Corrosive/Bunker Buster, arsenal plan §12.3's
rule extended to a new mechanism), regrowth suppression as a `Grid`-level
`regrowMult`/`regrowTimer` pair decayed in the same pass `frozen` already
is (Rime/Ash), and the ring's second radius (Second Ring/Flare, with
`render/immolationRing.ts` reading the same radius constant as the
weapon rather than computing its own, avoiding the desync risk 6A-2
already declined to take once). 589/589 tests (up from 513 — 76 new),
typecheck clean, build clean.

**Verified live** via the same debug-harness technique Decision 75/76
used (the Browser pane was not compositing frames this session either —
`document.visibilityState === 'hidden'`): a run equipped with all seven
weapons, every one carrying two real extensions plus two gems, ran 900+
simulated ticks with zero console errors; the loadout screen's DOM was
read directly and confirmed both socket lines render correctly (an
extension-line dot showing "Heavy Slug Lv3" beside a gem-line dot showing
"Amplifier," 3 further gem sockets open at 24 points invested, exactly
matching `gemSocketCount(24)=5` and `extensionSlotCount(24)=2`); the
side panel's Extensions section showed real per-weapon names, icons and
descriptions in place of the old placeholder. The debug bridge was
removed and the production bundle hash matched exactly before and after.

**Committed and pushed.**

## Phase 6C — Lance, Shockwave, Fission Charge; the shape system; the beam archetype

> Decisions 81–85 came out of the 2026-08-10 session, continuing directly
> from Phase 6B. The owner greenlit both 6C-1 and 6C-2 as separate plans
> in one pass, then answered a round of build-time questions during
> implementation. Full account: `docs/plans/phase-6c-lance-shockwave-
> fission.md` (the umbrella), `docs/plans/phase-6c1-shockwave-fission.md`
> (6C-1), `docs/plans/phase-6c2-lance.md` (6C-2).

**81. The Phase 5 gate moves a third time — 6C ships before it runs.** 📋
*2026-08-10.* Roadmap §5 Q1 (2026-08-09) had already settled the gate at
"after 6B." Raised again rather than assumed, per `CLAUDE.md`'s
ground-truth override protocol, because it was already a decision — and
the owner moved it again: 6C ships first, gate after. The reasoning that
tipped it: 6C takes the roster to ten weapons against three deck slots,
which is a stronger place to ask *"is enhancement a decision or a
slider?"* than a three-weapon deck where every weapon is always
equipped — the same argument that moved the gate the first two times.
Named risk, not dismissed: the gate is also the go/no-go on the 65-gem
count, and 6D is a gem batch. Mitigated by extensions living on their own
socket line since Decision 77 — 6C's twelve don't depend on that count.
`docs/plans/phase-6-roadmap.md` §3's gate row moves below 6C's rows to
match.

**82. Four extensions per weapon is now the standing rule for every
future weapon batch, not a per-batch call.** 📋
*2026-08-10.* Decision 78 set this for 6B's seven incumbents; 6C
confirms it applies going forward rather than being re-litigated each
time — twelve extensions ship across Shockwave, Fission Charge and
Lance. A mixed roster (some weapons at three, some at four) was
rejected as a difference a player can see with no reason behind it.

**83. `ClearOptions.shape` — `clearAt` generalizes from a disc to an
annulus and a capsule, with the disc path required to stay
byte-identical.** 📋
*2026-08-10.* Shockwave's travelling ring and Lance's piercing beam both
need to damage something that isn't a circle. The arsenal plan's own
claim that Shockwave "reuses the pulse renderer" (§9½) was wrong for the
*damage* half — `NovaFx` is a fixed-radius flash; a travelling ring must
damage only the band it swept since its last tick, or it re-hits the
near field every tick as it grows past it.

**The alternative — sampling either shape with many small disc `clearAt`
calls — was considered and rejected**, on a corrected understanding of
why. The original argument cited both XP rounding collapse and raw
performance cost; the performance half was checked during review and
withdrawn (a full ring sweep is ~1,400 cell visits per tick — negligible).
The XP argument stands alone and is sufficient on its own:
`gemValueFromRemoved()` is `Math.round(removed * 1.3)` with a
`GEM_DROP_THRESHOLD` of 0.08 *per call* — splitting one hit across many
small calls rounds each toward zero, so a sampled beam would be the
hardest-hitting weapon in the game and pay almost no XP, silently. A
cheaper partial fix existed (a flag on `clearAt` to skip its own XP
block and let the caller sum and credit once) but was not taken — the
owner's call, weighing that Cauterizer's arc beam (6E) is a third
consumer already in the catalogue, so the shape system's cost is
amortized across three weapons, not two.

**Implementation:** the disc branch is untouched code (not a
re-derivation) inside an `if (!opts.shape)` guard; per-cell damage
(falloff, resistance, maturity, scarring, the dirty set) is factored into
one `applyCellDamage()` shared by all three shapes. The annulus's
coagulant overlap reuses the existing disc-overlap function twice
(`area(annulus ∩ c) = area(discOuter ∩ c) − area(discInner ∩ c)`, exact
for circular parts) rather than new lens-area geometry. The capsule's
coagulant overlap is a documented first-pass approximation — each part
treated as a disc centred at the closest point on the beam's segment,
exact away from the beam's own end caps. Density-based radius widening
(the disc's own `clamp(1.25 − density, 0.4, 1.25)` term) applies to the
disc only; annulus/capsule use their given width literally, which
sidesteps rather than fixes the density-sample-point trap the plan
flagged (a capsule sampled at its near-zero-density tower origin would
otherwise silently widen the whole beam). Rolled out inside 6C-1 with the
589-test suite proving the disc path unaffected before the annulus
shape was added, rather than as a separately playtested commit — the
suite had already earned that trust catching both of Decision 80's bugs.

**84. `'beam'` joins `DeliveryKind`; Velocity is refused, Extension is
allowed with a duration reading of its own.** 📋
*2026-08-10.* Lance is the sixth archetype. The actual cost, read off
`tuning/gems.ts` rather than assumed, was about six touch points: 14 of
20 shipped gems already have `supports: ALWAYS` (Decision 75's
no-refusals rule) or archetype-blind `desc` text, so most of the
Behaviour class needed no change at all — direct evidence the Phase 5A
pipeline bet paid off, worth carrying into the gate.

Velocity excludes beam for free (`supports` already only returns true for
`projectile`/`orbital`) — a beam is instantaneous, nothing to raise the
speed of. **Extension's call went the other way from what was
proposed:** refusing it (the first recommendation, reasoning that a gem
dead without a specific extension socketed repeats 6B-2's "cards appear
to do nothing" failure shape) was declined by the owner in favour of
giving beam its own duration term — the beam line stays hot briefly and
resolves a second time, independent of Lance's Afterglow extension.
Removes the only hole in the Amplifier table and stops Afterglow (itself
a lingering-line extension) from sitting next to a gem the game insists
beams can't have; Afterglow becomes "more of what the beam already
does" instead of the sole thing making a gem live — a strictly better
card for one field and one branch of cost.

Homing, Multishot and Formation's beam readings were also written
explicitly rather than left to fall through a `pulse`/`ring` default
that mentions "the pulse's centre" or "the tower" by name — Homing is an
honest no-op (Lance's ACQUIRE already always targets the largest threat,
the same shape Missile's own Homing no-op already established);
Multishot/Formation read as diverging beam angles.

**85. Shockwave stays a travelling ring, not a cone — raised by the
owner, checked against the catalogue, declined.** 📋
*2026-08-10.* Asked directly during review: *"why would a shockwave do
donut-shaped damage? ...can we make it into a cone maybe?"* The band is
delivery, not effect — the ring travels, so at any instant it can only
damage what it's currently crossing; over its whole life the swept bands
are contiguous and the net effect is exactly the full disc the owner
described, once. An instant disc was also considered and is genuinely
redundant, but with **Frost**, not Immolation — Immolation is a
persistent thin ring at a fixed radius; Frost is the instant-disc pulse,
so an instant Shockwave would be Frost with more damage and no freeze.
The travelling ring is the entire differentiator: damage visibly arrives
outward over time, and Knockback (a genuine reuse of the shipped
`kickback` `ClearOptions` field, not new displacement code) becomes a
shove that travels.

**A cone was specifically declined** — it is already Solvent Sprayer's
shape (arsenal §7.13, 6E) and Cauterizer's sweep is a related arc beam
(§7.12); a cone Shockwave would consume that vocabulary a batch early and
add an aiming stage §7.9 deliberately did without. Also declined: making
density-scaling core to Shockwave rather than the Resonant Ring
extension — that would collide with **Resonance Coil** (§7.14), whose
whole catalogue identity is damage scaling with density.

**Shipped:** Shockwave (`weapons/shockwave.ts`, `systems/shockwave.ts`,
`render/shockwave.ts`) — a persistent `ShockwaveRing` entity, damage
applied once per sim tick to the band it swept, render radius computed
continuously from `state.time` so the visual stays smooth despite the
tick-quantized damage; Fission Charge (`weapons/fission.ts`) — Cluster
Warhead's own `spawnClusterSubmunitions()` parameterized
(`scatterDist`/`childPowerShare`, defaulting to Missile's original
constants so Cluster Warhead is unaffected) rather than duplicated;
twelve extensions (Shockwave: Second Wave, Knockback, Resonant Ring,
Implosion; Fission: Wider Scatter, Chain Fission, Sticky, Focused
Pattern; Lance: Piercing Core, Twin Lance, Afterglow, Long Charge —
`lanceOvercharge`, a forced rename off Bolt's already-shipped
`'overcharge'` key). Chain Fission's recursion is bounded by a
generation counter (`fissionGen`) checked against the *parent's* own
generation, terminating by construction the same way Decision 75's Salvo
`armAt` fix does — a grandchild can never itself grant a further split,
not merely "shouldn't in practice." Lance's charge tell is three layers
(a core aura that works with no target on the field, orbiting — never
inward-drifting — particles so they can't be misread as the game's own
XP-pickup idiom, and a target line that re-acquires every tick while
charging so it never lies about a bigger coagulant forming mid-charge).
637/637 tests (up from 589 — 48 new), typecheck clean, build clean.

**Verified live**, Browser pane compositing normally this session (no
debug-harness workaround needed for visibility, though a temporary
`window.__debugState` bridge was still used to force specific weapon/
coagulant scenarios rather than waiting on natural spawns — removed
before commit, bundle hash `index-Dpl-3qc_.js` identical before and
after): all three weapons confirmed damaging a coagulant directly
(mass 5000 → 4942 over an observed window, attributable to Lance's beam
and Fission's cluster bursts — Lance's `beamFx` spawned exactly at the
coagulant's position with `lanceCharge.target` matching); the Extension
gem's socket highlighting lit Shockwave and Lance but correctly stayed
dark on Fission live in the loadout screen, and Velocity's highlighting
showed the exact opposite pattern — both gem-legality directions
confirmed through the real UI, not only the test suite. Zero console
errors throughout.

**Committed and pushed.**

## Post-6C playtest — three real bugs, bundles cut, and a difficulty/pacing pass

> Decision 86 came from the owner's live playtest of Phase 6C immediately
> after it shipped, 2026-08-10 — the same pattern as 6A-3 (Decision 76)
> and every other batch this project has actually run: real bugs surface
> from play, not review. Reported as a flat list; grouped here by kind.

**86. Three real bugs found by playtesting, all fixed the same session,
plus bundles cut and a deliberate difficulty pass.** 📋 *2026-08-10.*

**Bug — Lingering Spores (Caustic Cloud) always drifted due east.**
`systems/clouds.ts` derived drift direction as
`atan2(c.y - originY, c.x - originX)`, and a cloud's `originX`/`originY`
were always set to its own spawn `x`/`y` — so this was `atan2(0, 0) = 0`
at the exact moment it mattered, every single time. The code's own
comment even lampshaded the edge case (*"a stationary cloud drifts
east, not NaN"*) without noticing the edge case was the only case that
ever ran. Fixed by choosing a random `driftAngle` once at spawn
(`weapons/poison.ts`) and holding it fixed, rather than re-deriving
direction from a position that never differs from the origin.
`originX`/`originY` are deleted from `CausticCloud` — nothing else read
them.

**Bug — cluster submunitions (Fission Charge, Chain Fission, and
Missile's Cluster Warhead) always landed in the same fixed pattern.**
`spawnClusterSubmunitions` (`systems/projectiles.ts`) placed children at
`(k / count) * 2π` — evenly spaced starting at a fixed angle every
single burst, reading on screen as a static cross/star shape rather than
a scatter. Fixed to an independently random angle per child, per the
owner's explicit call ("I want the subcharges and bounces to be random
not fixed pattern") over the alternative (a randomly-rotated but still
evenly-spaced ring) — some overlap between children is accepted as the
honest cost of a genuinely random scatter. Shared by all three
consumers; none of the existing tests asserted exact positions, so
nothing else needed updating for it to apply everywhere at once.

**Bug — Twin Canister's second cloud always landed at the same
diagonal offset.** A flat `+40/+40` from the target, every time. Same
fix shape as the cluster bug above: a random angle at the same fixed
distance.

**Content call — support gem bundles removed from the level-up pool
entirely.** *"Sounded good on paper but not good"* — the owner's verdict
after playing with them live. `tuning/bundles.ts` is deleted, along with
`CardChoice`'s `'bundle'` variant, `buildBundlePool`, `BUNDLES_PER_DRAW`,
the bundle-interval branch in `pickCards`, the bundle case in
`applyCardChoice`, and the bundle rendering branch in
`ui/upgradeCards.ts` — removed outright rather than gated off, since
nothing else in the game reads a bundle once the level-up draw stops
offering one (CLAUDE.md's own convention: delete rather than leave dead
code behind).

**Pacing call — the level-up draw shrinks from 4 cards to 3**
(`CARDS_PER_DRAW`, `systems/cards.ts`) — a shorter, more legible draw,
settled the same session as the bundle removal.

**Pacing call — the XP curve tightens again.** `XP_GROWTH`
(`tuning/xp.ts`) raised from 1.08 to 1.12, after a live playtest still
found "too many levels" even with 6A-3's geometric factor in place
(Decision 76). **A flat multiplier on the whole curve was tried first
and reverted** — it would have raised `xpToNext(1)` too, which breaks
Decision 61's explicit guarantee that the early rush survives any
retune *by construction* (`^(level - 1)` evaluates to exactly 1 at
level 1 regardless of what `XP_GROWTH` itself is set to). `XP_GROWTH`
alone is the only lever that tightens the curve without reopening that
guarantee — caught by the test suite's own pinned `xpToNext(1) === 19`
assertion before it shipped.

**Difficulty call — the slime made overall harder**, the owner's direct
request: coagulant travel speed (`COAGULANT_SPEED_K`/`MIN`/`MAX`,
`tuning/coagulants.ts`) and arrival damage
(`COAGULANT_ARRIVAL_DAMAGE_MULT`) both raised ~30-40%; Infection Event
frequency (`EVENT_INTERVAL_BASE`/`FLOOR`, `tuning/events.ts`) shortened
~30%, ramp shape unchanged; ambient growth rate and core contact damage
(`AMBIENT_BASE`, `CREEP_RAMP`, `CONTACT_SCALE`, `tuning/growth.ts`) all
raised ~30%. Every one of these already carried a "not finalized,
balance-pass knob" comment from when it was first tuned down during the
3C playtest gate — this is the same knob, turned the other way, not a
new mechanism. No weapon damage or player-side stat was touched; this is
a threat-side-only pass.

**Content call — Fission Charge recolored to blue**, distinct from
Shockwave's lighter cyan (`#7fd8ff`) so the two don't read as the same
weapon on screen when both are equipped.

**Verified:** typecheck clean, build clean, 633/633 tests (down from 637
— seven bundle-specific tests removed with the mechanism, three new
regression guards added: two different `driftAngle` values produce
genuinely different cloud positions, repeated Lingering Spores casts
don't all pick the same angle, repeated Twin Canister casts don't all
land at the same offset). **Not verified live in the browser this
session** — the owner's explicit call, trusting the test suite and
typecheck given the changes are either pure-function tuning constants or
already covered by the new regression tests.

**Committed and pushed.**

---

## The Phase 5 gate — run and passed

> Decision 87 closes a checkpoint that had been open since Phase 5C and
> moved three times (Decisions 81 and its two predecessors). It is
> recorded here rather than in a session file because it produced two
> verdicts and no build.

**87. The Phase 5 gate ran on 2026-08-10 and passed on both questions.**
📋 *2026-08-10.*

The gate was never only a bug hunt — it carried two verdicts that gate
the batches after it. Both were answered by the owner after playing the
post-6C build.

**Verdict 1 — *"is enhancement a decision or a slider?"* → a decision.**
The socketing loop works as designed: choosing what goes where reads as
meaningful rather than as numbers going up. This is the question that
moved the gate three times (it cannot be asked with empty sockets, nor
with only one of the two socket-fillers real, nor against a three-weapon
deck where every weapon is always equipped). **It is now closed.** The
two independent socket lines (Decision 77), 40 real extensions, ~20
gems, and ten weapons competing for three deck slots are the
configuration it passed against — if any of those change materially,
the question is worth re-asking, but not otherwise.

**Verdict 2 — the 65-gem catalogue count → go, unchanged.** This was
`phase-5-6-arsenal.md` §14's risk 2 and the reason the gate was worth
running before 6D specifically. **6D ships its full 19 gems** (Conditional
11 + Targeting 8) rather than a trimmed or sliced set. The alternatives
offered and declined: trimming the 19 to a sharper subset, and splitting
6D into a Targeting-only 6D-1 to judge before committing to Conditional.

**The bugs the gate did find were fixed in the same pass and are
Decision 86**, above — three real bugs, bundles cut, and the XP/difficulty
retune. That work is already shipped; this decision records only the
verdicts, which 86 does not carry.

**Consequence for build order: none.** 6D is next exactly as
`phase-6-roadmap.md` §3 has it. The gate's own risk — named when it moved
the third time — that a bad result would strand 6C's twelve extensions,
did not materialise.

---

**88. Phase 6D-0 (the balance-shape pass) shipped tuning-only, no
playtest gate before 6D-1/6D-2.**
📋 *2026-08-11.*

Built per `docs/plans/phase-6d0-balance-shape.md`: unbounded ambient/event
escalation (`LATE_GROWTH_PER_MINUTE` on `ambientInfectionMult`, an
asymptotic 3s floor on `eventSpawnInterval` replacing the old hard stop),
a ~10% softer opening (`AMBIENT_BASE`/`CREEP_RAMP`), the aura reach fix
(Blades/Frost/Immolation's `TowerCenteredReach` terms raised sharply, plus
Blades' `HIT_RADIUS` and level-1 blade count), the Chain Bolt/Fission
nerfs and Shockwave buff, and armour raised to 35 with a **bounded**
time-scaling term (+35 over 15 minutes, capped at 70 total) rather than
the unbounded shape the difficulty curve otherwise uses — see the
degeneracy argument in `phase-6d0-balance-shape.md` §6 and its as-built
delta §10 for the exact bound (holds for Lance at level >=3, not for a
weapon left at level 1 all run).

**The plan's own §8 called for a playtest between 6D-0 and 6D-1** — *"its
result changes what the others should be."* **That did not happen.** The
project owner explicitly instructed all three 6D sub-batches (6D-0, 6D-1,
6D-2) built and shipped in sequence within one session, typecheck and
`vitest run` only, no live/browser verification — overriding the plan's
own gate. This is a deliberate, explicit owner call, not an oversight, but
it means 6D-1 and 6D-2's designs (particularly the aura-targeting-gem
readings in 6D-1, which assume the aura reach fix actually lands them
somewhere meaningful) were **built against 6D-0's numbers unverified by
play**. If a real playtest later shows 6D-0's tuning needs to move, 6D-1's
aura-specific gem readings are the most likely thing to need a second look
alongside it.

Test fallout from the reach/damage changes (four pre-existing tests in
`weapons/blades.test.ts` and `weapons/immolation.test.ts` hardcoded
numbers that moved) is recorded in the plan's own as-built delta, not
repeated here.

---

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
