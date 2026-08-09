# Phase 6A-2 — the Behaviour class, and the machinery it needs

**Status:** ✅ **Shipped 2026-08-09, greenlit in full alongside 6A-1 with
owner autonomy. Committed and pushed.** See DECISIONS.md #75 and "What
changed during implementation" below.

**What this is.** The second half of Phase 6A. 6A-1 makes gems exist, be
granted, be socketed, and change a number. **6A-2 makes them change what
a weapon does.** It is the harder half by a wide margin, and it is where
three pieces of machinery that Phase 5 deliberately deferred finally get
built — each now with real gems to prove it against, which is the
condition 5A set for building any of them.

**Why it is a separate batch:** `docs/plans/phase-6-roadmap.md` finding
2, and `docs/plans/phase-6a1-gem-foundation.md` §2 — only 2 of the 14
Behaviour gems are the "one function on stage 3" the arsenal plan
assumes. The rest need machinery that does not exist.

**Source:** `docs/plans/phase-5-6-arsenal.md` §4 (the four stages and the
one hard constraint on stage 4), §9B (the fourteen gems), §11 (the bundle
card), §12 (settled calls); `docs/plans/phase-6a1-gem-foundation.md` §3
(delivery archetypes); Decisions 42, 50, 70.

---

## Table of contents

