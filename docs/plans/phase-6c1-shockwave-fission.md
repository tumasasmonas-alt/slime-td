# Phase 6C-1 — Shockwave, Fission Charge, and `ClearOptions.shape`

**Status:** 🟢 **Planned, 2026-08-10. Not greenlit to build.**
The umbrella plan's four questions are settled (see
`docs/plans/phase-6c-lance-shockwave-fission.md` §8); this document is
the buildable half of the first batch.

**Parent:** `docs/plans/phase-6c-lance-shockwave-fission.md` — read its
§2 findings first; they are not repeated here.
**Sibling:** `docs/plans/phase-6c2-lance.md` (6C-2).

**What ships:** two weapons (Shockwave, Fission Charge), eight
extensions, and one framework change (`ClearOptions.shape`) that 6C-2
then reuses.

---

## Table of contents

1. [Why these two together](#1-why-these-two-together)
2. [Shockwave](#2-shockwave)
3. [`ClearOptions.shape` — the one framework change](#3-clearoptionsshape--the-one-framework-change)
4. [Fission Charge](#4-fission-charge)
5. [The eight extensions](#5-the-eight-extensions)
6. [Bookkeeping — everything a new `WeaponKey` touches](#6-bookkeeping--everything-a-new-weaponkey-touches)
7. [Order of work](#7-order-of-work)
8. [Tests](#8-tests)
9. [Risks specific to this batch](#9-risks-specific-to-this-batch)

---

## 1. Why these two together

They are the batch's **control group**. Neither adds a `DeliveryKind`,
neither needs a new renderer vocabulary, and both reuse an existing
archetype wholesale — Shockwave as `'pulse'`, Fission as `'projectile'`.
If the Phase 5A pipeline bet paid off, these two cost a tuning table, a
pipeline object, a registry line and their tests. That measurement is
worth as much as the weapons.

The one thing they *do* force is `ClearOptions.shape` (§3), and that is
deliberate: it is forced here by the simpler consumer, and 6C-2's beam
inherits it already tested.

---

## 2. Shockwave

🌊 *expanding ring / self-centred outward / clear + displace.*
Arsenal §7.9. Attributes: **Power · Rate · Ring Reach** (three — it does
not earn a fourth; no count is core to it).

`delivery: 'pulse'` — **not a new archetype.** It is self-centred, it has
no travel-speed term a player would name, and every gem's existing pulse
reading already reads correctly against a ring. A seventh `DeliveryKind`
would buy nothing and cost twenty descriptions.

### 2.0 · Why a travelling ring and not a disc, a cone, or Frost

**Raised by the owner during review, 2026-08-10, and worth recording in
full** — the question was *"why would a shockwave do donut-shaped
damage? I feel like it would be a pulse from the core outwards that does
damage in a disc. But that's pretty much Immolation. So can we make it
into a cone maybe?"*

**The band is delivery, not effect.** The ring travels, so at any single
moment it can only damage the band it is currently crossing. Over the
ring's whole life those bands are contiguous, and the **net effect is
exactly the disc the owner described** — every cell from `perimeter` to
Ring Reach, hit once. The band exists only so the near field is not
re-hit on every tick. The owner's intuition about the outcome is
correct; the donut is an implementation of it.

**An instant disc would be redundant — with Frost, not Immolation.**
Immolation is a *thin ring at a fixed radius, permanently on*. Frost is
the instant disc pulse. So an instant-disc Shockwave would be "Frost with
more damage and no freeze," which is the redundancy the owner correctly
sensed, aimed one weapon over.

**The travel is the entire differentiator.** Damage arrives progressively
outward — visible as a moving wave, with the outer field hit ~1s after
the near field — and *Knockback* (§5) becomes a shove that travels
rather than a uniform push. That is a different object in play from
Frost's flash, not a re-skin.

**The cone was considered and declined, because it is already taken
twice.** Solvent Sprayer (arsenal §7.13) is *"sprayed cone / densest
nearby"* and Cauterizer (§7.12) is a sweeping arc beam — both 6E. A cone
Shockwave would consume Solvent's delivery shape a batch before Solvent
ships, and would add an aiming stage that §7.9 deliberately did without
(*"no targeting decision, no direction to be wrong about"*). **Settled:
keep the travelling ring.**

### 2.1 · The entity

The ring is a **persistent simulation entity**, not a decoration. This is
the correction to arsenal §9½'s "reuses the pulse renderer" claim
(umbrella Finding 2): `NovaFx` is a fixed-radius flash that fades in
place, and Shockwave's radius grows while damaging what it crosses.

```
ShockwaveRing {
  x, y            // the tower, captured at fire time
  radius          // current outer edge — advanced in the sim tick
  damagedTo       // outer edge as of the last damage pass
  maxRadius       // Ring Reach
  power
  color
  inward?         // Implosion (S5)
  opts            // baked RESOLVE options, same pattern as ProjectileBase
}
```

Two radii, not one, and that is the whole trick. **Damage is applied to
the band `[damagedTo, radius]`**, then `damagedTo = radius`. A disc at
the current radius would re-damage everything already swept, every tick —
a ring that hits the near field six times instead of once.

### 2.2 · Update, render, and the tick-rate mismatch

`SIM_TICK` is **0.18s**. At the proposed 260 px/s a ring advances ~47px
per sim tick — chunky enough that a ring rendered from the sim-advanced
radius would visibly stutter in six steps.

**So the two are decoupled, which is the project's standing convention
anyway** (CLAUDE.md: simulation on a fixed timestep, render independent):

- **Damage** — in the sim tick, over the band `[damagedTo, radius]`. Gaps
  are impossible because the bands are contiguous by construction.
- **Render** — radius computed continuously from `state.time - bornAt`,
  so the visual is smooth at any framerate while the damage stays
  tick-quantized.

`systems/shockwave.ts` owns the update; it is called from
`simulateTick()` in `systems/tick.ts`. The renderer is a stroked fading
circle — `render/novaFx.ts`'s existing visual vocabulary, which is the
half of §9½'s claim that *does* survive.

### 2.3 · The perimeter floor

A self-centred outward ring must respect `towerCenteredRadius()`. 6B-2
learned this the expensive way: every tower-centred radius floors at
`perimeter`, so a ring is only coherent travelling **outward from** that
floor — inward of it, it sweeps space nothing has ever occupied.

The ring therefore **starts at the floor** and expands to Ring Reach.
*Implosion* (§5) is the extension that inverts this, and it must stop
**at** the floor rather than at the tower. That is an outcome test, not a
comment.

### 2.4 · Tuning (first draft, per project convention)

```ts
shockwaveDamage(lvl)  = (12 + (lvl - 1) * 4.5) * WEAPON_DAMAGE_SCALE
shockwaveCooldown(lvl) = max(1.4, 3.2 - (lvl - 1) * 0.22)
SHOCKWAVE_REACH: TowerCenteredReach = { margin: 30, base: 150, perLevel: 18 }
shockwaveReach(lvl, perimeter) = towerCenteredRadius(SHOCKWAVE_REACH, lvl, perimeter)
SHOCKWAVE_SPEED = 260   // px/s
```

Numbers are a first draft like every other weapon's, and **balance is not
gradeable until Phase 8** — the question at this batch's playtest is *"is
it interesting"*, not *"is it competitive."*

### 2.5 · Pipeline

- **READY** — `cooldownReady('shockwave', shockwaveCooldown)`.
- **ACQUIRE** — none (self-centred, like Frost/Blades/Immolation).
- **DELIVER** — pushes a `ShockwaveRing`. **No damage happens here.**
  Reads `weaponMods()` for damage/rate/area, `resolveOpts()` for the
  baked RESOLVE options, and `emissionPlan()` for Multishot/Formation
  (which read naturally as extra rings, staggered).

---

## 3. `ClearOptions.shape` — the one framework change

**The batch's central architectural item.** Full reasoning in the
umbrella §5D; this is the build.

### 3.1 · What it is

`clearAt` damages a disc. Its inner loop already reduces every cell to
one number — `d`, distance from the hit centre. Making that
**distance-to-shape** covers the disc, Shockwave's annulus, and (in
6C-2) Lance's capsule, with every downstream concern shared and
untouched: falloff, resistance, maturity, scarring, the dirty set, the
coagulant loop, XP, DPS.

```ts
// ClearOptions
shape?:
  | { kind: 'annulus'; inner: number; outer: number }
  | { kind: 'capsule'; toX: number; toY: number }   // 6C-2
// absent => disc, exactly as today
```

### 3.2 · Why not just sample with many disc calls

This was raised properly during review — *"or do you think it's better to
make those weapons do damage in a different shape?"* — and checking it
honestly cost one of the three original arguments.

**⚠️ The performance argument was wrong, and is withdrawn.** This plan
originally claimed a radius-300 ring needed ~190 `clearAt` calls per sim
tick. Recomputed: at 260 px/s the band is ~47px thick, so the discs are
~23px radius, ~57 of them around the circumference, each scanning ~25
cells — roughly 1,400 cell visits per tick, ~8,000/second. **That is
nothing.** Cost was never a real objection and should not be cited as
one.

What actually remains:

1. **XP collapses to zero.** `gemValueFromRemoved()` is
   `Math.round(removed * 1.3)` with a `GEM_DROP_THRESHOLD` of 0.08 *per
   call*. Split one hit across N calls and each rounds toward zero.
   This is the umbrella's corrected Finding 7 — the failure runs toward
   under-crediting, not over-crediting, and it is **silent**.
2. **Seams give uneven damage.** Overlapping sample discs hit cells twice
   at partial strength where they overlap and once at full where they do
   not. Not a correctness bug — `clearAt`'s falloff already tapers, so
   overlap mostly smooths — but it is unevenness along the shape that no
   test would obviously catch.

**The cheaper alternative, considered and declined.** Problem 1 alone has
a much smaller fix than a shape system: add one flag to `clearAt`
meaning *"skip the XP/particle block, just return the mass."* The weapon
sums the returned values and credits once. That is a single conditional
around code that already exists, plus a value `clearAt` already returns —
near-zero risk to the seven shipped weapons, which never pass the flag.
It leaves problem 2 unsolved.

**Settled 2026-08-10: build the real shape system.** The owner's call,
taking the larger change over the cheaper one. The reasoning that
supports it: Cauterizer's sweeping arc beam (6E) is a third consumer
already in the catalogue, so the shape work is amortised across at least
three weapons rather than two, and "fake it with circles" would have to
be unwound at exactly the point the codebase is largest.

### 3.3 · The two traps, both named so they get tested

**Trap A — the bounding box.** Today's loop bounds come from a box
around a single cell. An annulus and a capsule each need their own box.
Getting it too small silently clips damage at the edges; too large just
wastes time. **Guard: an outcome test that a cell at the far end of the
shape is damaged.**

**Trap B — the density sample point.** Already documented in
`tuning/weaponGeometry.ts`: `clearAt` scales `radiusPx` by density
*sampled at the hit centre*. For a disc, fine. For a capsule originating
at the tower — where density is always near zero — it would silently
apply the maximum 1.25× widening along the entire beam. Sample at the
shape's **damage centroid** (mid-radius for an annulus, the target for a
capsule), and say so in a comment beside the code.

### 3.4 · Rollout — inside 6C-1, with the suite as the guard

**Settled 2026-08-10.** The change lands inside this batch rather than as
a separate playtested commit. **Step 1 of §7 is what makes that safe:**
the disc-only refactor ships and the full 589-test suite runs *before* a
second shape exists, so any regression to the seven shipped weapons
surfaces against a green baseline rather than tangled up with two new
weapons.

The alternative (ship the refactor alone, owner playtests, then build)
was offered and declined as not worth the extra round. The suite has
earned that trust — it caught both of 6B's real bugs before the browser
saw them (Decision 80).

### 3.5 · The non-negotiable constraint

**The disc path must behave identically to today.** Seven shipped weapons
and ~589 tests depend on it. `shape` absent means the current code path,
unchanged — not a re-derivation that happens to agree.

---

## 4. Fission Charge

🎇 *lobbed / scatter / clear, many hits over a wide area.* Arsenal §7.10.
Attributes: **Power · Rate · Submunitions · Blast Radius** — **four**,
one of the four weapons in §6 that earns one, because a count is core to
its identity.

`delivery: 'projectile'`. Being a plain projectile means Multishot,
Formation, Homing, Fork, Pierce, Chaining, Bounce and Ricochet all
already work on it. **Zero new gem wiring.**

### 4.1 · Nearly free, thanks to 6B-2

`spawnClusterSubmunitions()` (`systems/projectiles.ts`, built for
Missile's *Cluster Warhead*) is exactly the scatter primitive Fission
needs: a projectile that becomes N children distributed over an area.
Fission is that mechanic promoted from an extension to a weapon's whole
identity.

The call-site pattern 6B-2 landed on — **children spawned in
`updateProjectiles`, never pushed onto the array mid-iteration** — is
already correct and needs no change. That pattern exists because
`spawnForks()` originally pushed onto the array being iterated and every
forked projectile was silently discarded (Decision 75); it is not
optional style.

**Settled 2026-08-10: parameterize the shared function.**
`spawnClusterSubmunitions` was written for Missile's needs, with count
and scatter radius as constants. Fission needs them weapon-driven, and
the owner's call is **one scatter implementation with the values passed
in** rather than a second near-identical copy.

Missile's *Cluster Warhead* passes its current constants and must behave
**identically** — its existing tests are the guard, and they should be
run before and after the parameterization as a distinct step, not folded
into the batch's general test pass.

The alternative (leave Missile alone, write Fission its own) was
declined for the right reason: Mortar's *Airburst* (6E) would make it a
third copy, and the drift between three implementations of "scatter N
children over an area" is the kind of thing nobody notices until the
balance pass.

### 4.2 · Tuning (first draft)

```ts
fissionDamage(lvl)     = (9 + (lvl - 1) * 3.0) * WEAPON_DAMAGE_SCALE   // per submunition
fissionCount(lvl)      = min(3 + floor((lvl - 1) / 1.5), 9)            // the fourth attribute
fissionBlastRadius(lvl) = 34 + (lvl - 1) * 3
fissionScatter(lvl)    = 70 + (lvl - 1) * 4
fissionCooldown(lvl)   = max(1.1, 2.6 - (lvl - 1) * 0.17)
```

Per-submunition damage is deliberately low; the weapon's output is the
*count*, which is what makes levelling it read as "more bombs" — the
same principle §6 used to give Blades its Blade Count.

### 4.3 · Pipeline

- **READY** — `cooldownReady('fission', fissionCooldown)`.
- **ACQUIRE** — `frontierAcquire` (shared, nearest frontier).
- **DELIVER** — one lobbed projectile carrying `submunitions`,
  `scatterRadius` and its baked `resolveOpts()`. On arrival it bursts
  into children, each resolving as an ordinary AoE impact through the
  shared projectile path.

---

## 5. The eight extensions

Four per weapon (umbrella §8 Q2 — now the standing rule), each levelling
1→3 then leaving the card pool permanently. Every one is either a
`GemModDelta` folded into `weaponMods()` with zero new call sites (the
6B-1 pattern) or a single field on an entity that already exists.

### Shockwave

| Key | Name | What it does | Cost |
|---|---|---|---|
| `secondWave` | **Second Wave** | A second ring follows the first at reduced power. | One extra `ShockwaveRing` on a delay. Nothing new. |
| `knockback` | **Knockback** | Shoves coagulants outward as the ring passes. | **`ClearOptions.kickback` already exists** (the Kickback gem, 6A-2). This is that field at a larger value. |
| `resonantRing` | **Resonant Ring** | Damage scales with the density the ring crosses. | Reads density in the shape loop, scales power. Answers arsenal §3's *"nothing scales up against density"* gap. |
| `implosion` | **Implosion** | Travels inward from max reach instead of outward. | `inward` flag; **stops at `perimeter`**, never inside it (§2.3). |

> **Knockback is not the 6F displacement subsystem.** It reuses the
> shipped `kickback` field, which is the whole point of RESOLVE being the
> single damage path (Decision 42). Shockwave ships **zero** displacement
> code — worth stating plainly, because the arsenal plan lists Knockback
> under the same "nothing displaces" gap that 6F's Repulsor answers, and
> a reader could reasonably assume this batch owes that subsystem.

### Fission Charge

| Key | Name | What it does | Cost |
|---|---|---|---|
| `widerScatter` | **Wider Scatter** | Larger scatter area. | Pure `GemModDelta` (`area`). No code. |
| `chainFission` | **Chain Fission** | Submunitions split again. | One recursion-depth field, decremented per generation. **Must terminate by construction** — see §9. |
| `sticky` | **Sticky** | Submunitions land and burn. | A small `CausticCloud` per submunition, via `systems/clouds.ts`. Reuses a shipped entity entirely. |
| `focusedPattern` | **Focused Pattern** | Tight cluster — converts it to single-target. | Negative scatter mod. Arsenal §8 lists Fission + *Focused Pattern* as a single-target answer, so this is load-bearing content, not filler. |

**Key-collision check** *(umbrella Finding 4 — `ExtensionKey` is a flat,
globally unique union)*: all eight are clear of the 28 shipped keys.
`secondWave` is deliberately distinct from Immolation's shipped
`secondRing`; `knockback` does not collide with the Kickback **gem**,
which lives in a different union entirely.

---

## 6. Bookkeeping — everything a new `WeaponKey` touches

Listed exhaustively, because this is the batch that measures the cost.
**Two of these are compiler-enforced**, which is the protection
`registry.ts` was written to give after the unreachable-weapons finding:

| Where | What | Enforced? |
|---|---|---|
| `types.ts` | `WeaponKey` += `'shockwave' \| 'fission'` | — |
| `state.ts` | `freshState()`'s `weaponTimers` literal | ✅ total `Record` — fails to compile if missed |
| `weapons/registry.ts` | `WEAPON_PIPELINES` entries | ✅ total `Record` — fails to compile if missed |
| `tuning/weapons.ts` | curves + `WEAPON_DEFS` entries | ❌ `Partial<Record>` — **covered by a completeness test instead** |
| `tuning/extensions.ts` | 8 `ExtensionKey` members + `EXTENSION_DEFS` | ❌ — covered by the existing table test |
| `weapons/shockwave.ts`, `weapons/fission.ts` | the pipelines | — |
| `systems/shockwave.ts` | the ring update, called from `simulateTick` | — |
| `render/shockwave.ts` | stroked fading ring | — |
| `grid/clear.ts` | `ClearOptions.shape` (§3) | — |

**Nothing else.** Cards, sockets, gems, the inventory screen and the
pre-run select all pick the weapons up automatically —
`ui/weaponSelect.ts` iterates `Object.keys(WEAPON_DEFS)`,
`systems/cards.ts` iterates `EXTENSIONS_BY_WEAPON`, and `weaponMods()`
is weapon-agnostic. **If that holds in practice, it is the finding.**

**Side effect worth collecting for the gate:** this takes the roster to
nine weapons for three deck slots. The pre-run select becomes a real
question for the first time.

---

## 7. Order of work

1. **`ClearOptions.shape`**, disc-only refactor first — prove the seven
   shipped weapons and all existing tests still pass *before* adding a
   second shape. This is the step that protects §3.5.
2. Add the `annulus` shape + its bounding box + the centroid density
   sample. Test it directly, before any weapon uses it.
3. `types.ts`, `tuning/weapons.ts`, `state.ts`, `registry.ts` for both
   weapons — the compiler-enforced skeleton.
4. **Shockwave**: entity, `systems/shockwave.ts`, pipeline, renderer.
5. **Fission**: pipeline, plus whatever parameterization
   `spawnClusterSubmunitions` needs (§4.1).
6. The eight extensions.
7. Tests throughout, not at the end — 6B's two real bugs were both caught
   by writing the outcome test the plan called for.
8. Live browser verification.

---

## 8. Tests

Per CLAUDE.md: **test the invariant, not the mechanism** (Decision 20).

**`ClearOptions.shape`**
- Disc behaviour is unchanged — the existing suite passing *is* this
  test, which is why step 1 is its own step.
- Annulus: a cell inside the inner radius is **not** damaged.
- Annulus: a cell at the far edge of the band **is** damaged (Trap A).
- One XP credit per call, not per cell — the §3.2 rounding collapse, as
  an outcome.

**Shockwave**
- **A cell is damaged exactly once across the ring's whole life.** The
  §2.1 trap. Write this *before* the sweep, not after.
- A ring reaches Ring Reach and stops.
- `Implosion` stops **at** `perimeter`, never inside it (§2.3).
- Level 2 removes more than level 1.

**Fission**
- Submunitions land scattered, not all at one point.
- `fissionCount` rises with level and the weapon's total removal rises
  with it.
- `Chain Fission` **terminates** — a bounded total submunition count at
  max level, asserted as a number.
- `Sticky` leaves a cloud that damages after the projectile is gone.

**Per extension:** one outcome test each, eight total. That discipline is
what caught Chill Field's silent no-op and Shatter Core's inverted
multiplier in 6B-2.

**Completeness:** every `WeaponKey` has a `WEAPON_DEFS` entry, a
pipeline, and exactly four extensions.

---

## 9. Risks specific to this batch

**1. `ClearOptions.shape` touches the single hottest, most load-bearing
function in the game.** `clearAt` is the one damage path (Decision 42);
every weapon, gem and extension resolves through it. Mitigation is the
step-1-first ordering and §3.5's identical-disc-path constraint — but
this is the item to be careful with, and it is worth saying that a
regression here would look like "the game feels off," not like a failing
test.

**2. Chain Fission is a recursion, and recursions in this codebase have a
history.** `spawnForks` silently discarded its children (Decision 75);
Missile's Salvo nearly recursed infinitely through the deferred-emissions
queue in 6B-2 and had to be rebuilt around an `armAt` field instead. The
rule for Chain Fission: **bounded by a depth field decremented per
generation, terminating by construction**, with the bound asserted as a
number in a test — never by observation that it seemed to stop.

**3. Shockwave's band is the game's third damage shape** — neither
instant-at-a-point nor projectile-carried. Third shapes are where
assumptions hide. The once-only test is the guard.

**4. The ring's 47px-per-tick advance is coarse.** At `SIM_TICK` 0.18s
and 260 px/s, a fast coagulant could in principle cross a band between
damage passes. Rendering is decoupled and smooth (§2.2), so this is a
simulation-fidelity question, not a visual one — and it may simply not
matter at coagulant speeds. **Flagged rather than pre-solved**; if the
playtest shows rings passing through things, the fix is a lower speed or
a sub-stepped band, both cheap.

**5. Shockwave and Frost occupy overlapping space, and a player may not
read them as different.** Both are self-centred pulses on a cooldown
(Frost reach ~115, Shockwave ~150). **Raised with the owner and settled
2026-08-10: ship as planned and judge it at the playtest.** The reasoning:
the travelling wave reads visibly differently from an instant flash
(§2.0), and Frost's identity is freeze-and-Shatter setup rather than
damage. If they still feel redundant in play, that is a tuning fix
(push Shockwave's reach and speed further out), not a design one.

*A third option was floated and declined — making density-scaling core to
Shockwave rather than leaving it on the Resonant Ring extension. That
would have collided with **Resonance Coil** (arsenal §7.14), whose entire
identity is damage scaling with density. Recorded so it is not
re-proposed.*

**6. Two weapons at once means a bad measurement is ambiguous.** If this
batch costs far more than expected, it will not be immediately obvious
whether the pipeline is expensive or `ClearOptions.shape` was
mispriced. Partial mitigation: step 1–2 land the shape work *before*
either weapon, so its cost is separately visible in the commit history.

---

*Written 2026-08-10. Planned, not greenlit. Sibling:
`docs/plans/phase-6c2-lance.md`. Umbrella:
`docs/plans/phase-6c-lance-shockwave-fission.md`.*
