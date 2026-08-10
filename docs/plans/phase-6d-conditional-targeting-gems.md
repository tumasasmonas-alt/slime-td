# Phase 6D — Conditional (11) + Targeting (8) gems, and a balance-shape pass

**Status:** plan, awaiting greenlight. Nothing here is built.
**Written:** 2026-08-10, immediately after the Phase 5 gate passed
(Decision 87) and the owner's second playtest of the post-difficulty-pass
build.

> **This plan is bigger than "add 19 gems," because the playtest that
> greenlit it also reported a balance shape that the tuning constants
> confirm is structural.** §1 is that finding. §2–3 are the gem review the
> owner asked for — *"do these particular ones have a place?"* The answer
> is no for at least three of the eleven, and the reason is specific:
> Phase 6B already shipped them as extensions.

---

## 1. The balance finding, before any gems

The owner's report: *"the game resists and is a bit too difficult at the
start but later on its way too easy."* This is not a coefficient problem.
Every threat axis in the game is **a bounded ramp that flattens**, while
player power has no ceiling at all.

| Threat axis | Where it lives | Start → end | Stops climbing at |
|---|---|---|---|
| Ambient infection | `growth.ts` `AMBIENT_ESCALATION` | 1.0× → **3.1×** | t = 560s (9m20s) |
| Event frequency | `events.ts` | 18s → **7s** interval (2.6×) | t = 420s (7m) |
| Coagulant mass | emergent from field density | scales *with* ambient | inherits the 3.1× cap |

**After roughly nine minutes, the game stops getting harder. Permanently.**
Player power does not: levels are uncapped, Amplifier gems are `+45%`
damage *each* and stack multiplicatively across five gem sockets per
weapon, three weapons, plus 40 extensions and three core slots.

This is the *same finding* as the 2026-08-05 playtest, which measured
**player power scaling 17–21× against the infection's 3.1×** and concluded
"no value of `CONTACT_SCALE` was right at both ends." It was never fixed —
it was absorbed into the rework, and the rework changed what generates the
threat without changing the fact that its escalation terminates.

**The 2026-08-10 difficulty pass made the reported symptom worse, not
better, and did so predictably.** It raised the *base* of every axis 30–40%
while explicitly preserving the ramp shape ("Ramp time is untouched, so
the relative escalation shape over a run is preserved" — `events.ts`; the
same note appears in `growth.ts`). Raising the base of a curve that
plateaus makes **the start harder and leaves the plateau exactly as far
below the player as it was**. That is precisely "too hard at the start,
way too easy later."

**The fix is a shape change, not another multiplier.** Options in §5 Q1.
The honest framing: this is Phase 8 (balance) work arriving early because
the gate surfaced it. It is worth doing *before* 19 more damage-affecting
gems land on top, since every gem shipped in 6D widens the same gap.

## 2. Weapon balance — the strong two and the weak auras

Raw single-target DPS at level 8, computed from `tuning/weapons.ts`:

| Weapon | Lv1 | Lv8 | Notes |
|---|---|---|---|
| **Chain Bolt** | 14 | **496** | 6 forks × 44 dmg ÷ 0.40s. The outlier. |
| **Bolt Turret** | 27 | 287 | |
| **Fission Charge** | 16 | **223** | ×9 submunitions, each a ~55px blast — *area* coverage is the real number, well above the raw figure |
| **Lance** | 28 | 215 | across a 520px capsule |
| **Orbiting Blades** | 48 | **~1000** | 5 blades × 44 ÷ 0.22s — **on paper the strongest weapon in the game** |
| **Immolation Ring** | 14 | 109 | |
| **Shockwave** | 6 | 39 | |
| **Frost Nova** | 4 | **26** | the arsenal plan's own *"17-DPS embarrassment"* |

Your read on the strong end is confirmed: **Chain Bolt and Fission Charge
are the top two**, and Chain is ahead of the field by roughly 2× on raw
output alone. (You said "lightning bolt" — Chain Bolt is the arc weapon
and is the outlier; Bolt Turret at 287 is high but not the problem. Worth
confirming which you meant.)

### The aura weapons: the problem is uptime, not damage

You said they should be stronger by default because taking them is a risk.
**I agree with the conclusion and want to flag that a straight damage buff
is the wrong lever for two of the three** — the numbers say their damage is
mostly fine and their *engagement* is broken:

`towerCenteredRadius()` returns `max(perimeter + margin, base + perLevel × (lvl-1))`,
and `PERIMETER` has been **fixed at 90** since Decision 38. Resolving that:

| Weapon | Lv1 | Lv8 | Lv12 |
|---|---|---|---|
| **Orbiting Blades** | 105 | **105** | **105** |
| **Immolation Ring** | 100 | 108 | 132 |
| Frost Nova | 115 | 199 | 247 |
| Shockwave | 150 | 276 | 348 |

**Orbiting Blades' radius never changes — at any level, ever.** Its
`perLevel: 2` term is dead: `64 + 2×11 = 86`, still under the 105 floor at
level 12. Immolation's is nearly dead — it clears its own floor only at
level 7. Both weapons are pinned to a ~105px ring in a world whose max
range is ~1150px, and contact damage begins at 90px.

**So Blades and Immolation only fire once the infection is already inside
the breach line** — they are weapons that activate when you are already
losing. Blades' thousand paper DPS is real and almost never collected: five
16px hit discs on a fixed circle, each needing its own cell revealed.

That is why they feel bad to take, and it is also *why* your risk framing
is right — but the risk they currently carry isn't "they need the slime
close," it's "they do nothing at all until the run is already going badly."

**Proposed split of the fix:**
- **Blades, Immolation** — the lever is **reach and uptime**. Revive the
  dead `perLevel` terms so levelling visibly extends the ring, and lift
  `base` so they engage *before* the breach line rather than after it. Then
  the risk is real but payable.
- **Frost Nova, Shockwave** — the lever *is* **damage**. 26 and 39 DPS at
  level 8 are not a design position, and Frost's is a documented
  embarrassment the catalogue planned to fix with a gem (see §3).

