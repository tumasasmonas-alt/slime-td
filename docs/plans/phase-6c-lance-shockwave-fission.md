# Phase 6C — Lance, Shockwave, Fission Charge

**Status:** 🟢 **Settled by the owner, 2026-08-10.** All four questions in
§8 answered in one pass; the answers are folded into the body below and
§8 now records them rather than asking them. **Three of the four went the
way this document recommended; Q1 and Q4 did not**, and both are better
for it — see §8.

**Not yet greenlit to build.** The plan is settled; the go-ahead is
separate.

**Source:** `docs/plans/phase-6-roadmap.md` §3 (the batch this expands);
`docs/plans/phase-5-6-arsenal.md` §6 (attributes), §7.7/§7.9/§7.10 (the
three weapon designs), §8 (coverage), §9½ (visual cost); Decisions 70–80;
the code as it stands at commit `6ba36bb`.

**⚠️ The gate moves a third time — 6C is built first.** The roadmap put
**THE GATE** between 6B and 6C (roadmap §5 Q1, 2026-08-09). The owner
moved it again on 2026-08-10: **6C ships first, and the gate runs after
it.** Raised as a question rather than assumed, per `CLAUDE.md`'s
ground-truth override protocol, precisely because it was already a
settled decision; §8 Q1 records the call and its consequence. The
roadmap's §3 table needs its gate row moved when this batch ships.

---

## Table of contents

