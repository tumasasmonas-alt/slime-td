# Phase 6C-2 — Lance, and the `'beam'` archetype

**Status:** 🟢 **Planned, 2026-08-10. Not greenlit to build.**
**Depends on 6C-1** — `ClearOptions.shape` (`phase-6c1-shockwave-fission.md`
§3) must exist before the beam does. This batch adds one shape to it; it
does not build it.

**Parent:** `docs/plans/phase-6c-lance-shockwave-fission.md`.
**Sibling:** `docs/plans/phase-6c1-shockwave-fission.md` (6C-1).

**What ships:** one weapon, one new `DeliveryKind`, one new acquire
stage, one new renderer, four extensions. **Every genuinely new mechanism
in Phase 6C is in this document** — which is exactly why the owner split
it out (umbrella §8 Q3).

---

## Table of contents

1. [What Lance is for](#1-what-lance-is-for)
2. [The `'beam'` archetype](#2-the-beam-archetype)
3. [Acquire — highest mass, not nearest](#3-acquire--highest-mass-not-nearest)
4. [Deliver — the capsule sweep](#4-deliver--the-capsule-sweep)
5. [The charge, and why it is not polish](#5-the-charge-and-why-it-is-not-polish)
6. [The four extensions](#6-the-four-extensions)
7. [Bookkeeping](#7-bookkeeping)
8. [Order of work](#8-order-of-work)
9. [Tests](#9-tests)
10. [Risks specific to this batch](#10-risks-specific-to-this-batch)

---

## 1. What Lance is for

🔆 *charged beam / highest-mass target / clear, pierces the line.*
Arsenal §7.7. Attributes: **Power · Charge Rate · Beam Width** (three).

**The single-target answer the game does not have.** It charges for
1.5–3s, then fires one enormous piercing beam at the biggest coagulant in
range, damaging everything along the line.

Two design properties fall out for free and need no code:

- **Armour is nearly irrelevant to it.** Decision 44's flat reduction
  takes armour 20 off a power-400 beam — noise. That is the entire
  justification for the weapon (arsenal §7.7 revived the parked
  Scalpel/Lance specifically because armour now exists), and it is
  automatic: `effectivePower = max(power - armor, power * FLOOR)` already
  behaves this way at high power.
- **It answers Behemoth, Sclerotic and Bulwark** (arsenal §8) — the last
  because it punches *through* the wall into what the wall escorts, which
  is what "pierces the line" means mechanically.

It also **establishes beam rendering**, which Cauterizer reuses in 6E.

---

## 2. The `'beam'` archetype

`DeliveryKind` gains a sixth value. The naive cost is 20 shipped gems × 1
new archetype; the actual cost, read off `tuning/gems.ts`, is about
**six decisions** (umbrella Finding 5):

- All 14 Behaviour gems have `supports: ALWAYS` (the owner's no-refusals
  call, 6A-2) and most `desc`s are archetype-blind.
- Of the 6 Amplifier gems, four are `ALWAYS`.
- The `desc`s that branch, branch on `orbital` — adding beam rewrites
  none of them.

**This is the Phase 5A pipeline bet paying off, and it should be measured
and reported at the gate**, not just enjoyed.

### 2.1 · The two legality calls, both settled

**Velocity — refused.** A beam is instantaneous; there is no travel speed
to raise. Beam joins `pulse`/`cloud`/`ring` in its refusal set.

**Extension — allowed, with a reading of its own** (umbrella §8 Q4, the
owner's call, against this plan's original recommendation to refuse).
Beam gets a real duration term independent of any extension: **the beam
line stays hot briefly and resolves a second time at reduced power**, and
Extension lengthens that window.

Why this is better than refusing: it removes the only hole in the
Amplifier table, and it stops *Afterglow* — a **lingering-line**
extension — from sitting next to a gem the game insists beams cannot
have. It also demotes Afterglow from "the sole thing that makes a gem
live" to "much more of what the beam already does," which is a strictly
better card.

**Cost:** one `lingerFor` field, one re-resolve of the sweep that already
exists, and Extension's existing `duration` mod scaling the window. One
field and one branch — not a system.

### 2.2 · Behaviour gems on a beam

Following 6A-2's precedent of stating scope honestly rather than
silently shipping or silently refusing: the gems built on RESOLVE
(Splash, Overflow, Kickback, Priming, Pierce) and on firing-time logic
(Multishot, Formation, Echo, Barrage, Homing) are **real** on beam,
because `clearAt` and the emission queue are archetype-agnostic. Fork,
Chaining, Bounce and Ricochet remain projectile-only — unchanged from
6A-2, and their beam descriptions should be written as honest intent, the
same way their orbital/pulse/cloud/ring readings already are.

---

## 3. Acquire — highest mass, not nearest

`nearestFrontierPoint()` is nearest-wins by design (Decision 45) and
`findNearbyRevealedPoint()` is a local box search. **Neither answers
"which coagulant is biggest."**

New export in `systems/targeting.ts`:

```ts
highestMassPoint(state, maxRange): FrontierPoint | null
```

Walks `state.coagulants` for maximum `mass` within range, skipping
`phase === 'forming'` exactly as `nearestFrontierPoint` does — a coagulant
that has not detached from the field is not a target.

**The fallback matters more than the search.** An early run has no
coagulants at all. A weapon that does nothing for the first ninety
seconds is the *"cards appear to do nothing"* failure from the 2026-08-05
playtest wearing a new costume. So: **fall back to
`nearestFrontierPoint()`** when no coagulant qualifies, and test that
fallback explicitly.

**This is also precisely the acquire stage Threat Priority (6D) will
replace wholesale**, which is a quiet argument for building it as a clean,
separately-testable function rather than inline in the pipeline.

---

## 4. Deliver — the capsule sweep

Lance damages *everything along a line*. `clearAt` damages a shape, as of
6C-1. This batch adds the third shape:

```ts
shape: { kind: 'capsule'; toX: number; toY: number }
```

The beam runs from the tower, through the target, and onward to max
range — "through," not "to," because piercing the line is the property
that distinguishes Lance from a large Bolt. Beam Width is the capsule's
radius.

**One `clearAt` call. One XP credit. No seams.** The alternative —
sampling with N disc calls — fails three ways, and the first is silent:
`gemValueFromRemoved()` is `Math.round(removed * 1.3)`, so splitting one
beam's removal across 30 samples rounds each toward **zero**. Lance would
be the highest-damage weapon in the game and grant almost no XP. Full
reasoning in `phase-6c1-shockwave-fission.md` §3.2; it is repeated here
only because Lance is the weapon where the failure would actually bite.

**The density-sample trap applies here most sharply** (6C-1 §3.3, Trap B).
`clearAt` scales `radiusPx` by density sampled at the hit centre. A
capsule originating at the tower samples near-zero density and would
silently apply the maximum 1.25× widening down the whole beam. Sample at
the **target**, not the origin.

### 4.1 · Tuning (first draft)

```ts
lanceDamage(lvl)      = (55 + (lvl - 1) * 22) * WEAPON_DAMAGE_SCALE
lanceChargeTime(lvl)  = max(1.2, 3.0 - (lvl - 1) * 0.22)   // divided by weaponMods().rate
lanceBeamWidth(lvl)   = 16 + (lvl - 1) * 1.6
LANCE_RANGE           = 520
LANCE_LINGER          = 0.35   // S2.1's own duration term, scaled by mods.duration
LANCE_LINGER_MULT     = 0.3    // the re-resolve's share of full power
```

High power, slow cycle — the burst profile the game lacks. Balance is not
gradeable until Phase 8; the playtest question is *"is it interesting."*

### 4.2 · Pipeline

- **READY** — **not** `cooldownReady`. Lance charges, and the charge must
  be *visible* (§5), so it owns a timer that the renderer can read as a
  fraction. Mechanically a cooldown; divided by `weaponMods().rate` like
  every other weapon, so Overclock reads as "charges faster."
- **ACQUIRE** — `highestMassPoint`, with the nearest-frontier fallback.
- **DELIVER** — one capsule `clearAt`, plus a `BeamFx` for the renderer,
  plus the linger re-resolve scheduled at `LANCE_LINGER`.

---

## 5. The charge, and why it is not polish

**A weapon that does nothing for three seconds and then fires reads as
broken.** This project has already shipped a fix for exactly this failure
class once: the coagulant `'forming'` phase exists because the Phase 3C
gate found formation was instant — *"a full-mass, full-speed, already-lethal
coagulant appearing with zero warning."*

Lance is that same problem inverted, and **the test suite cannot catch
it.** It is a feel bug, and feel bugs survive green suites.

### 5.1 · Three layers, settled 2026-08-10

This plan originally proposed **one** layer — the beam line brightening
along its target. The owner proposed two more (*"charge particles or an
increasing lance beam colour aura around the core"*), and the right
answer is all three, because each carries information the others cannot.

| Layer | Tells the player | Works when |
|---|---|---|
| **Core aura**, brightening in the beam's own colour | it is coming, and how soon | always |
| **Charge particles** | intensity, near release | always |
| **Faint beam line** to the acquired target | *where*, and that it is re-choosing | only when a target exists |

**Why the aura is load-bearing and not decoration.** The line-only
version this plan first proposed **breaks in the early run**. With no
coagulants on the field, `highestMassPoint` falls back to
nearest-frontier (§3), and there are stretches with nothing to draw a
line to — so a line-only tell leaves the weapon reading as *idle*
exactly when a new player is deciding whether it works. The aura is
always visible. It also teaches the beam's colour before the beam
first fires.

**Why the line is still required.** Lance's identity is that it targets
the **biggest** coagulant, not the nearest — the entire reason the weapon
exists (§1). The aura and the particles tell the player *when*; only the
line tells them *where*. Without it the player never sees the weapon
making its one interesting decision. And when a larger coagulant forms
mid-charge, **the line jumps to it** — the mechanic teaching itself, for
free.

> ⚠️ **Particle direction matters — do not drift them inward.** This game
> already uses *"particles drifting toward the core"* to mean **XP
> pickup**, and that idiom is load-bearing (CLAUDE.md: collectibles must
> always drift coreward). Inward charge particles would collide with it,
> and a player reading them as XP learns nothing about Lance. Keep them
> tight and orbital at the core, or spark them **outward** along the
> beam's direction.

> ⚠️ **The core is getting busy.** Immolation Ring already draws a
> persistent bright ring around the core (6A-2). A Lance aura sits in the
> same space, and a deck running both needs them to stay
> distinguishable — different colour, and the aura pulsing with charge
> rather than sitting steady like Immolation's ring. Worth a specific look
> during the browser check if both are equipped.

### 5.2 · The one implementation consequence

Drawing the line during the charge means **`highestMassPoint()` must run
every tick while charging**, not only at the moment of firing.

That is cheap (a walk over `state.coagulants`) but it is a real change to
how the pipeline's ACQUIRE stage is driven for this weapon:
`runWeaponPipeline` only calls `acquire` after `ready` returns true. Lance
therefore acquires **inside its own charge bookkeeping** and stores the
current target on state for the renderer to read, rather than relying on
the shared driver's once-per-fire acquire.

Doing it any other way — acquiring once at charge start and drawing that
— would make the tell **lie** whenever a bigger coagulant appears
mid-charge, which is precisely the case the player most needs to see.

**Budget a browser check specifically for all of this**, separately from
the batch's general verification. It is the one part of Lance a green
test suite cannot vouch for.

---

## 6. The four extensions

| Key | Name | What it does | Cost |
|---|---|---|---|
| `piercingCore` | **Piercing Core** | Ignores armour entirely, up to a cap. | Reuses `ClearOptions.ignoreResistance`'s neighbourhood; the cap keeps armour answerable rather than irrelevant (arsenal §12.3, the rule that bounds Penetration). |
| `twinLance` | **Twin Lance** | Two beams at reduced power, at slightly diverging angles. | Two capsule calls. Nothing new. |
| `afterglow` | **Afterglow** | The line stays hot as a DoT. | Extends §2.1's base linger window and adds **regrowth suppression** along the capsule — `Grid.regrowMult`/`regrowTimer`, shipped in 6B-2. |
| `lanceOvercharge` | **Long Charge** | Longer charge, superlinear power. | Pure timing + power curve. |

**`lanceOvercharge` is a forced rename** (umbrella Finding 4).
`ExtensionKey` is a flat, **globally unique** union, and `'overcharge'`
is already Bolt Turret's, shipped in 6B. The two are genuinely different
mechanics — Bolt's is *every 5th shot at triple power*, Lance's is
*longer charge, superlinear power* — so this is a rename, not a merge.
Display name **"Long Charge"** keeps them distinguishable on a card,
which matters more than the key does.

**Key-collision check:** `piercingCore`, `twinLance`, `afterglow`,
`lanceOvercharge` are all clear of the 28 shipped keys. `twinLance` is
deliberately distinct from Bolt's `twinBarrel` and Poison's
`twinCanister` — three "twin" extensions now exist, which is a naming
pattern rather than a collision, but worth a glance on the cards to be
sure they read distinctly.

---

## 7. Bookkeeping

| Where | What | Enforced? |
|---|---|---|
| `types.ts` | `WeaponKey` += `'lance'`; `DeliveryKind` += `'beam'` | — |
| `tuning/gems.ts` | Velocity refuses beam; Extension's beam reading (§2.1); beam `desc` branches where they exist | ❌ — covered by a legality test |
| `state.ts` | `weaponTimers` entry; `BeamFx[]` | ✅ `weaponTimers` is a total `Record` |
| `weapons/registry.ts` | `WEAPON_PIPELINES.lance` | ✅ total `Record` |
| `tuning/weapons.ts` | curves + `WEAPON_DEFS.lance` | ❌ — completeness test |
| `tuning/extensions.ts` | 4 `ExtensionKey` members + defs | ❌ — existing table test |
| `systems/targeting.ts` | `highestMassPoint()` (§3) | — |
| `grid/clear.ts` | the `capsule` shape (§4) | — |
| `weapons/lance.ts` | the pipeline | — |
| `render/beam.ts` | the beam, the core aura, the charge particles, the target line (§5.1) | — |
| `state.ts` | Lance's charge timer + its currently-acquired target, for the renderer to read (§5.2) | — |

Roster goes to **ten weapons for three deck slots**.

---

## 8. Order of work

1. `'beam'` on `DeliveryKind` + the gem legality table (§2.1). Do this
   first — it is the piece that measures the pipeline bet, and it is
   fully testable with no weapon in existence.
2. The `capsule` shape on `ClearOptions` (§4), with the target-sampled
   density fix. Test directly.
3. `highestMassPoint()` + its fallback (§3). Test directly.
4. `types.ts` / `tuning/weapons.ts` / `state.ts` / `registry.ts` —
   the compiler-enforced skeleton.
5. The pipeline, including the charge timer.
6. `render/beam.ts` — the beam itself, then all three tell layers (§5.1).
   The **core aura first**, since it is the one that works with no target
   and therefore the one that makes the weapon legible at all.
7. The four extensions.
8. Tests throughout. Then live browser verification, **including a
   dedicated look at the charge tell** (§5).

Steps 1–3 are each independently testable before Lance exists at all,
which is the same "prove the framework before the content depends on it"
ordering that made 6B-1 work.

---

## 9. Tests

**The beam's defining property**
- The beam damages a cell **behind** its target. This is what "pierces
  the line" means, and it is the one property separating Lance from a
  large Bolt. If only one test is written, this is it.

**XP**
- One beam grants XP proportional to mass removed. Asserted against the
  single-call value, guarding the §4 rounding collapse.

**Acquire**
- Given two coagulants, the beam aims at the **larger**, not the nearer.
- With **no** coagulants, it falls back to the nearest frontier point and
  still fires (§3 — the "does nothing for ninety seconds" guard).
- `phase === 'forming'` coagulants are not targeted.

**Gem legality on `'beam'`**
- Velocity is refused.
- Extension is **allowed and measurably lengthens the linger window** —
  not merely legal to socket, which would pass even with an inert mod.
  That distinction is exactly what Chill Field's silent no-op taught in
  6B-2.

**Extensions** — one outcome test each, four total:
- `piercingCore`: more damage against an armoured coagulant, **and** the
  cap holds (armour stays answerable, never irrelevant).
- `twinLance`: two distinct beam paths.
- `afterglow`: damage continues after the beam call returns, and regrowth
  is suppressed along the line.
- `lanceOvercharge`: longer charge, and power rises **superlinearly** —
  asserted as a ratio between two levels, not just as "bigger."

**Completeness** — `lance` has a def, a pipeline, and four extensions.

---

## 10. Risks specific to this batch

**1. The charge tell is a feel problem and the suite cannot catch it**
(§5). Named as the batch's most likely playtest complaint. The mitigation
is a dedicated browser check, not a test. **Three specific things to look
at:** that the aura is legible with no target on the field; that the
charge particles do not read as XP pickup (§5.1's warning); and that a
deck running both Lance and Immolation Ring keeps two distinguishable
things around the core.

**2. `highestMassPoint` may make Lance feel passive early.** With no
coagulants it falls back to nearest-frontier and behaves like a slow,
huge Bolt. That is correct, but it means the weapon's *identity* is
invisible for the first stretch of a run, and a player may conclude it is
boring before it is interesting. Worth watching at the playtest; the
cheap fix if it lands badly is a lower coagulant-mass threshold for
preferring one over the frontier.

**3. Beam rendering is genuinely new visual vocabulary**, and 6E's
Cauterizer inherits whatever this establishes. A shortcut here is paid for
twice.

**4. `'beam'` may reveal gems the six-touch-point estimate missed.**
Finding 5's count came from reading `supports`/`desc`; a gem whose
*implementation* quietly assumes a projectile or a radius would not show
up in that read. Step 1's ordering is the mitigation — the legality table
gets built and tested before anything depends on it.

**5. Lance is a burst weapon in a game with no burst weapons**, so there
is no reference point for whether its numbers feel right. Balance is
explicitly Phase 8; the question here is *"is a charged single-target
beam interesting to have"*, and that answer does not depend on the
numbers being right.

---

*Written 2026-08-10. Planned, not greenlit. Depends on 6C-1. Umbrella:
`docs/plans/phase-6c-lance-shockwave-fission.md`.*