1. [The four mechanisms](#1-the-four-mechanisms)
2. [RESOLVE, as `ClearOptions`](#2-resolve-as-clearoptions)
3. [Projectile behaviour flags](#3-projectile-behaviour-flags)
4. [Deferred emissions, and the weapon registry](#4-deferred-emissions-and-the-weapon-registry)
5. [Emission multiplication, and its cap](#5-emission-multiplication-and-its-cap)
6. [The fourteen gems, by archetype](#6-the-fourteen-gems-by-archetype)
7. [What archetype legality gives us for free](#7-what-archetype-legality-gives-us-for-free)
8. [The bundle card](#8-the-bundle-card)
9. [Modules touched](#9-modules-touched)
10. [Tests](#10-tests)
11. [Order of work](#11-order-of-work)
12. [Risks](#12-risks)

---

## 1. The four mechanisms

Every one of the fourteen gems rides one of these. Building them is most
of the batch; the gems themselves are comparatively thin on top.

| # | Mechanism | Gems it carries | Status before this batch |
|---|---|---|---|
| **1** | **RESOLVE**, as `ClearOptions` fields (§2) | Splash, Overflow, Kickback, Priming | Deferred in 5A — *"no gem yet needs a uniform hook there"* |
| **2** | **Projectile behaviour flags** (§3) | Pierce, Fork, Chaining, Bounce, Homing, Ricochet | Doesn't exist; `updateProjectiles` is a `p.type` switch |
| **3** | **Deferred emissions + a weapon registry** (§4) | Echo, Barrage | Doesn't exist; `main.ts` calls seven update functions by hand |
| **4** | **Emission multiplication** (§5) | Multishot, Formation | Stage 3, the only two the plan's §4 table got right |

**Mechanism 3 is load-bearing far beyond this batch.** A registry that
can invoke any weapon's `deliver` by key is precisely what **Trigger**
needs in 6I — *"this weapon deals no damage itself; on impact it fires
the weapon socketed below it"* — which the arsenal plan calls the single
most build-generating mechanic in the catalogue. Building it here, for
Echo, means Trigger is close to free later.

---

## 2. RESOLVE, as `ClearOptions`

**The stage does not become a pipeline function.** §4 states the one hard
constraint plainly:

> Everything still routes through `clearAt(state, x, y, power, opts)`.
> **Stage 4 may add new `ClearOptions`; it may not add a second damage
> path.**

`clearAt` is already the universal choke point every weapon reaches —
that is Decision 42's whole point and the reason eighteen weapons against
seven coagulant kinds was never a compatibility matrix. So RESOLVE is
implemented as **new `ClearOptions` fields**, built per call site from
the firing weapon's sockets:

```ts
export interface ClearOptions {
  radiusPx?: number;
  freezeDuration?: number;
  coagulantMult?: number;
  // 6A-2 — the RESOLVE stage (docs/plans/phase-6a2-behaviour-gems.md S2)
  splashBonusPx?: number;   // Splash
  overflow?: boolean;       // Overflow
  kickback?: number;        // Kickback — displacement impulse
  priming?: number;         // Priming — damage multiplier on a cold target
}
```

A `resolveOpts(state, weaponKey)` helper mirrors 6A-1's `weaponMods`,
walking that weapon's sockets once. Every existing `clearAt` call site
passes it, exactly as they already pass `coagulantMult`.

**Three implementation details that are easy to get wrong:**

**Overflow needs the excess before it is clamped away.** `clearAt`
currently computes `removeAmt = clamp(..., 0, c.mass)` — the overkill is
discarded inside the clamp. Overflow needs the unclamped value, so the
excess (`raw - c.mass`) is captured before clamping and re-applied to the
next-nearest coagulant. Deliberately **coagulant-to-coagulant only**: a
"next nearest" among grid cells is every adjacent cell, which is just a
bigger radius and therefore Splash wearing a different hat.

**Kickback establishes the displacement primitive.** Mutating a
coagulant's `x`/`y` is new. It conserves mass by construction, so Rule 2
and the conservation invariant guarding every phase since 3C need no
changes — but it needs the same care Repulsor (6F) and Inversion (6I)
will need: a displaced coagulant must stay inside the arena and must not
be shoved through the perimeter into a state its arrival logic doesn't
expect. **6F and 6I should reuse this, not reinvent it** — noted here
because §9½ scheduled Repulsor as the batch that *establishes*
displacement, and Kickback quietly gets there first.

**Priming is the expensive one, and it is the assist-credit shape.**
"First hit on a target not hit recently" requires per-target memory. For
coagulants that is trivial — a `lastHitAt` field on an entity list that
is rarely more than a dozen long. **For grid cells it is not**: a
`Float32Array` of last-hit times across 20,000+ cells, written on the
hottest loop in the game. That is precisely the cost that got assist
credit dropped in 5B (*"new state on both coagulants and grid cells,
touching the hottest paths"*). **Priming is therefore coagulant-only**,
and its card copy says so. If it needs to read on terrain later, that is
a measured decision with a profiler, not an assumption.

---

## 3. Projectile behaviour flags

Six gems are properties of a projectile **in flight**, which is outside
the four-stage model entirely — stages 1–3 are about *firing*, and these
are about what happens afterwards.

The fix is the pattern §9½ already praised for rendering: **the entity
carries its own behaviour**. A `Projectile` already carries
`color`/`radius`/`life` so the renderer needs no knowledge of which
weapon made it. It grows the same for behaviour:

```ts
// state.ts, on Projectile
src: WeaponKey;        // which weapon fired it — needed to build resolveOpts at impact
pierce?: number;       // pass-throughs remaining
forks?: number;        // splits remaining, spent on first impact
chains?: number;       // arcs remaining after resolving
bounces?: number;      // coagulant-to-coagulant ricochets remaining
homing?: boolean;      // steer toward target each tick
ricochet?: boolean;    // reverse along the path once, damaging again
```

`updateProjectiles` generalises out of its `p.type === 'chain'` branch.
**Chain's existing machinery is the template, not an obstacle** — it
already has `hopsLeft`, `visited` and `legStart`, which is exactly
`chains` plus its bookkeeping. §9B says Chaining *"makes Chain's identity
universal"*; concretely, this batch promotes Chain's private
implementation into the shared one and Chain becomes a weapon that ships
with `chains` preset.

**`src` is a genuine addition, not cosmetic.** Today `p.type` doubles as
the weapon key for `WEAPON_DEFS[p.type]?.coagulantMult`. Once Fork spawns
children and Trigger (6I) fires one weapon from another's impact point,
"what kind of projectile is this" and "which weapon's gems apply to it"
stop being the same question.

---

## 4. Deferred emissions, and the weapon registry

Echo (*"fires again shortly after at reduced power"*) and Barrage
(*"one big shot becomes a rapid burst of small ones"*) both need a
weapon's `deliver` to run **later than the tick that decided to fire**.
Nothing in the codebase can do that.

```ts
// state.ts
pendingEmissions: {
  weapon: WeaponKey;
  at: number;              // state.time when it fires
  lvl: number;
  target: { x: number; y: number } | null;
  powerMult: number;       // Echo's reduction, Barrage's 1/k
}[];
```

Drained each tick in the simulation pass — never in a draw call, per the
rule three prototype bugs came from breaking (Decisions 4 and 7).

**This forces a weapon registry, and that is a good thing.** Firing a
deferred emission means calling *that weapon's* `deliver` by key, but
pipelines are module-level constants inside seven separate files and
`main.ts` invokes seven `updateXWeapon` functions by hand:

```ts
// weapons/registry.ts (new)
export const WEAPON_PIPELINES: Record<WeaponKey, WeaponPipeline>;
```

`main.ts` collapses to one loop over the equipped deck. At seven weapons
this is tidier; at eighteen the current shape is untenable; and for
Trigger in 6I it is mandatory. **A registry also removes a whole class of
6C-era bug** — a new weapon that is built, tested, and never wired into
`main.ts`, which is exactly the shape of the four-unreachable-weapons
finding this project just had.

---

## 5. Emission multiplication, and its cap

Multishot and Formation are the two genuine stage-3 gems: they change how
many emissions a `deliver` produces and where they go. Implemented as a
wrapper around `deliver` that calls it N times with transformed target
points — no weapon knows it is happening.

**The combinatorics need a guard.** Multishot (+2), Barrage (k=4) and
Echo (×2) multiply: 3 × 4 × 2 = **24 emissions per fire**, and Bolt at a
0.16s cooldown fires ~6 times a second. That is ~150 projectiles a
second from one weapon — a frame-time problem and, in a game whose armor
model is flat per-hit reduction (Decision 44), a balance one too.

**A documented per-fire emission cap** (`MAX_EMISSIONS_PER_FIRE`,
starting at 16) clamps it. Not silently: the cap is a tuning constant in
one place, and the interaction it guards is exactly the kind of
emergent-build fun the owner asked for — *"gems that change how the
attack works at the core is very fun and inspires many builds we cannot
even think of now."* The cap exists so that fun does not arrive as a
5fps stretch, which this project has already had one playtest ruined by
(the 3C gate, Decisions 58–59).

---

## 6. The fourteen gems, by archetype

Per the owner's 2026-08-09 call, each gem is **reinterpreted per delivery
archetype where a reading exists**, and refuses where one genuinely does
not (`docs/plans/phase-6a1-gem-foundation.md` §3). ✗ = not offered for
that archetype, never socketable, never a dead card.

### Universal — one implementation, all five archetypes

| Gem | Reading |
|---|---|
| **Echo** | The emission repeats once after a short delay at reduced power. Identical on every archetype. |
| **Barrage** | One emission of power P becomes k emissions of P/k over a short window. Identical everywhere — and its *"deliberately a trap against armor"* property (§9B) holds universally, since armor is flat per-hit reduction. |
| **Overflow** | Overkill damage on a coagulant carries to the next nearest instead of being wasted. RESOLVE. |
| **Kickback** | Every hit displaces the target slightly. RESOLVE. |
| **Priming** | The first hit on a coagulant not hit recently deals far more. RESOLVE, coagulant-only (§2). |

### Archetype-specific

**Revised 2026-08-09 after the owner pushed back on the refusals:**
*"revisit the pierce bounce and ricochet gems and think what they could
do if slotted in a non-projectile weapon. You have to be creative and not
just not give the player gems."*

They were right, and the first draft was lazy. It refused 23 of 70 cells
— three gems (Pierce, Bounce, Ricochet) were projectile-only, which for a
Frost / Poison / Immolation deck meant three cards that simply never
exist. **The revised matrix has no refusals at all.**

The discipline that makes this design rather than padding: **every
reading must be mechanically distinct from an existing gem.** A
reinterpretation that collapses into Expansion or Multishot is not a gem,
it is a duplicate wearing a different name — and a pool with two cards
that do the same thing is the *"cards appear to do nothing"* finding in a
new costume. Each cell below states a distinct mechanism.

**The key move was finding each archetype's true analogue of "what stops
you."** For a projectile it is despawning on impact. For an orbital it is
the per-blade hit cooldown. For the three area archetypes it is
`clearAt`'s own `resistance = clamp(1.3 - dens, 0.12, 1.3)` — **density
itself blunts every area hit**, and that is the thing an area weapon
"pierces."

| Gem | `projectile` | `orbital` | `pulse` | `cloud` | `ring` |
|---|---|---|---|---|---|
| **Pierce** *(ignore what blunts you)* | passes through targets instead of despawning | **no per-blade hit cooldown** — never stopped by what it cuts | **ignores the density-resistance curve** — full power into thick tissue | ignores density resistance | ignores density resistance |
| **Bounce** *(re-emit from what you hit)* | ricochets between coagulants | on hit, the blade **jumps to a different orbit radius** | each coagulant hit becomes the origin of a **smaller secondary pulse** | on expiry the cloud **relocates onto the nearest coagulant** instead of dissipating | each coagulant crossing the ring **spawns a small burst at it** |
| **Ricochet** *(a second pass back the way you came)* | reverses along its path, damaging again | blades periodically **reverse orbit direction**, re-sweeping covered ground | expands out, then **contracts back inward**, damaging on the return | on expiry **drifts back toward the core**, damaging along the way | **sweeps outward past its radius and back**, one out-and-back per cycle |
| **Splash** *(the edge hits as hard as the centre)* | + impact radius on a point hit | blade hits gain a small AoE | **flattens the distance falloff** so the rim lands near full power | flattens falloff | flattens falloff |
| **Homing** *(bias toward the threat)* | steers toward its target | blades **cluster on the threatened side** instead of spreading evenly | the pulse's **centre offsets** toward the densest threat rather than sitting on the tower | the cloud drifts toward the nearest mass | the ring's centre offsets toward the densest threat |
| **Chaining** *(reach onward past your own limit)* | arcs to a nearby target after resolving | a hit arcs to a nearby target | arcs from the **outermost thing hit to something beyond the radius** | seeds a smaller cloud on a nearby target at expiry | arcs outward past the ring to a target beyond it |
| **Fork** *(one becomes two)* | splits into 2 children on first impact | a hit sheds a small projectile | a **kill** splits the pulse into two lobes that continue past it | the cloud splits in two on expiry | a kill splits off a second short-lived ring |
| **Multishot** | N projectiles in an angular spread | +N blades | N smaller pulses offset around the tower | N smaller clouds around the point | N concentric rings |
| **Formation** | N emissions in a ring / line / arc at the target rather than converging | blades lock to a fixed arc instead of spreading evenly | pulses arrange at a fixed radius | clouds in a fixed pattern | the ring becomes **hot arc segments rather than a full circle** — same damage, concentrated |

**Three of these are worth calling out as more than filler.**

**Pierce on an area weapon answers a named design gap.** §3 of the
arsenal plan lists *"nothing scales up against density"* as the structural
hole that *"matters most"* — every weapon in the game is worse against a
wall, because `resistance` blunts the hit exactly where tissue is
thickest. A Pierce that ignores that curve is a partial answer to the gap
Resonance Coil (6F) exists to solve, arriving early and as a gem. It is
probably the strongest reading in the table and the one to watch in play.

**Bounce on a pulse is a chain reaction**, and the roster has wanted one
since Blastoma shipped — §10's fantasy of splitting masses cascading is
implied by the coagulant roster and delivered by nothing. A Frost Nova
where every blob hit re-pulses is that, out of one card.

**Homing on an orbital fixes a real weakness rather than adding a
number.** Blades spread evenly around the tower, so most of them are
always on the wrong side of the arena. Clustering them toward the threat
is the difference between 5 blades and 5 *useful* blades, and it is
invisible on a stat line — exactly the kind of thing a support gem should
do.

**On Bounce and Chaining overlapping:** both send a hit onward, and §9B
ships both deliberately. The distinction is kept mechanical across every
archetype — **Bounce re-emits from the thing it hit** (a new emission
originating there), **Chaining reaches past its own limit to something
new** (an arc to a target it could not otherwise touch). If they read as
the same card in play, that is a finding for the gate, not something to
pre-emptively merge.

**Fork on pulse/ring is the weakest cell in the table**, and is marked
rather than hidden: gating on a *kill* makes it distinct from Bounce's
hit trigger, but it will be rare and may read as doing nothing. It is the
first candidate to be re-cut if the gate says so.

### What filling the matrix costs

Honestly: **more than refusing did.** 70 live cells rather than 47. But
far less than 70 implementations, because the readings deliberately
collapse — "ignore the resistance curve" is **one** code path serving
three archetypes, as is "flatten the falloff", "offset the centre toward
threat", and "re-emit from what you hit". The real count is closer to 30
distinct mechanisms, several of which (falloff shaping, centre offset)
are single-line changes to `clearAt`'s existing math.

---

## 7. Pool dilution — a claim this batch retracts

**The first draft of this plan claimed archetype legality delivered a
partial deck-relevance filter for free.** That claim depended entirely on
Pierce, Bounce and Ricochet being projectile-only, so a Frost / Poison /
Immolation deck would never be offered them.

**Filling the matrix (§6) deletes that benefit, and the retraction is the
honest read.** With no refusals, every Behaviour gem is legal on every
weapon, so the pool is the same size for every deck and nothing is
filtered by anything.

That is a real cost of the owner's call, and it is worth stating rather
than burying: **the argument for filling the matrix is that a player
should never be handed a dead card or silently denied a gem, not that it
helps dilution.** It doesn't. It makes dilution slightly worse, because
every gem is now live for every build.

**So the position reverts to what §11 and §14 already recorded:**
dilution ships unmitigated and deliberately, all three available fixes
were declined in favour of measuring the real number, and **the gate is a
genuine go/no-go on the 65-gem count.** Nothing in this batch improves
that, and a good gate result must not be credited to a filter that does
not exist.

If the gate does say the pool is too dilute, §11's shelf is unchanged
and archetype data is still useful for it — a *relevance weighting*
(favouring gems whose best readings match the deck) is cheaper to build
now that every weapon declares an archetype, even though legality itself
no longer filters anything.

---

## 8. The bundle card

Deferred here from 6A-1 (which has only six gems — a package of
"Amplifier + Overclock" teaches nothing a single card doesn't). With
twenty gems plus extensions, packages become real.

**Per §11's sketch:** every N levels the normal draw is replaced by a
bundle draw — three *packages* instead of four cards, each holding 2–3
related cards, take one whole package.

**N starts at 5**, flagged as one of §12's six open measurement items
(*"what N is, for the bundle card"* — a pacing number to tune against a
real level curve, not an argument to settle on paper).

**Packages are thematic**, mirroring the meta layer's gem bundles (§10)
so a themed group arriving together is one idea the player meets in two
places rather than two ideas. Early examples the 6A roster can actually
form: *Ballistics* (Multishot · Pierce · Velocity), *Cascade* (Chaining ·
Fork · Bounce), *Overdrive* (Overclock · Barrage · Echo).

**A package is only offered if every card in it is legally usable** —
§11's no-dead-card rule, applied at package granularity. A *Ballistics*
package is never offered to a deck with no projectile weapon.

---

## 9. Modules touched

| Module | Change |
|---|---|
| **`grid/clear.ts`** | Four RESOLVE `ClearOptions`; overflow's pre-clamp excess; kickback displacement; priming's cold-target multiplier. **Plus three shared knobs the §6 matrix needs**: a resistance bypass (Pierce), falloff shaping (Splash), and a centre offset (Homing) — each one path serving three archetypes. |
| **`systems/resolveOpts.ts`** | **New.** Builds `ClearOptions` from a weapon's sockets — `weaponMods`' sibling. |
| **`weapons/registry.ts`** | **New.** `WEAPON_PIPELINES`, keyed by `WeaponKey`. |
| **`weapons/emissions.ts`** | **New.** Multishot/Formation target transforms, the deferred-emission queue drain, `MAX_EMISSIONS_PER_FIRE`. |
| **`systems/projectiles.ts`** | Generalised off `p.type`; the six behaviour flags; Chain's private hop machinery promoted to shared. |
| **`systems/clouds.ts`** | Cloud archetype readings — Fork's split, Chaining's seed, Homing's drift. |
| **`systems/coagulants.ts`** | `lastHitAt` for Priming; displacement clamping for Kickback. |
| **`state.ts`** | `Projectile.src` + six flags; `pendingEmissions`; `Coagulant.lastHitAt`. |
| **`tuning/gems.ts`** | The fourteen Behaviour gems with per-archetype readings and copy. |
| **`tuning/bundles.ts`** | **New.** Package definitions and N. |
| **`systems/cards.ts`** | The bundle draw, replacing a normal draw every N levels. |
| **`main.ts`** | Seven hand-written weapon calls collapse to one loop over the registry. |
| **`render/novaFx.ts`**, **`render/orbitals.ts`** | **Data, not new renderers** — see §9a. A contracting pulse (Ricochet) and an oscillating ring (Bounce) need `NovaFx` to carry a radius *curve* rather than a fixed radius; blades jumping orbit need per-orbital radius, which `OrbitalVisual` already has since 5B-6. |

### 9a · Visual cost, recounted

§9½ classified this batch as **11 free / 3 modifier / 0 new** — and that
count was made against gems read as projectile-only. **The §6 matrix
changes it**, and pretending otherwise would repeat exactly the estimating
mistake §2 of the 6A-1 plan documents.

**No new renderers are needed** — that part holds, and it holds for the
reason §9½ gave: the render layer is entity-driven, so three projectiles
instead of one draws free, and 5B-6 already made `novaFx` a list and gave
`OrbitalVisual` its own appearance data.

**But several readings move from *free* to *modifier*.** A pulse that
contracts inward, a ring whose radius sweeps out and back, blades that
cluster toward a threat — these render through existing code, but that
code currently assumes a pulse only ever expands and an orbital is evenly
spaced. The work is **driving existing renderers from richer entity
data**, which is the "shared modifier treatment, built once, applied
generically" tier §9½ defines, not new rendering.

Revised estimate: **~6 free / ~8 modifier / 0 new.** Larger than §9½'s
count, still the cheapest tier of visual work in Phase 6, and it does not
change the batch order.

---

## 10. Tests

| Test | Invariant |
|---|---|
| **Mass conservation survives Kickback** | The invariant guarding every phase since 3C. Displacement moves mass; it must never create or destroy it. |
| **A displaced coagulant stays inside the arena** | And stays in a state its arrival logic accepts. |
| **Overflow conserves damage** | Excess applied to the next target equals excess withheld from the first — never a net damage increase. |
| **Overflow terminates** | A chain of overkills cannot loop forever on two mutually-adjacent coagulants. |
| **Emissions never exceed `MAX_EMISSIONS_PER_FIRE`** | Over the worst legal stack (Multishot × Barrage × Echo). |
| **`pendingEmissions` drains** | No emission is ever orphaned by a run ending, a weapon being unsocketed, or the queue outliving its weapon. |
| **Every weapon in `WEAPON_DEFS` is in `WEAPON_PIPELINES`** | Structurally prevents the "built but never wired in" failure this project just had. |
| **Priming reads coagulants only** | Guards the deliberate scope limit against a later well-meaning extension to grid cells. |
| **Every gem has a reading for every archetype** | §6 has no refusals — enumerated over `GEM_DEFS × DeliveryKind`, so a gem added later without a full set of readings fails loudly rather than silently becoming unofferable. |
| **A bundle is never offered with an unusable card in it** | §8's package-granularity no-dead-card rule. |
| **Chain still behaves identically after its machinery is shared** | Its 23 pre-existing weapon tests should pass unmodified — the same bar 5A held itself to. |

---

## 11. Order of work

| # | Step | Done when |
|---|---|---|
| 1 | `weapons/registry.ts`; `main.ts` collapses to one loop. | Zero behaviour change; all tests pass untouched. |
| 2 | `Projectile.src` + `resolveOpts`, wired through every existing `clearAt` call. | Zero behaviour change — every new option defaults neutral. |
| 3 | RESOLVE's four options in `clearAt`, with Splash / Overflow / Kickback / Priming as their first callers. | Four gems live and testable. |
| 4 | Projectile flags; `updateProjectiles` generalised; Chain's machinery promoted. | Chain's own tests pass unmodified; six gems live. |
| 5 | Deferred emissions + the queue drain. | Echo and Barrage live. |
| 6 | Emission multiplication + the cap. | Multishot and Formation live; the cap holds under the worst stack. |
| 7 | The bundle card. | Packages draw every N levels, legality-filtered. |
| 8 | **Verify live** — a projectile-heavy deck stacking Multishot/Fork/Chaining; a Frost/Poison/Immolation deck confirming the projectile-only gems are never offered; Kickback visibly shoving a behemoth; Overflow finishing a second blob; the emission cap under a deliberate worst-case stack. | Zero console errors; typecheck and build clean; frame time sane under the stack. |

**Steps 1 and 2 are deliberately zero-behaviour-change**, following 5A's
precedent exactly: move the architecture first, verify nothing moved,
*then* add content on top of a structure already proven inert.

---

## 12. Risks

**1. This is the largest single batch since 3C**, and 3C needed its own
playtest-and-fix round. Four new mechanisms and fourteen gems is a lot of
surface. The mitigation is step order — the two structural steps land
first and are provably inert — but expect a fix round after step 8 rather
than treating the batch as done when it typechecks.

**2. Emission stacking is a performance risk with a real precedent.** The
3C gate lost a playtest to a 5–10fps stretch, and the investigation
(Decision 59) took most of a session. `MAX_EMISSIONS_PER_FIRE` is the
guard, but the honest position is that the cap's *value* is a guess until
someone stacks Multishot on a 0.16s-cooldown Bolt and watches the frame
time.

**3. Priming is one well-meaning refactor away from being expensive.**
Coagulant-only is a deliberate scope limit with a test guarding it, but
the reason is in this document rather than in the reader's head. Anyone
extending it to grid cells is rebuilding the cost that killed assist
credit.

**4. Chain's promotion could break Chain.** Its machinery becomes shared
code with more callers and more configurations. Its existing tests are
outcome tests (5A verified this), so they should hold — but Chain is a
starting-kit weapon, so a regression here is a regression in most runs.

**5. Overflow and Bounce can both chain between coagulants**, and a
badly-specified pair could loop. Both need explicit termination —
Overflow by a visited set and a decreasing budget, Bounce by its counter.
Tested for, not assumed.

**6. Fourteen gems is fourteen descriptions across five archetypes.**
The *"cards appear to do nothing"* finding in this project's own history
was a **description** bug, not a mechanics bug. 6A-1's test enumerating
`GEM_DEFS × DeliveryKind` for missing copy extends to cover these, and it
matters more here — "Fork on Caustic Cloud" needs a sentence that is
actually true of what happens.

---

## What changed during implementation

Built as planned — all four mechanisms, all 14 gems, and the bundle card
shipped as designed. One real bug found, one deliberate scope narrowing
beyond what §7 anticipated:

**`spawnForks()` had an array-mutation bug the plan's design didn't
anticipate.** It pushed forked children directly onto `state.projectiles`
while `updateProjectiles` was still mid-iteration over that same array
via `for...of` — since the function ends by reassigning
`state.projectiles = remaining`, every forked child was silently
discarded the instant it was created. Caught by the test suite before
ever reaching the browser, exactly the outcome Decision 20's "guard bugs
with tests" convention exists to produce. Fixed by changing the
signature to `spawnForks(p): Projectile[]`, returning children for the
caller to `remaining.push(...spawnForks(p))` instead of mutating the live
array mid-loop.

**Fork/Chaining/Bounce/Ricochet's cross-archetype reach is narrower than
§6/§7 imply, and this is disclosed rather than silently shipped.** §7's
"what archetype legality gives us for free" table implies these four are
equally real everywhere they're legal. In practice their deeper "hits
another target" behaviour only exists where `updateProjectiles` already
has per-target impact resolution — the `projectile` archetype. Extending
it further would need `clearAt` to report per-target hit/kill events back
to its caller, a real architectural change out of scope for this batch.
Recorded in `docs/BACKLOG.md` rather than left as an unstated gap.

**Homing and Multishot/Formation were deliberately not wired for
Immolation Ring**, added as a scope decision during implementation once
the ring's persistent visual existed to reason about (see 6A-1's as-built
note) — both mechanics assume a discrete per-shot origin, and wiring
either would desync the ring's fixed-radius visual from its actual hit
logic. Documented in `weapons/immolation.ts` and `docs/BACKLOG.md`, not a
silent omission.

Live verification hit the same Browser-pane compositing constraint noted
in 6A-1's as-built section, worked around the same way (temporary debug
harness, removed with a byte-identical bundle hash). 495/495 tests
(combined final count with 6A-1 — 45 test files, 6 new:
`weaponMods.test.ts`, `gemSockets.test.ts`, `resolveOpts.test.ts`,
`emissions.test.ts`, `registry.test.ts`, plus extensive extensions to
existing suites), typecheck clean, build clean. **Committed and pushed
alongside 6A-1** — see DECISIONS.md #75.

---

*Planned 2026-08-09, shipped 2026-08-09. §6's archetype matrix was the
design as planned; the owner's three 6A calls (split, reinterpret-per-
archetype, compensate on values) settled everything this batch needed.
DECISIONS.md #75 records the shipped decision.*