Both are pure `tuning/weapons.ts` edits. Neither touches `towerCenteredRadius()`
or DECISIONS #16 — the perimeter floor stays exactly as it is; we're
raising the *other* term, which is what it was built to allow ("the anchor
is a FLOOR, not a lock").

## 3. The Conditional gems — do these eleven earn their place?

You were right to ask. **Three are already in the game, shipped as Phase 6B
extensions**, and one more is a soft duplicate. 6B's own review caught this
in the opposite direction (six candidate extensions duplicating 6A gems);
nobody re-checked the gems against the extensions afterwards.

| Gem | Verdict | Why |
|---|---|---|
| **Penetration** | ✅ **Ship** | Decision 44 called it "obvious and load-bearing." Armour is live with a floor; nothing generic subtracts it. |
| **Virulence** | ✅ **Ship** | The maturity field (4A) and scar ring exist and nothing generic answers them. The catalogue's own scar-ring answer. |
| **Desperation** | ✅ **Ship** | Comeback gem, no analogue anywhere in the game. |
| **Proximity** | ✅ **Ship** | Unique — and it is the **aura weapons' own zone**, so it compounds §2's fix. Caveat below. |
| **Giant-Slayer** | ✅ **Ship** | Pairs with Threat Priority; nothing scales on mass generically. |
| **Culling** | ✅ **Ship** | Mirror of Giant-Slayer, and the Blastoma-fragment answer alongside Triage. |
| **Saturation** | 🟡 **Ship, narrowed** | Overlaps Immolation's **Backdraft** extension (scales with ring density) and partly the **Pierce** gem (`ignoreResistance`). Distinct enough *if* it's a damage bonus rather than another resistance bypass. |
| **Momentum** | 🟡 **Soft duplicate** | Blades' **Serration** extension is already a streak ramp with a cap. Universal vs per-weapon is a real difference, but it's the same feeling twice. |
| **Corrosion** | ✅ **Ship** *(reversed)* | Overlaps Poison's **Corrosive** extension. Kept anyway, on the owner's call, *because* §6's armour rise makes a universal armour-strip load-bearing rather than a Poison speciality. |
| **Shatter** | ❌ **Cut — already shipped** | Frost's **Shatter Core** extension. Same name, same mechanic; `chill` and `shatter` are live `ClearOptions` fields. Worst case of the three: only Frost applies chill, so the gem is **dead in any deck without Frost and redundant in any deck with it** — Shatter Core already grants the bonus "from any source." Its stated job (*"Frost stops being a 17-DPS embarrassment"*) is already done, and §2 shows it didn't work. |
| **Sterilizer** | ❌ **Cut — already shipped** | `suppressRegrowth` is live via Frost's **Rime** and Immolation's **Ash**. |

**Settled: 8 ship, 1 narrowed, 2 cut → 9 Conditional gems, not 11.**
Owner's call, 2026-08-10, after reviewing the overlap directly. Corrosion
was recommended for cutting and reversed on the armour finding.

Note this does **not** reopen the gate's 65-gem verdict — that was a go on
the catalogue's *size and pacing*, not a commitment to every individual
entry. Cutting three that already exist under a different name makes the
catalogue smaller in name only.

**One caveat on Proximity, and on the catalogue's habit generally.** The
arsenal plan's fix for Frost being weak was *a gem* (Shatter). That is
fixing an unconditional problem with a conditional, randomly-offered item —
the weapon is still bad for everyone who doesn't roll it. §2's tuning fix
must land regardless; Proximity should make aura builds *exciting*, not be
the thing that makes them *viable*.

## 3a. What the nine Conditional gems actually do

Asked directly by the owner. Proposed numbers are first-draft, sized
against the existing gems (Amplifier is +45% damage) and expected to move.

| Gem | What it does | The condition, concretely |
|---|---|---|
| **Penetration** | Subtracts a flat amount from the target's armour before damage applies | Always on, but only *matters* against armoured targets. With §5's armour rise this goes from nice to essential. Decision 44 called it "obvious and load-bearing." |
| **Virulence** | More damage against high-**maturity** ground | Maturity is the 4A field that hardens tissue into the scar ring. This is the generic answer to "the scar ring is unkillable" — the thing Solvent does as a whole weapon. |
| **Saturation** | More damage scaled by how **dense** the tissue is at the hit | Rewards firing into the thick of it rather than nibbling the frontier edge. Distinct from Pierce, which *ignores* the density penalty rather than paying you for density. |
| **Giant-Slayer** | More damage against **high-mass** coagulants | Behemoths and Bulwarks. Pairs with Threat Priority — one finds the big thing, the other kills it. |
| **Culling** | More damage against **low-mass** coagulants, and instantly finishes near-dead ones | The mirror. Answers Blastoma fragments and the motes that stream past while you fight a wall. Pairs with Triage. |
| **Corrosion** | Hits stack a lasting **armour reduction** on the target | Overlaps Poison's Corrosive extension; kept as the universal version because §5 makes armour matter. Builds up over sustained fire rather than applying at once. |
| **Desperation** | Damage scales up as **core integrity drops** | Comeback gem. Strongest when you are closest to losing — dead weight in a run going well, which is the point. |
| **Proximity** | More damage the **closer to the core** the target is | The other comeback gem, and the one that pays for letting things get close. **This is the aura weapons' own zone** (§2), so it compounds their fix. |
| **Momentum** | Damage **ramps while the weapon keeps landing hits**; resets on a miss or a kill | Rewards sustained fire into a big target. Soft-overlaps Blades' Serration extension, which is the same streak idea per-weapon. |

The shape of the class: **six read the target** (armour, maturity, density,
mass high, mass low, distance-to-core), **two read your own state** (core
HP, hit streak), and **one writes a debuff** (Corrosion). None of them are
flat multipliers — that is what makes them Conditional rather than a
second Amplifier class.

## 4. The Targeting gems — seven of eight hold up

Reviewed against shipped code; no duplicates, and the mechanism is cheap
(they replace stage 2 of the pipeline, at most one per weapon, which the
pipeline enforces structurally).

**One cut recommended.** **Scattershot** ("targets randomly within reach")
is the weak entry: every other gem in the class is a *strategy*, and this
one is the absence of one. It reads as a downgrade from nearest-wins rather
than a trade, and "coverage" is already better served by Multishot,
Formation and §7's aura reinterpretation. **Recommend 7 ship, 1 cut.**

The other seven are genuinely distinct, and the class holds together as a
set of tensions rather than a list: Threat Priority ↔ Triage (biggest vs
weakest), Breach Priority ↔ Vigilance (defend the core vs starve the
reservoir), Fixation ↔ the Priming gem (focus one target vs spread fire —
a real anti-synergy the player can discover). Field Priority is the only
one that targets the grid rather than coagulants, which earns its slot.

Two notes to carry into the build:
- **Threat Priority already exists in effect** — Lance's
  `highestMassPoint()` (6C-2) is exactly this, hardcoded as its identity.
  The gem generalizes it; Lance's own targeting should route *through* the
  same helper rather than duplicating it.
- **Opportunist** ("target whatever another weapon hit last") needs a
  shared last-hit record that doesn't exist yet. Small, but it's the one
  Targeting gem carrying new state. Everything else reads what's already
  in `GameState`.

## 4a. ⚠️ The shipped-gem audit — four gems work on exactly one weapon

The owner asked for the audit to cover **all** shipped support gems, not
just Multishot. Done below, against code rather than against the gem
descriptions. The headline finding is bad enough to change 6D's scope.

### Fork, Chaining, Bounce and Ricochet are wired into Bolt Turret alone

`systems/resolveOpts.ts` exposes `projectileFlags()`, which turns these
four gems into real behaviour. **Exactly one weapon module imports it:**
`weapons/bolt.ts`. Not Chain Bolt, not Missile, not Fission, not Lance —
`chain.ts` and `missile.ts` push projectiles with no behaviour flags at
all — and none of the five non-projectile weapons.

`tuning/gems.ts`'s own class comment (line 149) discloses part of this:
the four are *"REAL on the `projectile` archetype only in this batch...
their orbital/pulse/cloud/ring readings below are honest descriptions of
the design's intent, not yet backed by code."* **The reality is narrower
than the disclosure** — it is not the projectile archetype, it is one
weapon of the ten.

**Four of twenty gems do nothing on nine of ten weapons, while showing the
player a description that promises an effect.** Socket Fork into Frost and
the inventory screen reads *"Splits into two on a kill, each continuing
outward."* Nothing splits. The comment argues against disclosing this in
the copy (*"that would read as an unfinished-game admission mid-run"*),
which was defensible when the gap was one batch old and the fix was
scheduled. It is not defensible as a shipped state: the copy isn't
undisclosed, it's **wrong**.

### The full audit

| Gem | Status across the ten weapons |
|---|---|
| Amplifier, Overclock, Expansion, Attunement | ✅ Real everywhere. |
| Extension, Velocity | ⚪ **Refused** on archetypes with no such term — enforced at socket time, so honest. But an all-aura deck can never use either, and they bank forever (Phase 7's currency sink doesn't exist yet). |
| Splash, Overflow, Kickback, Priming | ✅ Real everywhere — they ride `clearAt`, which is archetype-agnostic. |
| Echo, Barrage | ✅ Real everywhere — deferred-emission queue, archetype-agnostic. |
| Pierce | ✅ Real everywhere, with a genuine per-archetype reading. **The model the others should follow.** |
| **Homing** | 🟡 Real on projectile/orbital/cloud/pulse/ring; explicit **no-op on `beam`** (honest, disclosed in the description itself). |
| **Multishot, Formation** | 🔴 Technically wired everywhere, but **damage is divided by the emission count**, so on Blades it is a **precise zero** and on Frost a **downgrade** (§7). |
| **Fork, Chaining, Bounce, Ricochet** | 🔴 **Bolt Turret only.** Dead on nine weapons, with copy that says otherwise. |

**So: 6 gems of 20 are dead or worse on most of the roster.** That is the
"dead gems" problem the owner named, quantified.

### What this adds to the batch

§7 was scoped as "reimagine emission multiplication on auras." The audit
says the job is bigger and has two halves:

1. **Make Fork/Chaining/Bounce/Ricochet real beyond Bolt.** The blocker is
   named in the same comment: it needs `clearAt` to report *which*
   coagulant a hit killed, not just how much mass moved. That is a real
   change across its call sites — but it is the same class of change
   6C-1's `ClearOptions.shape` already made successfully, and it unlocks
   four gems on ten weapons rather than one.
2. **Make Multishot/Formation buy coverage instead of dividing damage**
   (§7).

Both are 6D-3. This is now the largest sub-batch, not a polish pass.

## 4b. The aura floor rule

Added by the owner mid-review: *"aura weapons have to be by default at
level 1 stronger than projectile ones, because if I run all aura weapons I
die."*

The code explains the death precisely. At level 1 the aura radii are
Blades **105**, Immolation **100**, Frost **115** — and contact damage
begins at 90. **An all-aura deck has no reach at all**: it cannot touch the
infection until the infection is already 10–25px from the damage line. It
isn't that the deck is weak, it's that it does not engage.

**Adopted as an explicit, testable rule for 6D-0:**

> At level 1, with no gems and no extensions, each aura weapon's effective
> output must exceed the projectile baseline — and a deck of three aura
> weapons must be survivable, not merely slower.

"Effective" is load-bearing: **paper DPS already satisfies this and it did
not save the run.** Blades' level-1 paper DPS is 48 against Bolt's 27 —
nearly double — and the deck still dies, because output multiplied by an
engagement rate near zero is near zero. So the rule is enforced on both
terms: reach first (so the weapon has targets before the breach line),
damage second.

Guarded by tests in the spirit of Decision 20 — an **outcome** test ("a
level-1 all-aura deck survives the opening N minutes") rather than a
mechanism test pinning a specific radius, so it survives the retune it is
certain to get.

Reviewed against shipped code; no duplicates, and the mechanism is cheap
(they replace stage 2 of the pipeline, at most one per weapon, which the
pipeline enforces structurally).

Two notes worth carrying into the build:
- **Threat Priority** already exists in effect — Lance's
  `highestMassPoint()` (6C-2) is exactly this, hardcoded as its identity.
  The gem generalizes it; Lance's own targeting should be expressed
  *through* the same helper rather than duplicating it.
- **Opportunist** ("target whatever another weapon hit last") needs a
  shared last-hit record that doesn't exist yet. Small, but it's the one
  Targeting gem carrying new state. Everything else reads what's already
  in `GameState`.

**Recommendation: ship all 8 unchanged.**

## 4c. 6D-0 designed: how the aura deck actually gets balanced

> Written after the owner's correction that 6D-0 and 6D-3 had been *named*
> rather than *designed*. The correction was right, and working it through
> changed the answer: **the aura fix is not a damage buff.**

### The finding that decides it

`clearAt` applies `power` **per cell**, with a `1 - d/radius` falloff.
Radius is not a divisor — a bigger radius removes strictly more mass at the
same `power`. Ranking level-1 weapons by mass removed per second
(`power × radius² ÷ cooldown`, dropping shared constants):

| Weapon | Lv1 field throughput | vs Bolt |
|---|---|---|
| Immolation Ring | ~136,000 | **7.4×** |
| Frost Nova | ~50,000 | 2.7× |
| Bolt Turret | ~18,400 | 1.0× |
| Orbiting Blades | ~12,200 | 0.7× |

**Immolation and Frost already out-clear the projectiles at level 1 by a
wide margin — and the deck still dies.** So a damage buff would be aimed at
a stat that is already winning. The plan's earlier "raise Frost and
Shockwave damage" line was wrong on that basis and is withdrawn.

### Why the deck actually dies

`systems/growth.ts:72-79`: ambient growth is not a front creeping inward.
Density rises **everywhere simultaneously**, at a rate ramped by distance:

```
d < perimeter:  rate ∝ CREEP_RAMP × proximity      (heavily damped)
d ≥ perimeter:  rate ∝ ((d - perimeter) / outerSpan) ^ 0.6, floored at CREEP_RAMP
```

Evaluated at the radii the aura weapons actually occupy:

| Distance | Local ambient rate | Who lives here |
|---|---|---|
| 100px | 0.056 | Immolation, Blades |
| 115px | 0.096 | Frost |
| 250px | 0.31 | — |
| 400px | 0.49 | — |
| 1000px | 0.91 | where projectiles engage |

**The aura weapons are parked in the one annulus the design guarantees is
nearly empty**, and `applyCellDamage` early-returns on any cell below 0.001
density. They are not under-powered; they are aimed at vacuum. An all-aura
deck dies because it has no engagement, and no amount of `power` multiplies
an empty cell.

### The fix: move them to where the density is

Aura value = **area covered × local growth rate × per-cell power ÷ cycle
time**. The first two terms are what's broken, and both are fixed by the
same edit — raising the `base`/`perLevel` terms of `TowerCenteredReach`.
This is exactly what that struct exists to allow (*"the anchor is a FLOOR,
not a lock"*), so DECISIONS #16 and the perimeter floor are untouched.

| Weapon | `base` | `perLevel` | Lv1 radius | Lv8 radius | Lv1 gain |
|---|---|---|---|---|---|
| **Immolation** | 66 → **190** | 6 → **18** | 100 → 190 | 108 → 316 | ~3.6× area × ~2.5× local rate ≈ **9×** |
| **Frost** | 115 → **210** | 12 → **20** | 115 → 210 | 199 → 350 | ~3.3× area × ~2.3× rate ≈ **7.5×** |
| **Blades** | 64 → **165** | 2 → **14** | 105 → 165 | 105 → 263 | area × rate ≈ **6×**, plus below |

**Blades needs two more edits, because it's the one aura that is genuinely
low-throughput** (0.7× Bolt): its hit disc is only 16px, and its
`perLevel: 2` term has never once cleared the floor at any level.
- `HIT_RADIUS` 16 → **26** (2.6× area per blade)
- `bladeCount` at level 1: 1 → **2**

**Shockwave is excluded from the reach fix** — it already travels outward
from the floor, so its reach is fine. Its weakness is band thickness; that
is a `SHOCKWAVE_SPEED` / damage question and is handled with the weapon
spread, not here.

### Meeting the aura floor rule (§4b)

At level 1, post-fix, Immolation is roughly **60×** Bolt's field throughput
and Frost roughly **20×**, in a band that now actually contains density.
That satisfies the owner's rule with room to spare — deliberately, because
the rule is about an all-aura deck *surviving*, and the failure mode being
corrected is a total-engagement failure rather than a small shortfall. The
outcome test in §4b is what pins it; these numbers are the first draft.

**The named risk:** auras now cover the perimeter band where contact damage
happens, which is their design identity but also makes them strong at
exactly the moment the core is threatened. If the playtest says they trivialize
the defensive game, the lever is `perLevel` (how fast reach grows), not
`base` — cutting `base` puts them back in the vacuum.

## 5. Armour — the fourth flat, capped axis

Raised by the owner in the same pass: *"armour on slime and coagulants
feels like it's inconsequential, we have to increase it."* The code agrees,
and for a reason worth stating precisely.

`grid/clear.ts:391` — armour is **flat subtraction with a floor**:

```
effectivePower = max(power - effectiveArmor, power × COAGULANT_ARMOR_FLOOR)
```

`ARMOR_AT_FULL_MATURITY = 20`, reached only at maturity 1. Against level-8
damage:

| Weapon | Damage per hit | Armour 20 costs it |
|---|---|---|
| Lance | 313 | **6%** — invisible |
| Bolt Turret | 68 | 29% |
| Chain fork / Blade / Fission submunition | ~44 | 45% |

Two findings fall out:

1. **Flat subtraction scales inversely with hit size**, so armour taxes
   many-small-hits weapons and is a rounding error for big hitters. That is
   Decision 44's deliberate design ("makes many small hits worse than one
   big hit") and is *not* being changed.
2. **Armour is the fourth axis with the same shape problem as §1** — it is
   `maturity × 20`, and maturity caps at 1, so armour has a hard ceiling
   that damage growth leaves behind within a few levels.

**Settled (owner, 2026-08-10): raise armour, and let it scale with time**,
joining §1's unbounded escalation instead of capping at full maturity. The
flat-subtraction model stays; the ceiling goes.

### ⚠️ Unbounded armour degenerates, and needs a bound

Working the settled call through: `effectivePower = max(power - armor,
power × 0.15)`. As `armor` grows without limit, **every weapon converges on
exactly 15% of its damage** — the floor stops being a safety net and becomes
the only term that matters. At that point weapon damage numbers no longer
distinguish anything, Penetration stops mattering (it subtracts from a
value already past the floor), and the arsenal flattens into "whoever fires
fastest over the largest area."

That is the opposite of the intent, and it arrives on a schedule: with
`ARMOR_AT_FULL_MATURITY` at 35 and a doubling every 10 minutes, Lance is at
the floor by ~25 minutes and Chain's forks by ~8.

**Proposal: armour scales with time but is bounded as a *fraction*, not a
constant** — cap effective armour at the point where the best-hitting weapon
still keeps ~50% of its damage, and let the unbounded half of the
difficulty curve be carried by coagulant **count and mass** (which have no
such degeneracy) rather than by armour. Armour then becomes a real, growing
tax that never erases weapon identity.

This contradicts the letter of the settled call ("let it scale with time",
unbounded), so per `CLAUDE.md`'s ground-truth protocol it is raised, not
applied — see §8 Q1.

**One interaction to handle, flagged rather than re-asked:** rising armour
hits small-hit weapons hardest, which includes **Blades** — the weapon §2
is trying to buff. Since the owner's standing position is that aura weapons
should be *stronger by default*, the build will compensate Blades and
Immolation in their own damage/reach numbers so the armour rise doesn't eat
the buff. If that reads wrong, it's a one-line change.

## 6. What was settled, and the batch shape

All settled by the owner on 2026-08-10, during this plan's review:

| Question | Call |
|---|---|
| Difficulty shape | **Unbounded slow multiplier, no cap.** Threat climbs forever, matching uncapped player power. |
| The opening | **Make the beginning easier — by about 10%, not a rollback.** The owner's calibration, given after the aura fix was designed: *"now it's like 10 percent too hard at the start."* Mid-game is right where it is. It must then keep climbing. Note the aura fix (§4c) is itself a large early-game buff, so the opening should be re-judged after it lands rather than cut twice. |
| Weapon spread | **Both ends** — nerf Chain Bolt and Fission Charge, raise the weak ones. |
| Aura weapons | **Stronger by default** — "using them is a risk to begin with." |
| Armour | **Raise it, and let it scale with time.** Flat-subtraction model unchanged. |
| Duplicate gems | **Cut Shatter and Sterilizer; keep Corrosion** (armour makes it load-bearing). |

**The batch is: 9 Conditional + 8 Targeting = 17 gems, plus a balance pass.**

**Split:**
- **6D-0 — the balance pass.** §1's unbounded escalation with an easier
  opening, §2's weapon spread (both ends), §5's armour rise and time
  scaling. Tuning only, no new content. **Ships and gets playtested first.**
- **6D-1 — the 8 Targeting gems.** Self-contained, no new damage math.
  Threat Priority should route through Lance's existing
  `highestMassPoint()` rather than duplicating it.
- **6D-2 — the 9 Conditional gems.** All damage-conditional, so they land
  on a curve that is already the right shape.
- **6D-3 — aura-weapon gem reinterpretation** (§7). Emission
  multiplication currently costs damage or does nothing on all three aura
  weapons; this makes it buy coverage instead. Sequenced last of the four
  because it needs 6D-0's reach/damage fix underneath it — otherwise it's
  multiplying a weapon that still has no targets.

6D-0 first is load-bearing, not cosmetic: shipping 17 damage-affecting gems
onto a flattening curve makes the late game worse before it makes it
better, and it would also make it impossible to tell which change caused
what at the next playtest.

## 7. Support gems on aura weapons are a no-op or a downgrade

Raised by the owner mid-review: *"support gems on aura weapons need
reimagining, like multishot on blades should make 2 blades orbit a central
point which orbits the core."* Checking the shipped code, the situation is
worse than "unimaginative" — **on all three aura weapons, Multishot
currently costs you damage or does nothing at all.**

| Weapon | What Multishot does today | Net effect |
|---|---|---|
| **Orbiting Blades** | `blades.ts:133` — adds `plan.count - 1` blades, then divides damage by `plan.count` | **Exactly zero DPS gain.** More blades, each proportionally weaker. Pure decoration. |
| **Frost Nova** | `frost.ts:68` — splits one pulse into `count` pulses at `1/count` damage and `radius / 1.6` each | **A downgrade.** Same total damage spread over a smaller total area. |
| **Immolation Ring** | Not wired at all (Decision 75, deliberate — it would desync the persistent ring visual) | Dead gem. |

This is the *mirror image* of the problem Decision 74/75 solved. There, the
question was "don't refuse gems on non-projectile weapons" and the answer
was per-archetype reinterpretation. That worked for the Behaviour class —
but the **emission-multiplication** gems got a literal reading (more
emissions, damage divided to stay fair) that is only meaningful when
emissions can *go to different places*. On a weapon whose geometry is
fixed around the core, they can't, so the division is all cost and no
benefit.

**The owner's proposed reading is the right shape**, and generalizes:
multiplication on an aura should buy **coverage**, which is the exact thing
auras lack (§2), rather than splitting a fixed damage budget.

Proposed per-archetype readings, to be settled in the batch's own plan:

- **`orbital` (Blades) — the owner's satellite reading.** Multishot spawns
  a second orbit *centre* that itself orbits the core, carrying its own
  blades. Sweeps a genuinely larger annulus, and directly answers the
  105px-pinned-radius problem without touching `towerCenteredRadius()`.
  **Damage per blade must not be divided** — the gain is meant to be real.
- **`ring` (Immolation) — concentric rings.** The mechanism already exists:
  6B's **Second Ring** extension draws an outward concentric ring, and the
  Decision 75 desync worry is discharged by it, since that extension ships
  a second ring visual that stays in sync. Multishot becomes "one more
  ring, further out."
- **`pulse` (Frost, Shockwave) — sequential waves, not split pulses.**
  Multishot fires `count` pulses in sequence at full radius and full
  damage each, rather than simultaneously at reduced both. Reads as a
  drumbeat; Shockwave already has the travelling-ring machinery for it.

**This is its own batch (6D-3), not a tuning tweak** — it touches emission
handling, three weapon modules and at least one renderer, and it is the
kind of change the project's own record says only a playtest can grade.

## 7a. 6D-3 designed: how the dead gems get fixed

> Also written after the owner's correction. §4a diagnosed; this is the
> design.

### Step 1 — four weapons get four gems for free

`weapons/chain.ts`, `missile.ts`, `fission.ts` and `lance.ts` push
projectiles **without calling `projectileFlags()`**. Bolt does. Nothing
else differs. Wiring those four call sites turns Fork, Chaining, Bounce and
Ricochet on for four more weapons with **no new mechanism at all** — it is
the single cheapest fix in the batch and should land first, before any
design work.

That takes the four gems from 1 weapon to 5. The remaining five weapons are
the aura/cloud/beam archetypes, and they need Step 2.

### Step 2 — reinterpret, don't port

`tuning/gems.ts:158` says these need *"clearAt to report which coagulant a
hit killed."* **That is only true of the literal "on kill" readings.** Every
aura weapon already knows its own hit position, and the deferred-emission
queue from 6A-2 already exists. So most readings are implementable
weapon-locally, with no change to `clearAt` at all:

| Gem | orbital (Blades) | pulse (Frost/Shockwave) | ring (Immolation) | cloud (Poison) | beam (Lance) |
|---|---|---|---|---|---|
| **Fork** | hit sheds a small projectile outward from the blade's own position | pulse spawns a second smaller pulse at its rim | spawns a second ring at 1.5× radius *(Second Ring's machinery)* | splits into two smaller clouds on expiry | beam splits into two diverging beams past its endpoint |
| **Chaining** | hit arcs to the nearest target beyond the orbit | follow-up pulse centred on the farthest point it touched | a delayed outward ring at 2× radius | spawns a tendril cloud toward the nearest mass | beam continues from its endpoint to a second target |
| **Bounce** | blade jumps to a different orbit radius on hit | re-emits a smaller pulse offset from centre | alternates inner/outer ring each tick | cloud hops to the next mass on expiry | beam reflects to a second target |
| **Ricochet** | blades reverse orbit direction periodically, re-sweeping ground | an **inward**-travelling ring after the outward one *(Shockwave's own machinery)* | a second tick at reduced power shortly after | drift direction reverses | fires again along the same line at reduced power |

**Only the `clearAt` return needs to change for the "on kill" cases**, and
even then the cheap version suffices: have `clearAt` return the hit
coagulants it touched alongside the mass figure, rather than threading kill
events through all ~15 call sites. Same shape as 6C-1's `ClearOptions.shape`
generalization — extend the one damage path rather than add a second.

Several of these reuse machinery that already shipped, which is the
strongest signal the readings are right rather than invented: Immolation's
Fork *is* Second Ring, and pulse Ricochet *is* a Shockwave ring with a
negative speed.

### Step 3 — the emission-multiplication rule

The bug is that Multishot divides damage by emission count unconditionally
(`blades.ts:133`, `frost.ts:68`). The principled rule:

> **Divide damage only when the extra emissions can overlap the same
> target. When they cover new ground, damage stays whole.**

That is not a buff for its own sake — it is what makes the division
*correct* in the case where it currently applies. Three spread projectiles
can all converge on one coagulant, so dividing keeps single-target output
flat; that stays exactly as it is. Two blades on the *same* orbit can also
overlap, so today's division is defensible there too. But two orbit centres
at different radii, or two concentric rings, cannot both hit the same cell —
so dividing there is a pure penalty for taking the gem.

| Archetype | Multishot becomes | Damage |
|---|---|---|
| projectile | unchanged — a spread that can converge | **divided** (as today) |
| **orbital** | the owner's satellite reading: extra orbit *centres*, each carrying blades, orbiting the core at their own radius | **whole** — distinct ground |
| **ring** | concentric rings further out | **whole** — distinct ground |
| **pulse** | sequential waves at full radius, not simultaneous shrunken ones | **partial** (later waves reduced, like Echo) — same ground, different time |
| cloud | extra clouds around the point, less shrunken than today | **partial** — clouds can overlap |
| beam | unchanged — diverging beams can converge on one target | **divided** |

**Formation** is the fixed-pattern variant of each of the above, exactly as
it is today — no separate design needed once Multishot is right.

### What this does not do

It does not touch the Amplifier class's honest refusals (Extension,
Velocity). Those are enforced at socket time, so they are unavailable
rather than dead, and the real fix is Phase 7's currency sink for banked
gems — out of scope here and already recorded.

### Still open

1. **Armour's bound (§5).** Unbounded flat armour collapses every weapon
   onto the 15% floor and erases weapon identity. Recommend bounding it as
   a fraction and letting coagulant count/mass carry the unbounded part of
   the curve. Needs the owner's yes, since it narrows a settled call.
2. ~~"Lightning bolt"~~ — **settled: Chain Bolt**, the 496-DPS outlier.
3. **Decision records needed.** Unbounded escalation supersedes the bounded
   `AMBIENT_ESCALATION` table and the event-interval floor; time-scaled
   armour extends Decision 44's model without replacing it. Both want
   entries in `docs/DECISIONS.md` when 6D-0 lands, per the ground-truth
   protocol.