1. [What 6C is](#1-what-6c-is)
2. [Seven findings from reading the code against the design](#2-seven-findings-from-reading-the-code-against-the-design)
3. [The three weapons, as they would be built](#3-the-three-weapons-as-they-would-be-built)
4. [The twelve extensions](#4-the-twelve-extensions)
5. [New machinery, and what it costs](#5-new-machinery-and-what-it-costs)
6. [Order of work](#6-order-of-work)
7. [What gets tested](#7-what-gets-tested)
8. [The four questions, and how the owner settled them](#8-the-four-questions-and-how-the-owner-settled-them)
9. [Risks](#9-risks)

---

## 1. What 6C is

The **first new weapons since the pipeline existed**, and therefore the
first honest test of the bet Phase 5A made: that a weapon is a
`WeaponPipeline` object plus a `WEAPON_DEFS` entry, and that everything
else — cards, sockets, gems, extensions, the inventory screen, the
pre-run select — picks it up for free.

Every batch since 5A has *added to* that framework. 6C is the first that
only *consumes* it. If a weapon costs three files and a test, the bet
paid off. If it costs fifteen, that is a finding worth more than the
weapons.

Three weapons, from the roadmap's 6C row:

| | Delivery / targeting / effect | Why it is in this batch |
|---|---|---|
| **Lance** 🔆 | charged beam / highest-mass target / clear along a line | The single-target answer the game does not have. Establishes **beam rendering**, which Cauterizer (6E) reuses. |
| **Shockwave** 🌊 | expanding ring / self-centred outward / clear | The near-field / Mote-swarm answer. No targeting decision to get wrong. |
| **Fission Charge** 🎇 | lobbed / scatter / many hits over a wide area | The Blastoma answer and the best ambient-field clear in the catalogue. |

They are here together because the roadmap's own reasoning holds: these
are the three that need nothing beyond the pipeline, and two of them
directly close gaps the owner named — single-target burst and proper AoE.

**Not in this batch:** anything that needs terrain modification (6E),
displacement (6F), autonomous units or a second field layer (6G), or the
remaining gem classes (6D, 6H, 6I).

---

## 2. Seven findings from reading the code against the design

### Finding 1 — 🟢 The Shockwave bug the arsenal plan warned about is already fixed

`phase-5-6-arsenal.md` §9½ flags `render/novaFx.ts` as carrying a latent
defect — *"`state.novaFx` is a **single slot**, not a list — two pulse
weapons in one frame overwrite each other… a real bug the moment
Immolation Ring gets its visual or Shockwave ships."*

**It was fixed in 5B-6.** `state.novaFx` is `NovaFx[]`, `updateNovaFx`
filters a list, and `NovaFx` carries its own `color` rather than reading
a hardcoded constant. The risk is discharged; recording that here so a
later reader does not re-derive it from a stale warning.

### Finding 2 — 🔴 Shockwave does **not** reuse the pulse renderer

The same §9½ table classes Shockwave as **Free — "reuses the pulse
renderer, once it's a list."** Having now read both, that is wrong, and
it is the single biggest cost this batch carries that the roadmap does
not price.

`NovaFx` is `{ x, y, radius, life, maxLife, color }` — a **fixed-radius
flash that fades in place**. It has no velocity, and nothing damages
anything as a consequence of it; Frost applies its damage instantly via
`clearAt` at fire time and spawns the flash purely as decoration.

Shockwave is *"a ring that expands from the core and **damages
everything it passes through**"* (§7.9). Its radius grows over time, and
the damage is a **swept annulus**, not a disc — mass at radius 200 must
be hit when the ring reaches 200, not when it is fired. That is a
persistent simulation entity with its own update pass, not a decoration.

**This is cheap but it is not free.** It needs a `ShockwaveRing[]` on
state, an update in the fixed-timestep pass, and an annulus damage sweep.
What it genuinely *does* reuse is the **render vocabulary** — a stroked,
fading circle is exactly what `render/novaFx.ts` already draws, so the
"no new visual language" half of §9½'s claim survives. Only the "free"
half does not.

The annulus sweep also has a real correctness trap, called out in §5.

### Finding 3 — 🟡 The roadmap says nine extensions; 6B's own precedent says twelve

The roadmap's 6C row reads *"with their nine extensions"* — three per
weapon, per arsenal plan §12.

**6B shipped four per weapon** (Decision 78), superseding that call at
the owner's direction. Shipping 6C at three would leave the roster
inconsistent: seven weapons with four extensions and three with three,
for no reason a player could ever see. **Settled 2026-08-10: twelve**
(§8 Q2) — four per weapon, permanently the rule for every future weapon
batch, not a per-batch decision to re-ask.

The design already carries the content — §7.7/§7.9/§7.10 each list four
candidates, exactly as the incumbents did.

### Finding 4 — 🟡 Lance's designed extension list collides with a shipped key

`ExtensionKey` is a flat, **globally unique** union (`tuning/extensions.ts`
— deliberately not namespaced per weapon, so `findOwnedExtension`'s
`(weaponKey, kind)` lookup and one flat `EXTENSION_DEFS` both stay
simple).

Arsenal §7.7 names one of Lance's four **Overcharge**. `'overcharge'` is
already Bolt Turret's, shipped in 6B. The two are also genuinely
different mechanics (Bolt's is *every 5th shot at triple power*; Lance's
is *longer charge, superlinear power*), so this is a rename, not a merge.
§4 proposes `lanceOvercharge` → displayed as **"Long Charge."**

Worth noting the naming pressure is structural and will recur: Shockwave's
designed *Second Wave* sits next to Immolation's shipped *Second Ring*,
and Mortar (6E) has a *Blast Radius* extension while Fission has Blast
Radius as an **attribute**. None of those actually collide as keys today,
but a check against the shipped union belongs in every future weapon
batch's checklist, and this is the first batch that proves why.

### Finding 5 — 🟢 Adding a `'beam'` delivery archetype is much cheaper than the N×M framing suggests

`DeliveryKind` is the axis every gem reinterprets against, and Lance
needs a sixth value. The naive cost is 20 shipped gems × 1 new archetype.

The actual cost, read off `tuning/gems.ts`, is about **six decisions**:

- All 14 Behaviour gems have `supports: ALWAYS` by the owner's explicit
  no-refusals call (6A-2), and most `desc`s are archetype-blind.
- Of the 6 Amplifier gems, four are `ALWAYS`. Only **Extension**
  (`pulse | cloud`) and **Velocity** (`projectile | orbital`) make a real
  legality decision, and both need one line for beam.
- The handful of `desc`s that branch do so on `orbital`, not on a
  general switch — adding beam does not force a rewrite of any of them.

This is the pipeline bet paying off exactly as designed, and it is worth
recording as evidence at the gate.

**The two beam legality calls, both settled 2026-08-10** (§8 Q4):

- **Velocity — refused.** A beam is instantaneous; there is no travel
  speed to raise. Beam joins `pulse`/`cloud`/`ring` in Velocity's
  refusal set.
- **Extension — allowed, with a reading of its own.** The owner declined
  both the "refuse it" and the "let Afterglow make it live" shapes in
  favour of giving beam a real duration term independent of any
  extension: **the beam line stays hot briefly and resolves a second
  time**, and Extension lengthens that window.

**Why the owner's answer is better than the one this document
recommended.** The proposal was to refuse, on the grounds that a gem
which is dead unless a specific extension is socketed is the *"cards
appear to do nothing"* failure. That reasoning was right about the
*coupled* shape and wrong to conclude "refuse" from it — refusing
also leaves `'beam'` as the only archetype in the game with a hole in
the Amplifier table, and it makes **Afterglow** (a *lingering* line)
sit next to a gem the game says beams cannot have. Giving beam its own
duration term removes the hole and the coupling at once, and it costs a
single lingering-resolve field rather than a legality special case. It
also means Afterglow becomes *"much more of what the beam already
does"* rather than the sole thing unlocking a gem — a strictly better
card.

**What it costs:** one `lingerFor` field on the beam, a re-resolve of the
same sweep at reduced power when it expires, and Extension's existing
`duration` mod scaling that window. The re-resolve reuses the sweep that
already exists, so this is one field and one branch, not a system.

### Finding 6 — 🟢 Fission Charge is nearly free, thanks to 6B-2

`spawnClusterSubmunitions()` (`systems/projectiles.ts`, built for
Missile's *Cluster Warhead* in 6B-2) is precisely the scatter primitive
Fission needs: a projectile that, at a point in its flight, becomes N
children distributed over an area. Fission is that mechanic promoted from
an extension to a weapon's whole identity.

The call-site pattern 6B-2 landed on — children spawned in
`updateProjectiles`, never pushed onto the array mid-iteration — is
already the correct shape and needs no change. Fission's *Chain Fission*
extension (submunitions split again) is one recursion-depth field on top.

### Finding 7 — 🟡 Lance needs two things nothing in the codebase does yet

Both are small, both are genuinely new:

**A "highest mass in range" ACQUIRE.** `nearestFrontierPoint()` is
nearest-wins by design (Decision 45), and `findNearbyRevealedPoint()` is a
local box search around an arbitrary point. Neither answers *"which
coagulant is biggest."* This is a new `systems/targeting.ts` export —
maybe 20 lines, walking `state.coagulants` for max `mass` within range,
with a documented fallback to `nearestFrontierPoint()` when no coagulant
exists (an early run has none, and a weapon that does nothing for the
first ninety seconds is the *"cards appear to do nothing"* failure in a
new costume).

It is also **exactly the acquire stage Threat Priority (6D) will replace
wholesale**, which is a small argument for building it cleanly now.

**Damage along a line.** `clearAt()` is a point-and-radius call; every
shipped weapon resolves at a point. Lance *"damag[es] everything along the
line"* (§7.7). The honest implementation is a **sampled sweep** —
`clearAt` at intervals along the beam, at beam-width radius, from the
tower to the target and onward to max range. Sampling at roughly the grid
cell size means no cell is skipped, and it reuses the whole RESOLVE stage
(armour, falloff, `ClearOptions`, extensions, gems) with zero new damage
code.

**The trap — and it runs the opposite way to what this document first
claimed.** A sweep is many `clearAt` calls, and `clearAt` grants XP per
call. The obvious worry is over-crediting. The code says otherwise:
`gemValueFromRemoved()` is `Math.round(removed * 1.3)`, and there is a
`GEM_DROP_THRESHOLD` of 0.08 per call. Split one beam's removal across
30 samples and each sample rounds toward **zero** — a beam that would
pay 8 XP as one call pays **nothing** as thirty. Lance would be the
highest-damage weapon in the game and grant almost no XP, silently.

**Corrected 2026-08-10** on a closer read of `tuning/xp.ts`. The fix in
§5D is the same either way, but the failure it prevents is the reverse of
what was written, and getting the direction wrong would have meant
testing for the wrong thing.

DPS is unaffected — `state.dpsAccum += totalRemoved` is a plain sum and
is honest under any sampling.

---

## 3. The three weapons, as they would be built

Each is a `WeaponPipeline` (`ready`/`acquire`/`deliver`), a `WEAPON_DEFS`
entry, a `tuning/weapons.ts` curve set, and a registry line. Attributes
are from arsenal §6 and are not reopened.

### 3.1 · Lance 🔆 — `delivery: 'beam'`

*Power · Charge Rate · Beam Width. Fourth attribute: no.*

- **READY** — **not** `cooldownReady`. Lance *charges*: a visible wind-up
  of 1.5–3s (shrinking with level, divided by `weaponMods().rate` like
  every other weapon's cooldown), then fires. Mechanically this is a
  cooldown, but the charge must be *visible* or the weapon reads as
  broken — see §5.
- **ACQUIRE** — `highestMassPoint(state, range)`, falling back to
  `nearestFrontierPoint`.
- **DELIVER** — sampled `clearAt` sweep from tower through target to max
  range, at `beamWidth(lvl)` radius, with `resolveOpts()` applied and the
  XP/DPS double-count guarded. Pushes one `BeamFx` for the renderer.
- **Armour:** one huge hit means Decision 44's flat reduction is noise
  against it. That is the design's whole point and needs no special code.

### 3.2 · Shockwave 🌊 — `delivery: 'pulse'`

*Power · Rate · Ring Reach. Fourth attribute: no.*

Reuses the **existing** `'pulse'` archetype rather than adding a seventh
DeliveryKind. It is self-centred, it has no travel-speed term of its own
that a player would name, and every gem's pulse reading already reads
correctly against it. A new archetype would buy nothing and cost twenty
descriptions.

- **READY** — `cooldownReady('shockwave', shockwaveCooldown)`.
- **ACQUIRE** — none (self-centred, like Frost/Blades/Immolation).
- **DELIVER** — pushes a `ShockwaveRing` onto state. **The damage does
  not happen here** — it happens as the ring expands, in the sim tick.
- **Radius floor:** a self-centred, outward-travelling ring must respect
  `towerCenteredRadius()`. 6B-2 learned this the hard way — every
  tower-centred radius floors at `perimeter`, so a ring is only coherent
  travelling *outward from* that floor. Shockwave starts at the floor and
  expands to Ring Reach. Its *Implosion* extension (travels inward from
  max range) is the one that has to stop **at** the floor rather than at
  the tower, and §4 says so explicitly.

### 3.3 · Fission Charge 🎇 — `delivery: 'projectile'`

*Power · Rate · Submunitions · **Blast Radius** — four attributes, one of
the four weapons in §6 that earns one.*

- **READY** — `cooldownReady('fission', fissionCooldown)`.
- **ACQUIRE** — `frontierAcquire` (the shared nearest-frontier stage).
- **DELIVER** — spawns one lobbed projectile carrying `submunitions` and
  `scatterRadius`. On arrival it bursts via the existing
  `spawnClusterSubmunitions` pattern; each child resolves as an ordinary
  AoE impact through the shared projectile path.
- Being a plain `'projectile'` means Multishot, Formation, Homing, Fork,
  Pierce and the rest all already work on it. No new gem wiring at all.

---

## 4. The twelve extensions

Four per weapon, matching 6B's shipped shape (Finding 3), each levelling
1→3 then leaving the pool permanently. Names are arsenal §7's, with the
one rename Finding 4 forces.

**Lance** — `piercingCore` *Piercing Core* (ignores armour up to a cap) ·
`twinLance` *Twin Lance* (two beams at reduced power) · `afterglow`
*Afterglow* (the line stays hot as a DoT) · `lanceOvercharge` **"Long
Charge"** (longer charge, superlinear power — renamed off Bolt's shipped
`'overcharge'`).

> *Afterglow* needs the least new machinery of the four, now that Q4 gives
> every beam a base lingering window (Finding 5): Afterglow is that
> window made long and damaging rather than brief and incidental, plus
> **regrowth suppression** along the line — which 6B-2 already shipped
> (`Grid.regrowMult`/`regrowTimer`). No longer coupled to the Extension
> gem's legality; it now stacks with it, which is the better card.

**Shockwave** — `secondWave` *Second Wave* (a second ring follows) ·
`knockback` *Knockback* (shoves coagulants outward) · `resonantRing`
*Resonant Ring* (damage scales with the density it crosses) · `implosion`
*Implosion* (travels inward from max reach — **stopping at `perimeter`**,
per §3.2).

> *Knockback* is **not** the displacement subsystem 6F builds. `ClearOptions`
> already has a shipped `kickback` field (the Kickback gem, 6A-2), and this
> extension is that same field at a larger value. Reusing it is the whole
> point of RESOLVE being the single damage path (Decision 42), and it means
> Shockwave ships zero displacement code.

**Fission Charge** — `widerScatter` *Wider Scatter* · `chainFission`
*Chain Fission* (submunitions split again — one recursion-depth field) ·
`sticky` *Sticky* (submunitions land and burn — a small
`CausticCloud`-shaped persistent effect, reusing `systems/clouds.ts`) ·
`focusedPattern` *Focused Pattern* (tight cluster, converting it to
single-target).

Every one of the twelve is either a `GemModDelta` (folded into
`weaponMods()` with zero new call sites, exactly as 6B-1 established) or
one field on an existing entity. **None needs a new subsystem** — which
is the property that made 6B tractable and is the main reason these three
weapons belong in one batch.

---

## 5. New machinery, and what it costs

Everything in this batch that is not "another entry in an existing table."

**A. The `ShockwaveRing` entity** *(Finding 2)*. A list on state; radius
advances in the fixed-timestep sim pass (never a draw call — Decision
4/7's bug class); damages the annulus it crossed this tick.

> **The correctness trap, stated loudly:** the ring must damage the band
> **between last tick's radius and this tick's**, not a disc at the
> current radius. A disc re-damages everything already swept, every tick
> — a ring that hits the near field twenty times instead of once. The test
> for this is an outcome test, not a mechanism test (Decision 20): *a cell
> just inside the start radius is damaged exactly once over the ring's
> whole life.*

**B. `'beam'` on `DeliveryKind`** *(Finding 5)* — six touch points, two
of them real legality calls.

**C. `highestMassPoint()`** *(Finding 7)* — new `systems/targeting.ts`
export, with a documented nearest-frontier fallback.

**D. `ClearOptions.shape` — one generalization that both new damage
shapes need.** This is the batch's central architectural finding, and it
arrived late: **Shockwave and Lance want the same thing.**

`clearAt` damages a **disc**. Shockwave needs an **annulus** (the band
the ring swept this tick) and Lance needs a **capsule** (a line with
width). Doing either by sampling with many disc calls is bad for two reasons —
the XP rounding collapse above, and overlapping discs damaging cells
unevenly at the seams. *(A third argument, cost, was claimed here
originally and is **withdrawn**: recomputed, a ring is ~1,400 cell visits
per tick, which is nothing. See `phase-6c1-shockwave-fission.md` §3.2.)*

The generalization is small, because `clearAt`'s inner loop already
reduces everything to one number: `d`, the distance from the hit centre
to the cell. Making that **distance-to-shape** instead of
distance-to-point covers all three cases, and every downstream
concern — falloff, resistance, maturity, scarring, dirty-set bookkeeping,
the coagulant loop, XP, DPS — is untouched and shared. One call, one XP
credit, no seams.

What it actually costs: a shape discriminator on `ClearOptions`, a
distance function with three branches, and a bounding-box computation
per shape (today's box is derived from a single cell; an annulus and a
capsule each need their own). **The disc path must remain byte-for-byte
the default**, so all seven shipped weapons are unaffected.

**One sharp edge, already documented in the codebase.**
`tuning/weaponGeometry.ts` warns that `clearAt` scales `radiusPx` by
density *sampled at the hit centre*. For a disc that is fine. For a
capsule whose origin is the tower — where density is always near zero —
it would silently apply the maximum 1.25× widening along the whole beam.
The fix is to sample at the shape's **damage centroid** (the target for a
capsule, the mid-radius for an annulus) rather than its origin, and that
choice belongs in a comment next to the code, not only here.

**This is the highest-risk item in the batch**, and it is why 6C-1
carries it: Shockwave forces it, and Lance then gets its shape almost
free. See `phase-6c1-shockwave-fission.md` §3.

**E. `BeamFx` rendering** — a new `render/beam.ts`. A fading line, drawn
from entity state. Genuinely new visual vocabulary, and Cauterizer (6E)
reuses it.

**F. Lance's charge tell.** A weapon that does nothing for 3s then fires
reads as *broken* unless the charge is visible. This is not polish: the
project has already shipped one fix (coagulant `'forming'` phase, after
the 3C gate found instant formation gave *"zero warning"*) for precisely
this failure. Cheapest honest version: the beam line drawn faintly at its
target during charge, brightening as it fills.

**G. Mechanical bookkeeping**, listed so nothing is forgotten: three keys
on `WeaponKey`; three entries in `freshState()`'s `weaponTimers` literal
(a full `Record`, so the compiler enforces it); three `WEAPON_PIPELINES`
lines; three `WEAPON_DEFS` entries; twelve `ExtensionKey` members and
their `EXTENSION_DEFS`. **The registry and `weaponTimers` are both total
`Record`s — a weapon that is built but not wired fails to compile**,
which is exactly the protection `registry.ts` was written to give after
the unreachable-weapons finding.

**H. The pre-run select screen needs nothing.** `ui/weaponSelect.ts`
iterates `Object.keys(WEAPON_DEFS)`, so all three appear the moment their
defs exist. The deck stays at `state.weaponSlots` = 3, so **ten weapons
now compete for three slots** — the first batch where the select screen
poses a real question. That is a gate observation worth collecting.

---

## 6. Order of work

**Two batches, mirroring 6B's shape — settled 2026-08-10** (§8 Q3). 6B
was split for exactly this reason and it worked: the framework batch was
verifiable before any content depended on it.

**6C-1 — the two cheap weapons.** Shockwave and Fission Charge, plus
their eight extensions. Both reuse existing archetypes; the only new
system is the `ShockwaveRing` sweep. Ships a playable, gradeable batch.

**6C-2 — Lance.** The new `'beam'` archetype, the highest-mass acquire,
the line sweep and its XP guard, the beam renderer, the charge tell, and
its four extensions. Every genuinely new thing in 6C is in this half.

The order is deliberately *not* "hardest first." 6C-1 answers the
batch's real question — *does a weapon cost three files or fifteen?* —
using the two weapons that should be cheapest. If they are not cheap, that
is a finding about the pipeline that changes how Lance gets built, and it
is much better learned before the new-archetype work than during it.

**A second argument for this order emerged after the split was
settled**, and it is stronger than the first: `ClearOptions.shape` (§5D)
is forced by Shockwave and *reused* by Lance. Building 6C-1 first means
the shape work is written, tested and playtested against the simpler of
its two consumers before the beam depends on it. Had the split gone the
other way, Lance would have paid for the generalization and Shockwave
would have inherited it untested.

**Full detail lives in the two batch plans:**
`docs/plans/phase-6c1-shockwave-fission.md` and
`docs/plans/phase-6c2-lance.md`. This document stays the umbrella — the
findings, the settled questions, and the shape of the whole batch.

Within each half, the order is the one 6B used: types and tuning tables
first, then the pipeline, then extensions, then render, then tests, then
live verification in the browser.

---

## 7. What gets tested

Following `CLAUDE.md`'s rule — **test the invariant, not the mechanism**
(Decision 20) — and 6B's own lesson, where two real bugs were caught by
outcome tests before the browser ever saw them (Decision 80).

- **Per weapon:** an outcome test that it removes mass at all, and one
  that a level-2 weapon removes more than a level-1.
- **Shockwave:** *a cell is damaged exactly once across the ring's whole
  life* — the §5A trap, as an outcome.
- **Shockwave `Implosion`:** the inward ring stops at `perimeter`, never
  inside it.
- **Lance:** the beam damages a cell **behind** its target (that is what
  "pierces the line" means, and it is the one property that distinguishes
  Lance from a big Bolt).
- **Lance XP guard:** one beam grants XP proportional to mass removed, not
  to sample count — asserted by firing the same beam at two different
  sample densities and comparing XP.
- **Per extension:** one outcome test each, twelve total, exactly as 6B
  did. That discipline is what caught Chill Field and Shatter Core.
- **Registry/table completeness:** every `WeaponKey` has a pipeline, a
  def, and four extensions — the tests that turn "built but not wired"
  into a red suite.
- **Gem legality on `'beam'`:** Velocity refused; Extension **allowed**,
  with an outcome test that socketing it measurably lengthens the beam's
  lingering window (Finding 5) — not merely that it is legal to socket,
  which would pass even if the mod were inert. That distinction is
  exactly what Chill Field's silent no-op taught in 6B-2.

Then the same live browser verification 6B ended on, which the owner can
now watch directly.

---

## 8. The four questions, and how the owner settled them

All four answered 2026-08-10, in one pass. Recorded with the
recommendation each was given, including where the owner went the other
way — that record is the point, and this project has been wrong often
enough for it to be worth keeping.

**Q1 — Does the gate run before 6C?** ❌ *Recommended: run the gate
first.* ✅ **Owner: build 6C first, gate after.**

This moves the gate for the **third** time — the roadmap moved it from
after 5C to after 6A, then from after 6A to after 6B, and it now sits
after 6C. Raised rather than assumed, per `CLAUDE.md`'s ground-truth
override protocol, because roadmap §5 Q1 had already settled it.

The case for the owner's call is one this document undersold: §5H notes
that 6C makes **ten weapons compete for three deck slots**, and the
gate's question is *"is enhancement a decision or a slider?"* A
three-weapon roster where every weapon is always in the deck is a
genuinely weaker place to ask that than a ten-weapon roster where
choosing is unavoidable. The same reasoning that moved the gate the first
two times — *do not judge a mechanism while half its inputs are
placeholders* — argues for moving it again here.

**The consequence to accept knowingly:** the gate is also the go/no-go on
the 65-gem count, and 6D is a gem batch. If the gate says the gem count
is wrong, 6C's twelve extensions will already have been built against the
current socket economy. That is a smaller exposure than it sounds —
extensions live on their own socket line since 6B-1 and do not depend on
the gem count — but it is real, and it is the reason this was worth
asking rather than assuming.

**Q2 — Nine extensions or twelve?** ✅ **Twelve** — as recommended. Four
per weapon is now the standing rule for every weapon batch, not a
per-batch call.

**Q3 — One batch or two?** ✅ **Two** — as recommended. 6C-1 =
Shockwave + Fission; 6C-2 = Lance. §6.

**Q4 — Is the `Extension` gem legal on `'beam'`?** ❌ *Recommended:
refuse.* ✅ **Owner: allow always, and give beam its own duration
reading** — the beam lingers briefly and resolves a second time.

Finding 5 carries the full reasoning for why this is the better answer.
The short version: refusing would have left `'beam'` as the only
archetype with a hole in the Amplifier table, and would have put a
*lingering-line* extension (Afterglow) next to a gem the game insists
beams cannot have. Giving beam a real duration term removes the hole and
the extension-coupling in one move, for one field and one branch.

---

## 9. Risks

**1. Lance's XP guard is silent when wrong** (§5D). It does not crash; XP
just comes in too fast, which reads as "the game got easier" rather than
as a bug. Named here so it is checked deliberately rather than felt.

**2. The charge tell is a feel problem, and feel problems survive tests**
(§5F). This project has shipped this exact failure once already
(instant coagulant formation, caught only at a playtest gate). The test
suite cannot catch it. Budget a browser check specifically for it.

**3. Ten weapons, three slots.** 6C is the batch where the deck becomes
genuinely contested. That is the design working — but it also means the
weapons in this batch may be judged against Blades (534 DPS, the
strongest thing in the game) rather than on their own terms. **Balance is
explicitly not gradeable until Phase 8**; the question at 6C's playtest is
*"is this weapon interesting"*, not *"is this weapon competitive."* Worth
saying out loud before the playtest, not after.

**4. Shockwave's annulus sweep is the first damage in the game that is
neither instant-at-a-point nor carried by a projectile.** It is a third
shape, and third shapes are where assumptions hide. The once-only test in
§7 is the guard, and it should be written before the sweep, not after.

**5. This is the first batch that only consumes the framework, so a bad
result is expensive information.** If these three weapons cost far more
than three files each, the estimate for the remaining eight weapons is
wrong by the same factor, and 6E–6G are the batches that were already the
riskiest. Better learned here, at three weapons, which is the same
argument that justified 6B existing.

**6. The gate is now three batches from where it started** (§8 Q1). Each
individual move was well-argued and the owner made every one of them
deliberately — but "the gate moves again" is a pattern, and the honest
risk is that it keeps moving until it never runs. The counterweight:
6A-3 exists *because* the owner playtested immediately rather than
waiting for a formal gate, and it found three structural breaks no
review would have caught. The gate matters less when the owner plays
each batch as it lands. **Worth watching, not worth blocking on.**

---

*Written 2026-08-10; §8's four questions settled the same day. Plan is
final; the go-ahead to build is separate. When 6C ships, `docs/plans/
phase-6-roadmap.md` §3's table needs its **THE GATE** row moved below the
6C rows, and the gate move recorded in `docs/DECISIONS.md`.*
