# The Arsenal — Phase 5 framework and Phase 6 catalogue

**Status:** 📋 **Design settled (revision 3); 5A-0/5A implemented and
verified 2026-08-08 — Decision 70.** The catalogue itself (18 weapons, 65
gems, slot/socket economics) is still design-only, nothing in it written
into DECISIONS.md. Reviewed by the project owner across 2026-08-08 in two
passes: revision 2 reshaped the attribute model, cut a gem and grew the
list to 65; revision 3 closed **23 open questions** (§12). A pre-refactor
audit — re-reading every decision, session record and plan against this
document — then closed **three more** and surfaced **three work items**
(§12.6, §13), all resolved during 5A. What remains open in the *catalogue*
is measurement — point totals, pacing numbers — not design.

**Phase 4's gate passed**, played by the owner 2026-08-08: *"I have played
it, all good."* The threat model this catalogue is authored against is
confirmed in real play, not just through the debug harness.

**No decision is superseded.** Revision 1 proposed overriding two clauses
of Decision 40, revision 2 one, revision 3 none: the owner's single-+/-
model restored its legibility clause and choosing no-cap/no-DR restored
the rest. Socket-opening is a pure addition, so `CLAUDE.md`'s ground-truth
override protocol was never invoked.

Written 2026-08-07 in response to the owner's brief:
*"we should start with at least 15 weapons, all of them should have their
own attributes you can upgrade with points and weapon extensions. Then we
will also need support gems. We also need to think of how many slots the
weapons will have… we need a well rounded single target dps and proper
aoe. Support gems can also add abilities to weapons, or change their
working way all together."*

**Source design:** `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
§3, §4, §13, §17; `docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`
§2–§4, §8; Decisions 32, 36, 39–46, 68–69.

**Nothing in `docs/DECISIONS.md` has been changed by this document.** §12
records the **26 settled calls** that would go in as decisions when Phase 5
starts, and the six items left open — all of which are numbers needing
measurement rather than choices needing a call.

---

## Table of contents

1. [Why this session happens now](#1-why-this-session-happens-now)
2. [What the arsenal has to answer](#2-what-the-arsenal-has-to-answer)
3. [The four structural gaps](#3-the-four-structural-gaps)
4. [The architecture: one pipeline, or none of this works](#4-the-architecture-one-pipeline-or-none-of-this-works)
5. [Slots, sockets and points](#5-slots-sockets-and-points)
6. [Weapon attributes](#6-weapon-attributes)
7. [The weapon catalogue — eighteen](#7-the-weapon-catalogue--eighteen)
8. [Coverage matrix](#8-coverage-matrix)
9. [Support gems](#9-support-gems)
10. [Gem bundles](#10-gem-bundles)
11. [The card pool](#11-the-card-pool)
12. [What is settled, and what is left](#12-what-is-settled-and-what-is-left)
13. [Phasing](#13-phasing)
14. [Risks](#14-risks)
15. [Ideas considered and rejected](#15-ideas-considered-and-rejected)

---

## 1. Why this session happens now

§17 scheduled the arsenal's design session for **Phase 6**, after the
Phase 5 framework ships. That ordering is wrong, and Phase 4C is what
proved it.

The framework *is* sockets, slots and a pipeline. Designing those without
knowing what goes in them is the same mistake the project refuses to make
everywhere else — authoring against a model that doesn't exist yet. Two
concrete examples from the catalogue below, either of which would have
been discovered late and expensively:

- **Transformative gems** (§9E) rewrite a weapon's delivery or its damage
  application. If weapons stay six bespoke `updateXWeapon()` functions,
  every transformative gem costs *N weapons × 1 gem* of hand-written
  special cases. At 18 weapons and 14 transforms that is 252 cases. The
  framework has to be built to prevent that, and you only know it has to
  be if you already know transforms are coming.
- **Enhancement points opening sockets** (§5) is a one-line rule that
  changes what the inventory screen *is*. It is cheap now and a rewrite
  later.

So: this is the Phase 6 design session, run early, feeding requirements
back into Phase 5. Phase 5 still ships first and still ships framework
only. The catalogue is not built until the framework carries it.

**What is already settled and is not reopened here:** meta-currency buys
unlocks only (39); cards offer extensions and gems but never weapon levels
(40); gems unlock in thematic bundles and are then universally live (41);
armor is flat reduction on `power` with a 15% floor (44); default
targeting is nearest-wins and Threat Priority is a gem that *changes* it
(45); the pre-run deck defines the card pool (§13).

---

## 2. What the arsenal has to answer

Phase 4 closed with the threat model complete. This is the list the
catalogue is authored against — not a wish list of cool weapons, the
actual set of questions the game now asks.

| Threat | The question it asks | Stated counter (§10) |
|---|---|---|
| **Mote** swarm | Many small things at once | multi-target, chain, hit frequency |
| **Congealer** | A steady grind | sustained DPS |
| **Behemoth** | One enormous thing, slowly | burst, single-target, slows |
| **Blastoma** | One thing that becomes many | AoE cleanup; punishes all-burst |
| **Carrier** | Your own neglect, walking | prevention — keep the field clear |
| **Sclerotic** | Armor, inside your guard, no runway | **penetration** |
| **Bulwark** | A wall that eats your targeting | AoE, orbitals, pierce, or threat-off |
| **Ambient field** | Constant low-grade area clear | area, uptime |
| **Wilderness reservoir** | Ground you cannot reach | **range** |
| **Vein** | A fast corridor of fresh mass | reach along a line |
| **Maturity / scar ring** | Your own kill zone hardening against you | *nothing answers this yet* |
| **Arrival / breach** | Damage landing on the core | displacement, slows, last-line defence |

Two rows deserve calling out.

**"Nothing answers the scar ring yet"** is the design record's own risk #4
(*"the scar ring might feel oppressive — the player is forced to fight in
their own hardening zone"*). Every weapon in the game currently gets
*worse* where the player has been fighting longest, because
`clearAt`'s `resistance = clamp(1.3 - dens, 0.12, 1.3)` and 4A's
`maturityYieldMult` both cut yield on hardened ground. The catalogue
answers this deliberately with **Solvent Sprayer** (§7.13) and the
**Virulence** gem (§9C) — a weapon and a gem that get *better* exactly
where everything else gets worse.

**Armor is the axis that finally makes weapon identity mechanical.**
Decision 44's `effectivePower = max(power - armor, power * 0.15)` means
many-small-hits and few-big-hits are now genuinely different strategies
rather than the same DPS number wearing two hats. Half the catalogue's
identity hangs off which side of that line a weapon sits on, and the
**Detonation** gem (§9E) exists specifically to let a player move a weapon
from one side to the other.

---

## 3. The four structural gaps

§13 named four things the arsenal has none of. All four are filled below;
this table is the audit.

| Gap | Why it matters | Filled by |
|---|---|---|
| **Nothing modifies terrain persistently** | The field is the economy (§5) and nothing operates on it as terrain — only as targets | Cauterizer, Solvent Sprayer, Mortar *Seismic*, Immolation *Ash*, Frost *Rime*, gems Sterilizer / Culture |
| **Nothing is defensively positioned** | Everything reaches outward; nothing holds a line | Immolation Ring, Repulsor, Blades (already) |
| **Nothing displaces rather than removes** | One verb — delete — for the whole game | Repulsor, Shockwave *Knockback*, gem Inversion |
| **Nothing scales up against density** | *"matters most"* — every weapon is worse against a wall, so the only answer to a wall is raw DPS | Resonance Coil, Immolation *Backdraft*, Shockwave *Resonant Ring*, gem Saturation |

The unexplored **delivery** axes (*beam*, *autonomous summon*) are filled
by Lance and Cauterizer, and by Antibody Swarm and Mycelium. The
unexplored **targeting** axes (*densest-point*, *deepest-breach*,
*scatter*) are filled by Mortar, Fission Charge, and the targeting gems in
§9D. The unexplored **effect** axis (*debuff*) is filled by Marker Beacon
and Solvent.

After this catalogue every italicised axis in §13 has at least two
implementations, which is the bar for an axis being real rather than a
one-off.

---

## 4. The architecture: one pipeline, or none of this works

**This is the most important section in the document, and it is the whole
of Phase 5A.**

Today a weapon is a bespoke function. `weapons/bolt.ts` reads its own
level, decrements its own timer, calls `nearestFrontierPoint`, applies
`damageMult`/`atkSpeedMult` by hand, and pushes a projectile. Six weapons,
six copies of that shape, each slightly different.

That is fine for six weapons and zero gems. It is fatal at eighteen
weapons and thirty-five gems, because **every gem would have to know about
every weapon.**

### The fix: four named stages

Every weapon becomes data plus a walk through the same four stages:

```
                  ┌─ Rate gems, Overclock, attribute: Rate
                  │
  (1) READY? ─────┤   does the weapon fire this tick?
                  │
                  ▼
  (2) ACQUIRE ────┤   what does it aim at?
                  │   ← Targeting gems REPLACE this stage entirely
                  ▼
  (3) DELIVER ────┤   how does the effect get there?
                  │   ← Multishot / Fork / Echo MULTIPLY this stage
                  │   ← Emplacement / Orbital Conversion REPLACE it
                  ▼
  (4) RESOLVE ────┤   what happens where it lands?
                      ← Splash / Pierce / Penetration MODIFY this
                      ← Detonation / Inversion / Sustained REPLACE it
```

A gem is then a **hook on a named stage**, not a special case per weapon:

| Gem class | Hooks | Cost of adding one |
|---|---|---|
| Amplifier (§9A) | scalar into an existing term | one line |
| Behaviour (§9B) | multiplies stage 3 emissions | one function |
| Conditional (§9C) | multiplies stage 4 magnitude on a predicate | one predicate |
| Targeting (§9D) | replaces stage 2 | one acquire function |
| Transformative (§9E) | replaces stage 3 or 4 wholesale | one stage implementation |

**Adding a gem is O(1) in the number of weapons.** That is the property
that makes the catalogue affordable, and it does not exist today.

### What this costs

Phase 5A is a pure refactor of six working weapons with **no behaviour
change and no new content** — the least glamorous work in the project and
the most load-bearing. Every existing weapon test must pass untouched;
where a test asserts a mechanism rather than an outcome it gets rewritten
as an outcome test first (Decision 20), *then* the refactor happens.

The honest risk is that a general pipeline expressive enough for
Antibody Swarm and Mycelium is over-built for Bolt Turret. Mitigation: the
pipeline is designed against the *whole* catalogue in §7 — which is
precisely why the catalogue is being written before the framework rather
than after it (§1).

### One constraint carried forward

Everything still routes through `clearAt(state, x, y, power, opts)`.
Decision 42's *"every weapon works on coagulants unmodified, including
ones not yet designed, because everything routes through `clearAt`"* is
the reason eighteen weapons and seven coagulant kinds is not a 126-cell
compatibility matrix. **Stage 4 may add new `ClearOptions`; it may not
add a second damage path.** Weapons that do not remove mass (Solvent,
Repulsor, Marker) do not call `clearAt` at all — they write to the field
or to entity state directly, and that is the only sanctioned exception.

---

## 5. Slots, sockets and points

The owner asked directly how many slots weapons have. Here is a complete
proposal, and it hangs on one idea worth arguing for on its own.

### Weapon slots on the turret

| | Value |
|---|---|
| Starting slots | **3** |
| Maximum slots | **6** |
| Bought with | meta currency (Phase 7), per Decision 39 |
| Deck size | equal to slot count — you bring exactly what you can equip |

**An unlocked slot is optional to use, and that is a real decision.** The
deck defines the card pool (§13), so a 4-weapon deck draws from a tighter,
higher-quality pool than a 6-weapon deck. Running fewer weapons than you
own is a legitimate strategy — focus over breadth — and it costs nothing
to support because it falls straight out of the deck-defines-pool rule
that already exists.

### Support gem sockets on each weapon

**The proposal: sockets are opened by enhancement points invested in that
weapon.**

| Points invested in a weapon | Sockets |
|---|---|
| 0 | 1 |
| 3 | 2 |
| 8 | 3 |
| 15 | 4 |
| 24 | 5 |

One point per level (Decision 40). A run reaching level 30 yields 30
points: enough to take one weapon to five sockets with six points spare,
or to give four weapons three sockets each, or any shape in between.

**Why this is better than a fixed socket count.** Decision 40 shipped
enhancement points knowing they had a flaw, and recorded it honestly:

> With free reassignment and no diminishing returns, the optimal play is
> always "dump everything into whichever weapon has the most gems
> socketed." That is a slider, not a decision.

Coupling sockets to investment *inverts* that failure mode into the
mechanic. Points no longer only make a weapon hit harder — they decide
**how deep a weapon's build can go**, so specialising buys combinatorial
depth and spreading buys breadth. There is no dominant answer, and the
answer legitimately changes across a run, which is exactly the mid-run
respec the +/- was introduced to enable. One rule, and the known flaw
stops existing.

**The consequence to handle:** pulling points out of a weapon can close a
socket. Gems in closed sockets return to inventory rather than being
destroyed — **no destructive respec, ever** (settled 2026-08-08, alongside
free reassignment at any time). The inventory screen must show this
clearly before it happens.

### Extensions and gems share one socket pool

A weapon's sockets take **either** a weapon-specific extension **or** a
universal support gem. §13 asked for *"more extensions than slots,
deliberately, so the choice is contested"*; making them share the pool
makes it maximally contested and asks a good question every time —
*specialise this weapon, or generalise it?*

It is also one socket type instead of two, one UI instead of two, and one
rule to explain.

> **Where §13's "more extensions than slots" now actually bites.** With
> three extensions per weapon (settled 2026-08-08) against a 1→5 socket
> ladder, extensions outnumber sockets only up to the third one. That is
> the right shape rather than a compromise: the choice is sharply
> contested through the early and middle of a run, and a weapon taken to
> 24 points is *rewarded* by finally being able to run its whole kit plus
> two gems. Deep investment buying the end of a tradeoff is a payoff, not
> a design leak — and gems keep competing for those slots the whole way
> up, so no socket is ever free.

### Sockets on the core

**Three, fixed for now** (meta-unlockable 1→3 in Phase 7). They take core
gems only (§9F) — the dissolved passives plus new defensive utility. The
core stops being a stat block and becomes part of the build, which is
§13's stated goal.

**Core gems come from their own card track** (settled 2026-08-08), not the
weapon pool — see §11. This guarantees a defensive floor no matter how the
weapon draws fall, and it keeps twelve core gems out of an already-large
weapon pool. It does partially re-create the two-category split §13
dissolved, but the split is now *where cards come from* rather than *what
the systems are*: everything is still a gem in a socket, one unified
model, one inventory screen.

### Duplicates

Following Path of Exile 2's post-0.3.0 rule, which is the cleanest
version of this that exists: **the same gem type may be socketed in
several different weapons, but never twice in the same weapon.** Cards
grant gem *instances*, so running Amplifier in three weapons means having
found three Amplifiers.

---

## 6. Weapon attributes

**Settled by the owner, 2026-08-08**, and their version is better than the
one this document originally proposed:

> Every weapon would have a +/- only one of them, adding a point would
> increase the attributes and open sockets at milestones. Also I like the
> 3 attributes per weapon, I just think some of them should have 4 —
> example Orbiting Blades, in my head it makes sense that levelling it up
> gives more blades.

### The model

**One control per weapon.** A single +/- sets that weapon's *enhancement
level*. Each point raises **all** of that weapon's attributes along their
own curves, and crosses socket thresholds (§5) on the way up.

**Attributes are descriptive, not allocated.** They are how a weapon
expresses a level, not a menu of choices. Bolt's point makes it faster and
harder-hitting; Blades' point adds a blade. The player reads what a point
buys; they do not budget it.

### Why this is better than per-attribute allocation

**It restores Decision 40 almost intact.** The original reasoning was
legibility — *"a point buys one scalar… keeps the meaning legible ('this
weapon hits harder')."* One +/- per weapon *is* one scalar; the attribute
list is just an honest description of what that scalar does. This
supersedes far less of Decision 40 than revision 1 did, and the part it
does supersede (no diminishing returns) is a tuning call rather than a
structural one.

**It removes the spreadsheet risk entirely.** Revision 1 capped attributes
at three specifically to keep the inventory screen readable, because three
dials × six weapons is eighteen clickable controls. With one control per
weapon, attribute *count* costs nothing — which is exactly why the owner
can now ask for a fourth on the weapons that want one.

**The decision still lives where it should.** Points are contested between
weapons, not within them, and socket milestones (§5) are what make that a
build decision rather than a slider. Nothing in the original argument for
socket-opening enhancement depends on per-attribute allocation.

### Attribute sets

Default is three: **Power**, **Rate**, and a signature. "Rate" means *how
often this weapon does its thing* — for Blades that is orbit speed, for
Immolation it is tick frequency.

| Weapon | Attributes |
|---|---|
| Bolt Turret | Power · Rate · Velocity |
| **Orbiting Blades** | Power · Orbit Speed · Orbit Radius · **Blade Count** |
| **Chain Bolt** | Power · Rate · Forks · **Arc Range** |
| Frost Nova | Power · Rate · Radius |
| Caustic Cloud | Power · Rate · Duration |
| Homing Missile | Power · Rate · Blast Radius |
| Lance | Power · Charge Rate · Beam Width |
| Siege Mortar | Power · Rate · Range |
| Shockwave | Power · Rate · Ring Reach |
| **Fission Charge** | Power · Rate · Submunitions · **Blast Radius** |
| Immolation Ring | Power · Tick Rate · Ring Radius |
| Cauterizer | Power · Sweep Rate · Sterile Duration |
| Solvent Sprayer | Potency · Rate · Spray Radius |
| Resonance Coil | Power · Rate · Scaling Curve |
| Repulsor | Force · Rate · Radius |
| **Antibody Swarm** | Power · Swarm Size · Lifespan · **Travel Speed** |
| Mycelium | Spread Rate · Aggression · Lifespan |
| Marker Beacon | Mark Strength · Rate · Mark Count |

**The rule for a fourth attribute:** a weapon earns one when a *count* is
core to its identity, so that "more of them" is the obvious meaning of
levelling it up. Four weapons qualify. Everything else stays at three —
the fourth is a privilege, not a default, or the distinction stops meaning
anything.

**Two extensions were promoted into attributes** and need replacing in
their weapons' extension lists (§7): Blades' *Blade Count* and Chain's
*Arc Range*. Both are handled below.

### No cap, no diminishing returns

**Settled 2026-08-08: neither.** Points scale linearly and forever;
`WeaponDef.maxLevel` is retired rather than raised.

**This means Decision 40 survives completely intact** — one scalar, freely
reassignable, no diminishing returns, all three clauses exactly as
written. Socket-opening is a pure *addition* to it rather than a
supersession, so **the ground-truth override protocol never had to be
invoked.** Revision 1 proposed superseding two clauses and revision 2 one;
revision 3 supersedes none.

**The known risk is therefore re-accepted knowingly, exactly as Decision
40 already did:**

> With free reassignment and no diminishing returns, the optimal play is
> always "dump everything into whichever weapon has the most gems
> socketed." That is a slider, not a decision.

Two counterweights now exist that did not when that was written. The
socket ladder means dumping points into one weapon is *also* the choice to
run fewer, deeper weapons — a real shape, not a free win. And the threat
model shifts across a run (wilderness behemoths early, armoured
close-range late), so the weapon that deserves the points changes.

Whether that is enough is a playtest question, and Decision 40 already
named the fix if it is not: **diminishing returns per weapon, not a cap.**
The Phase 5 gate is where that gets judged.

---

## 7. The weapon catalogue — eighteen

**All eighteen ship** — settled 2026-08-08, *"18 weapons, I like them
all."* §13 batches them; the last three are the riskiest and go last.

Each entry gives delivery / targeting / effect, the role it plays, what it
answers, and its extensions. Extensions are weapon-locked cards that
compete with universal gems for the same sockets (§5).

> **Three extensions ship per weapon** (settled 2026-08-08), each
> levelling to 3 and then leaving the card pool permanently. The entries
> below list **four candidates each** — the Phase 6 batch that builds a
> weapon picks its three, and the fourth stays on the page as a designed
> replacement if one of the three proves weak in play. That is a content
> detail better decided with the weapon running than on paper, and having
> a spare already designed is worth more than picking now.
>
> **Extension levelling, and why the owner's rule is better than the
> options offered:** an extension maxed at level 3 is **removed from the
> pool entirely — no card, no drop, no orbital trade ship.** That kills
> the 2026-08-05 playtest's *"cards appear to do nothing"* finding at the
> root, since a plateaued card can never be offered. It also means a long
> run actively shrinks its own extension pool toward what it has not
> taken yet, which is a dilution fix falling out of a legibility fix.

### The six that exist

**7.1 · Bolt Turret** ⚡ — *projectile / nearest frontier / clear*
The reliable floor. High rate, small hits, no drama. **Armor is its
natural enemy** and that is now an identity rather than a weakness: Bolt
is the weapon most transformed by Detonation or Penetration.
*Signature: Velocity.*
**Extensions:** Twin Barrel (alternating second barrel) · Heavy Slug
(slower, much bigger hits — the built-in armor answer) · Overcharge (every
5th shot at triple power) · Tracking Rounds (mild homing).

**7.2 · Orbiting Blades** 🗡️ — *orbital / self-centred / clear*
Top DPS in the game and the worst armor profile in the game (~18 hits/sec
at level 8, each shredded by flat reduction). Defensively positioned by
accident of geometry. *Four attributes (§6): Power · Orbit Speed · Orbit
Radius · **Blade Count** — the owner's own example of a weapon whose level
should obviously mean "more blades."*
**Extensions:** Counter-Rotation (a second ring spinning the other way) ·
Serration (damage ramps while it stays on one target) · Whirl (blades
flare outward briefly on hit) · **Bladestorm** (orbit speed spikes for two
seconds after a coagulant dies) — *the last replaces Blade Count, promoted
to an attribute.*

**7.3 · Chain Bolt** 🔗 — *chain / frontier → nearby / clear*
The multi-target answer; **the Mote swarm counter by design.**
*Four attributes: Power · Rate · Forks · **Arc Range**.*
**Extensions:** Conductive (hops prefer denser cells) · Backlash (final
hop hits double) · Split Arc (hops can branch) · **Static Buildup**
(damage *increases* per hop instead of decaying) — *the last replaces Arc
Range, promoted to an attribute.*

**7.4 · Frost Nova** ❄️ — *pulse aura / self-centred / clear + freeze*
17 DPS at level 8 against Blades' 534 — a 31× spread that is a balance
problem only while Frost is read as a damage source. §13's fix stands:
**Frost is a setup weapon**, and the Shatter gem (§9C) is what makes that
true. *Signature: Radius.*
**Extensions:** Freeze Duration · Chill Field (permanent slow aura) ·
Shatter Core (frozen coagulants take bonus damage natively) · Rime
(freezing also suppresses regrowth).

**7.5 · Caustic Cloud** ☠️ — *placed persistent / frontier / DoT*
Area denial and attrition; the only weapon that keeps working after it
stops firing. *Signature: Duration.*
**Extensions:** Cloud Radius · Corrosive (strips armor from coagulants
inside) · Lingering Spores (cloud drifts outward) · Twin Canister.

**7.6 · Homing Missile** 🚀 — *homing projectile / frontier / clear + AoE*
Currently the game's only burst, and too weak to be it.
*Signature: Blast Radius.*
**Extensions:** Salvo (2–3 per volley) · Bunker Buster (bonus vs high
armor) · Proximity Fuse (detonates early near coagulants) · Cluster
Warhead.

### The twelve new

**7.7 · Lance** 🔆 — *charged beam / highest-mass target / clear, pierces the line*
**The single-target answer the game does not have.** Charges for
1.5–3s, then fires one enormous piercing beam at the biggest coagulant in
range, damaging everything along the line. One huge hit means Decision
44's flat armor reduction is nearly irrelevant to it — armor 20 off a
power-400 beam is noise.

This is the parked **Scalpel/Lance** from §13, revived. It was shelved
because its justification was artery-cutting, which died with the no-aim
correction, and because it needed "calcified tissue blocks projectiles" to
be interesting. **It no longer needs either.** Its justification is armor,
which now exists, and auto-targeting the largest threat requires no
aiming. *Signature: Charge Rate.*
**Extensions:** Piercing Core (ignores armor entirely up to a cap) · Twin
Lance (two beams at reduced power) · Afterglow (the line stays hot as a
DoT) · Overcharge (longer charge, superlinear power).
**Answers:** Behemoth, Sclerotic, Bulwark (punches *through* the wall into
what it escorts).

**7.8 · Siege Mortar** 💥 — *lobbed arc / densest point in range / clear + heavy AoE*
Long cooldown, huge shell, lands on **the densest point it can reach** —
not the nearest. The first weapon that deliberately shoots *past* the
fight. **The wilderness-reservoir answer**: §9's whole problem is mass
accumulating on ground nothing reaches, and this is the thing that reaches
it. *Signature: Range.*
**Extensions:** Blast Radius · Barrage (three shells walking outward) ·
Airburst (splits above the target) · **Seismic** (leaves a crater that
suppresses regrowth — terrain modification).
**Answers:** wilderness reservoir, Behemoth-from-neglect, Carrier
prevention.

**7.9 · Shockwave** 🌊 — *expanding ring / self-centred outward / clear + displace*
A ring that expands from the core and damages everything it passes
through. Hits the whole near field at once, in every direction — no
targeting decision, no direction to be wrong about. *Signature: Ring Reach.*
**Extensions:** Second Wave · **Knockback** (shoves coagulants outward) ·
Resonant Ring (damage scales with the density it crosses) · Implosion
(travels inward from max range instead).
**Answers:** Mote swarm, ambient near field, arrival pressure.

**7.10 · Fission Charge** 🎇 — *lobbed / scatter / clear, many hits over a wide area*
Lobs a charge that bursts into submunitions scattered across an area.
**The Blastoma answer, deliberately shaped:** a bag of blobs met with a
bag of bombs. Also the best ambient-field clear in the catalogue, and the
counter to an all-burst build's blind spot. *Four attributes: Power · Rate · Submunitions · **Blast Radius**.*
**Extensions:** Wider Scatter · Chain Fission (submunitions split again) ·
Sticky (submunitions land and burn) · Focused Pattern (tight cluster —
converts it into single-target).
**Answers:** Blastoma, Mote swarm, ambient field.

**7.11 · Immolation Ring** 🔥 — *persistent ring at the perimeter / positional / DoT*
**Built from Ward Pulse** (settled 2026-08-08). `systems/ward.ts` already
is this weapon in all but name — a periodic `clearAt` on a tower-centred
radius — but it has been misfiled as a *passive* since the port, which is
why it never got a visual (a standing BACKLOG bug) and why it is the one
weapon whose `clearAt` call still does not pass `coagulantMult` despite
Decision 50 updating every other call site for exactly that reason.
Promoting it resolves all three at once and gives this weapon working code
to start from rather than a blank file.
**Fills the "nothing is defensively positioned" gap head-on.** A burning
ring sits at the perimeter and damages anything crossing it. It has no
targeting stage at all — it is a *line*, and everything in the game must
eventually cross it. Always relevant, never bursty.
*Signature: Ring Radius.*
**Extensions:** Flare (periodic outward pulse) · **Backdraft** (damage
scales with how much mass is crossing right now — density scaling) · Ash
(burnt cells regrow slower) · Second Ring.
**Answers:** Sclerotic (which forms *inside* the guard, where a ring
already is), arrival pressure, breach damage.

**7.12 · Cauterizer** 🩹 — *sweeping beam / frontier arc / clear + sterilize*
Sweeps a beam across an arc of the frontier. Modest damage; the point is
that cells it burns are **sterilised** — regrowth suppressed for several
seconds. The first weapon whose value is measured in ground held rather
than mass removed. *Signature: Sterile Duration.*
**Extensions:** Wider Sweep · **Deep Burn** (sterilisation also *reduces*
maturity) · Scorch (leaves a DoT) · Full Circle (360° sweep).
**Answers:** ambient regrowth, vein corridors, Carrier prevention.

> **The tension worth designing around:** 4A's rule is *"you scar what you
> clear."* A weapon that clears hard also hardens the ground it clears —
> so Cauterizer's *Deep Burn* is genuinely double-edged in a way the
> player can feel, and it is the reason the extension exists.

**7.13 · Solvent Sprayer** 🧪 — *sprayed cone / densest nearby / no damage; softens*
**Deals no damage.** It lowers `resistance` and reduces `maturity` in an
area, so everything else hits harder there. A pure force multiplier, and
**the only answer in the game to the scar-ring-oppression risk** — it
makes the player's own hardened kill zone soft again.
*Signature: Potency.*
**Extensions:** Deep Solvent (also strips coagulant armor) · Wide Nozzle ·
Catalyst (solvent-soaked cells yield bonus XP when cleared) · Persistent
(the softening lingers).
**Answers:** the scar ring, Bulwark, Sclerotic, dense walls generally.

**7.14 · Resonance Coil** 📡 — *aura field / self-centred / clear, scaled by density*
**The gap §13 said matters most.** Damage scales *with* local density
instead of against it: near-useless on thin field, devastating on a wall.
It inverts `clearAt`'s resistance curve, and it is the only weapon in the
game that would rather fight in a mature field than a clean one.
*Signature: Scaling Curve.*
**Extensions:** Harmonic (also scales with maturity) · Sympathetic Pulse
(fires when another weapon hits) · Feedback (dense cells damage their
neighbours) · Standing Wave (the resonance persists briefly).
**Answers:** Bulwark, the dense near field, a losing run — it is the
comeback weapon, strongest exactly when things are worst.

**7.15 · Repulsor** 🌀 — *field pulse / self-centred / displace, no damage*
Pushes grid density outward and shoves coagulants back. Destroys nothing.
**Fills the displacement gap and conserves mass by construction** — which
means it satisfies Rule 2 for free, since there is no mass to account for
that did not simply move. *Signature: Force.*
**Extensions:** Sustained Field (continuous rather than pulsed) · Anchor
(pushed coagulants stay slowed) · Pressure Wave (displaced density damages
what it is pushed into) · **Vortex** (pulls *inward* instead).
**Answers:** Behemoth (slows are its listed counter), arrival pressure,
breach prevention.

> ⚠️ **Vortex is deliberately dangerous.** Concentrating mass at a point
> is exactly the precondition the formation flood-fill reads (Decision 43)
> — a Vortex build can manufacture its own Behemoth. That is either the
> best extension in the catalogue or a trap that has to be cut; it needs
> a playtest, not an argument.

**7.16 · Antibody Swarm** 🐝 — *autonomous summons / densest cell anywhere / clear*
Fills the summon delivery gap. Units spawn, travel to the densest cells
**anywhere on the map**, chew, and die. They work while the turret is busy
near-field, and they are the only thing besides Mortar that touches the
wilderness reservoir. *Four attributes: Power · Swarm Size · Lifespan · **Travel Speed**.*
**Extensions:** Faster Regeneration · Hunter-Killer (prioritise
coagulants) · Splitting (dying units split) · Nest (a persistent forward
spawn point).
**Answers:** wilderness reservoir, Carrier prevention, distributed field.

**7.17 · Mycelium** 🍄 — *counter-growth field / seeded at frontier / field vs field*
The most novel weapon in the catalogue and the most technically dangerous.
A friendly growth field that competes with the infection for cells,
converting infected ground into tissue that blocks regrowth. It makes the
game's central system — a spreading field — into a weapon.
*Signature: Spread Rate.*
**Extensions:** Deep Roots (converted cells resist reinfection) · Bloom
(periodically damages infection it touches) · Symbiosis (friendly cells
yield XP over time) · Rapid Culture.
**Answers:** ambient field, regrowth, ground denial.

> **Ship this last.** It needs a second field with its own reaction-
> diffusion pass, which means the `D * step <= ~0.25` divergence trap
> (CLAUDE.md's first sharp edge) applies to it too — and it doubles the
> per-tick field cost. If the catalogue trims to fifteen, this is the
> first cut.

**7.18 · Marker Beacon** 🎯 — *tag / highest-threat coagulant / debuff, no damage*
Marks a coagulant. The mark **strips armor and amplifies all incoming
damage** from every source. Fills the debuff effect gap and is the
purest enabler in the catalogue — worthless alone, multiplicative with
everything. *Signature: Mark Count.*
**Extensions:** Contagion (mark spreads to nearby coagulants) ·
Vulnerability (marked kills yield bonus XP) · Painted Target (marked
targets are slowed) · Broad Spectrum (can mark field regions, not only
coagulants).
**Answers:** Sclerotic, Bulwark, Behemoth.

> **It does not redirect targeting** — that stays the Threat Priority gem's
> job (Decision 45), and keeping them separate means the two *combine*
> into "mark the biggest thing and make everything shoot it" rather than
> overlapping into one redundant mechanic.

---

## 8. Coverage matrix

Primary answers in **bold**; secondary in plain text. The purpose of this
table is to find holes, not to show off breadth.

| Threat | Weapons | Gems |
|---|---|---|
| Mote swarm | **Chain**, **Fission**, Shockwave, Blades | Multishot, Chaining, Culling |
| Congealer | **Bolt**, **Blades**, Poison, Resonance | Amplifier, Overclock |
| Behemoth | **Lance**, **Missile**, Mortar, Repulsor, Marker | Giant-Slayer, Detonation, Penetration |
| Blastoma | **Fission**, **Shockwave**, Frost, Poison | Splash, Culling, Multishot |
| Carrier | **Cauterizer**, **Antibody**, Mortar, Mycelium | Vigilance, Sterilizer |
| Sclerotic | **Lance**, **Immolation**, **Marker**, Solvent | **Penetration**, Corrosion, Detonation |
| Bulwark | **Solvent**, **Resonance**, **Fission**, Lance, Blades | Pierce, Saturation, Threat Priority *(off)* |
| Ambient field | **Cauterizer**, **Fission**, **Mycelium**, Shockwave | Expansion, Scattershot |
| Wilderness reservoir | **Mortar**, **Antibody**, Cauterizer | Vigilance, Scattershot |
| Vein corridors | **Cauterizer**, **Lance**, Chain | Pierce, Breach Priority |
| Scar ring / maturity | **Solvent**, Cauterizer *(Deep Burn)*, Resonance *(Harmonic)* | **Virulence**, Saturation |
| Arrival / breach | **Immolation**, **Repulsor**, Shockwave, Frost | Inversion, core gems |

**No empty rows, and no row answered by only one thing.** The thinnest is
*scar ring / maturity* — three weapons and two gems, all of which are in
the back half of the shipping order. That is the row to watch, because it
is also the row tied to the design's own risk #4.

**On the owner's two explicit requirements:**

- **Single-target DPS** — Lance (burst), Missile (burst), Mortar
  (delayed burst), Bolt + *Heavy Slug*, Fission + *Focused Pattern*,
  Blades + *Serration*. Six routes, and the Detonation gem converts a
  seventh from any high-rate weapon.
- **Proper AoE** — Fission, Shockwave, Immolation, Mortar, Frost,
  Resonance, Missile. Seven, against the two the game has today, which
  closes the BACKLOG's *"More AoE weapons"* item outright.

---

## 9. Support gems

**Sixty-five across six classes**, expanded from revision 1's 46 at the
owner's request (*"if we can increase this amount up to let's say 50 in
total we would be good for many many builds"*). **This is the half of the
system the owner expects to be the most fun, and classes B and E are where
that lives.**

**Gems do not level** (settled 2026-08-08), unlike extensions. A gem's
power is what it does, not a number — and keeping 65 gems at one state
each avoids 195 gem-level combinations in a pool that is already the
largest thing in the design. Duplicate gem cards stay useful because the
same gem may be socketed in several different weapons (§5), so a second
Amplifier is a second Amplifier rather than a dead card.

**The outlet for a gem that turns out useless is the orbital trade ship**
— the owner's own idea from the 2026-08-06 session, now given a concrete
job: trade in gems you cannot use for ones you can. It stays parked for
Phase 6/7 (settled 2026-08-08), which has a consequence recorded honestly
in §11 and §14.

> ⚠️ **Sixty-five gems is past a threshold Decision 41 already named**:
> *"the gem half of the card pool grows every time the project ships a new
> gem, and unlike weapons it is not deck-bounded. Fine at 15 gems, **a
> problem at 60**."* The fix it parked — a deck-relevance filter on the
> pool — was **declined for Phase 5** in favour of measuring the real
> dilution first. See §11 for what that leaves standing and §14 for the
> risk it carries.

### A · Amplifier gems — the numeric floor *(6)*

The dissolved passives (§13: *"Amplifier → a +damage support gem,
Overclock → +attack speed"*), plus the obvious scalars.

| Gem | Effect |
|---|---|
| **Amplifier** | +damage |
| **Overclock** | +fire rate |
| **Expansion** | +area / radius |
| **Extension** | +duration (clouds, freezes, summons, marks) |
| **Velocity** | +projectile / travel speed |
| **Attunement** | +damage, scaled by the enhancement points invested in *this* weapon |

These are the boring ones on purpose. Every system needs a floor that is
never a wrong pick.

> **Reach was cut**, on the owner's call: *"it has no point apart from
> extending orbiting things, but that job can be assigned to Expansion."*
> Correct, and the reason is structural — in a no-aim autoshooter every
> weapon targets the nearest frontier, so "range" only means anything for
> the three weapons that deliberately shoot *past* the fight (Mortar,
> Antibody, Cauterizer), and all three already carry range as their
> signature attribute. Reach was doing two jobs badly, both covered
> elsewhere.
>
> **Attunement replaces it**, and is the one amplifier that is not flat:
> it pays out proportionally to how deep you have gone on a weapon, so it
> is the gem that rewards the specialise-vs-spread decision §5's socket
> thresholds create. The amplifier class gets a member that argues with
> the rest of the build instead of just adding to it.

### B · Behaviour gems — add a mechanic *(14)*

| Gem | Effect | Notable on |
|---|---|---|
| **Multishot** | +N simultaneous emissions, spread | Missile, Bolt, Fission |
| **Echo** | fires again shortly after at reduced power | anything with a long cooldown |
| **Pierce** | passes through targets instead of stopping | Bolt, Lance |
| **Fork** | splits on first impact | Bolt, Missile |
| **Chaining** | arcs to a nearby target after resolving | anything — makes Chain's identity universal |
| **Splash** | adds AoE to a point effect | Bolt, Lance |
| **Homing** | grants tracking | Fission, Mortar |
| **Ricochet** | damages again on a return path | Bolt, Lance |
| **Barrage** | one big shot becomes a rapid burst of small ones | *deliberately a trap against armor* |
| **Formation** | emissions arrange in a fixed pattern — ring, line, arc — around the target instead of converging on it | Missile, Fission — turns single-target into coverage |
| **Overflow** | damage past what kills a coagulant carries to the next nearest instead of being wasted | Lance, Missile, any burst |
| **Kickback** | every hit also shoves the target back slightly | universal cheap control |
| **Bounce** | the emission ricochets between coagulants rather than stopping | Bolt, Fission |
| **Priming** | the first hit on a target not hit recently deals far more | *anti-synergy with Fixation, by design* |

**Barrage is intentionally a bad pick in some builds** — it is the exact
inverse of Detonation, and putting both in the pool means the player has
to understand armor to choose correctly. That is a card doing its job.

**Priming and Fixation (§9D) actively fight each other**, and that is the
point: one rewards spreading fire across fresh targets, the other rewards
never switching. A pool where some cards are wrong *next to specific other
cards* is a pool where socketing is a decision.

**Formation is lifted from Noita**, where multicast formations are one of
the two mechanics that generate the game's famous emergent wands. It works
here for the same reason: it changes *where* emissions go without touching
what they are, so it composes with everything in classes A and C.

### C · Conditional gems — situational, and therefore valuable *(11)*

| Gem | Effect |
|---|---|
| **Penetration** | subtracts flat armor — Decision 44 called this one "obvious and load-bearing" |
| **Shatter** | bonus damage vs frozen targets |
| **Saturation** | bonus damage scaled by local density |
| **Virulence** | bonus damage against high-maturity ground |
| **Giant-Slayer** | bonus vs high-mass coagulants |
| **Culling** | bonus vs low-mass; instantly finishes near-dead coagulants |
| **Corrosion** | hits stack a lasting armor reduction on the target |
| **Sterilizer** | hits also suppress regrowth briefly |
| **Desperation** | damage scales up as core integrity drops |
| **Momentum** | damage ramps while the weapon keeps landing hits; resets on a miss or a kill |
| **Proximity** | bonus damage the closer the target is to the core |

**Desperation and Proximity are both comeback gems**, and both are
genuinely dangerous to build around — Proximity in particular pays you for
letting things get close, in a game where close means the core is taking
damage. That is the most interesting kind of situational: a gem that is
strongest exactly when you are closest to losing.

**Shatter ships §13's "make frozen tissue brittle" fix and closes open
question #3** (*"what happens to `frozen`?"* — it becomes a gem interaction
rather than a weapon-specific mechanic). Frost stops being a 17-DPS
embarrassment and becomes a multiplier enabler, which is a design fix
rather than tripling a number.

**Virulence and Saturation are the gems that answer the scar ring** — the
generic version of what Solvent and Resonance do as whole weapons.

### D · Targeting gems — replace the default *(8)*

Nearest-wins is the default (Decision 45). These replace stage 2, so at
most one per weapon — a constraint the pipeline enforces rather than an
arbitrary rule (§9E).

| Gem | Targets |
|---|---|
| **Threat Priority** | the highest-mass coagulant |
| **Field Priority** | the densest field region |
| **Breach Priority** | the deepest incursion toward the core |
| **Scattershot** | randomly within reach — coverage over focus |
| **Vigilance** | only outside the perimeter — starves the reservoir |
| **Fixation** | stays on one target until it dies |
| **Triage** | the *weakest* coagulant — finishes rather than starts |
| **Opportunist** | whatever another of your weapons hit most recently |

**Opportunist is the focus-fire engine.** Put it on three weapons and they
converge on whatever the fourth picks — which, combined with Marker Beacon
(§7.18), is how a player builds a deliberate assassination order without
ever being given an aim button.

**Triage is the Blastoma answer at the targeting layer**: a split leaves
fragments, and a weapon that hunts the weakest thing cleans them up
instead of re-engaging the biggest one.

**Threat Priority is the gem Carrier and Bulwark were shipped as a pair to
make interesting** (§10, Decision 69). Carrier makes it meaningful —
something that gets worse when ignored. Bulwark makes it a *tradeoff* —
threat-first sometimes feeds a wall while motes stream past. That
mechanism is now live in the game and waiting for this gem.

**Vigilance is the sleeper.** §9's wilderness-reservoir math says
unreachable ground is where behemoths come from; a gem that forbids your
weapons from shooting the easy near stuff is a real strategic commitment.

### E · Transformative gems — change what the weapon *is* *(14)*

**The owner's brief called these out specifically and then removed the
ceiling on them:** *"transformative gems can be as radical as you can
imagine — I think these kind of gems, especially in PoE, that change how
the attack works at the core is very fun and inspires many builds we
cannot even think of now."* That is a green light, and the list below took
it.

Each replaces a whole *stage* (§4), so each costs one implementation and
applies to all eighteen weapons.

| Gem | Stage | What it does |
|---|---|---|
| **Detonation** | resolve | Deals no damage on hit — it *accumulates*. Every few seconds the whole total lands as one hit. |
| **Sustained** | resolve | The inverse: discrete hits become a continuous low-power stream. |
| **Inversion** | resolve | No longer removes mass — displaces it outward. Zero damage, pure control. |
| **Culture** | resolve | Cells it clears leave friendly tissue that blocks regrowth for a while. |
| **Reclamation** | resolve | Much less damage; mass it destroys yields far more XP. |
| **Siphon** | resolve | Deals no damage to the field — *drains* mass and feeds it to the core as integrity. |
| **Fission Cascade** | resolve | A coagulant killed by this weapon bursts for a fraction of its remaining mass, damaging everything near it. |
| **Conversion** | resolve | Mass this weapon destroys does not die — it becomes a friendly autonomous unit that fights for you. |
| **Trigger** | deliver | This weapon deals no damage itself. On impact it *fires the weapon socketed below it*, at that point. |
| **Emplacement** | deliver | Detaches from the turret into a stationary auto-firing emplacement at the frontier. It can be destroyed. |
| **Orbital Conversion** | deliver | The effect happens on a body orbiting the core instead of firing outward. |
| **Sympathetic Link** | ready | Fires whenever the weapon in the slot above it fires. |
| **Metronome** | ready | Cannot fire freely. Fires on a fixed global beat shared with every other Metronome weapon, at hugely increased power. |
| **Overload** | ready | Double rate and double power; every shot costs core integrity. |

**The stacking rule falls out of the architecture rather than being
imposed:** each transformative gem declares the stage it replaces, and two
gems replacing the *same* stage cannot share a weapon. Detonation and
Sustained are mutually exclusive; Detonation and Emplacement are not. No
arbitrary "one transform per weapon" cap is needed, and the rule
documents itself.

**Detonation is still the best gem in the document.** Armor is flat
reduction with a 15% floor (Decision 44), so eighteen tiny hits per second
are shredded and one huge hit is untouched. Detonation converts the former
into the latter. **Blades + Detonation** takes the weapon with the worst
armor profile in the game and makes it the best anti-Sclerotic tool — the
same numbers, restructured. That is a build, discovered by the player, out
of two cards.

**Trigger is the one that generates builds nobody designed.** It is lifted
directly from Noita, where *Add Trigger* — cast the next spell at the
point of impact — is the single mechanic most responsible for that game's
emergent wands. It works here for the same structural reason it works
there: weapons are stages in a pipeline, not sprites, so "fire the next
one from here" is a coherent operation on any pair. Mortar → Trigger →
Frost Nova is a freezing artillery strike on the densest point in the
field, and nobody had to author it.

**Siphon inverts the game's economy.** A Siphon build *wants* a thick
field, because the field is now healing. Set against Rule 2 (damage dealt
is mass destroyed) it is the sharpest question in the gem list: mass
leaving the grid and entering the core as HP is a third container, and
§12 flags the conservation-invariant question it raises.

**Conversion and Fission Cascade both turn kills into more damage** —
chain-reaction builds, which is the fantasy the Blastoma roster entry
implies but nothing currently delivers.

**Emplacement still deserves suspicion.** It introduces position into a
game whose entire premise is that the player has none (§4's no-aim
correction, *"it has been violated twice and needed correcting both
times"*). Defensible — you choose to *deploy*, you never *aim* — but it is
the closest thing in this document to that line.

### F · Core gems — the dissolved passives, and more *(12)*

Socketed in the core's three slots. This is where §13's *"the core itself
gets gem slots… one unified system, one card category instead of two"*
lands.

| Gem | Effect | Replaces |
|---|---|---|
| **Vitality** | +max HP | passive `maxHp` |
| **Regeneration** | HP per second | passive `regen` |
| **Plating** | flat reduction on incoming damage | passive `armor` |
| **Magnetism** | pickup radius | passive `pickup` |
| **Avarice** | +XP | passive `xpGain` |
| **Ward** | a regenerating shield absorbing arrival damage | *(new — see note)* |
| **Perimeter Anchor** | enlarges the perimeter | — |
| **Reflex** | arrival damage is partly returned to the field | — |
| **Scholar** | +1 enhancement point every N levels | — |
| **Quarantine** | regrowth is slower inside the perimeter | — |
| **Adrenal Surge** | every weapon gains fire rate for a few seconds after the core is hit | — |
| **Salvage** | arrivals deal less damage but grant bonus XP | — |

**Perimeter Anchor is deliberately double-edged**, exactly as Decision 26
predicted range would be: a wider perimeter is a wider engagement zone, a
wider scar ring, and more armoured spawns. A straight upgrade that is
sometimes wrong.

> **The Ward name is reused, not inherited.** The existing `ward` passive
> is *Ward Pulse*, a periodic damage ring — it becomes **Immolation Ring**
> (§7.11), not this gem. The core gem called Ward is a genuinely new
> shield mechanic that happens to take the name back. Worth stating
> explicitly because revision 2 of this document listed Ward as
> "replacing passive `ward`", which would have quietly deleted a working
> weapon.

**Salvage and Adrenal Surge both pay out for being hit**, which makes a
genuine defensive-attrition build possible — take the arrival, bank the
XP, spike your rate. Nothing in the current game rewards failure at all,
and a roguelite usually wants one line that does.

### Class sizes

| Class | Count |
|---|---|
| A · Amplifier | 6 |
| B · Behaviour | 14 |
| C · Conditional | 11 |
| D · Targeting | 8 |
| E · Transformative | 14 |
| F · Core | 12 |
| **Total** | **65** |

---

## 10. Gem bundles

Decision 41: currency buys **thematic** bundles, not individual gems,
because a bundle name teaches a build. Nine, covering the catalogue:

| Bundle | Contains |
|---|---|
| **Core Systems** *(starting kit)* | Vitality, Regeneration, Plating |
| **Ballistics Package** | Multishot, Pierce, Velocity |
| **Ordnance Package** | Splash, Giant-Slayer, Detonation |
| **Cryogenics Package** | Shatter, Extension, Sterilizer |
| **Chemistry Package** | Corrosion, Virulence, Culture |
| **Targeting Suite** | Threat Priority, Field Priority, Breach Priority |
| **Doctrine: Attrition** | Sustained, Fixation, Reclamation |
| **Doctrine: Emplacement** | Emplacement, Orbital Conversion, Sympathetic Link |
| **Deep Field** | Attunement, Vigilance, Scattershot |
| **Cascade Package** | Trigger, Fission Cascade, Bounce |
| **Doctrine: Symbiosis** | Siphon, Conversion, Salvage |
| **Kinetics Package** | Kickback, Formation, Overflow |
| **Last Stand** | Desperation, Proximity, Adrenal Surge |
| **Precision Suite** | Priming, Triage, Opportunist |
| **Overdrive Package** | Metronome, Overload, Momentum |
| **Containment** | Quarantine, Sterilizer, Reflex |

Each name should make a player think *"I know what build that is"* before
reading the contents. **Ordnance Package** is where Detonation lives, so
the armor lesson arrives bundled with the tools to act on it, and
**Cascade Package** is where Trigger lives — the bundle most likely to
produce something nobody planned.

Sixteen bundles at three gems each covers 48; the remaining 17 (mostly
class A's floor and the first targeting gems) should be **unlocked from
the start**, so a new player has a working vocabulary before they own a
single bundle.

---

## 11. The card pool

§13 named pool dilution as the main risk of the whole arsenal direction:
*"20 weapons implemented naively makes the game worse… level-ups stop
being choices and become lottery draws."*

### The actual numbers, after the 2026-08-08 calls

Better than revision 2's worst case, because two decisions cut the pool
without anyone aiming at dilution:

| | Cards live in the pool |
|---|---|
| Extensions, 3-weapon deck | **9** — 3 weapons × 3 extensions, each contributing only its *next* level |
| Extensions, 6-weapon deck | **18** |
| Weapon gems | **53** |
| Core gems | **0** — moved to their own track |
| **Total, 3-weapon deck** | **62, drawn 4 at a time** |

Against revision 2's 89-drawn-3, that is a meaningful improvement, and it
came from **core gems moving to a separate track** and **extensions
contributing one card each rather than all their levels at once**.

### What is standing, and what was declined

**Standing:**

1. **The deck bounds the extension half** — decided long ago (§13).
2. **Maxed extensions leave the pool permanently** — the owner's rule
   (§7). A long run shrinks its own pool toward what it has not taken.
3. **Core gems draw from a separate track**, guaranteeing a defensive
   floor without competing for weapon cards.
4. **Four cards per level-up**, up from three (settled 2026-08-08:
   *"I feel it should be 4… the pool is massive now"*). The cheapest
   available dilution mitigation, and it maps onto a composition
   guarantee of *one extension · one gem · two wildcards*.
5. **Never offer a dead card** — no duplicates within a draw, no extension
   for an undecked weapon, no gem that cannot legally be socketed
   anywhere (§9E's same-stage exclusion makes this a real case).

**Declined for Phase 5:**

- **The deck-relevance gem filter** — *"ship without it, measure first."*
- **The orbital trade ship** — parked for Phase 6/7 as originally planned.
- **Gems levelling out of the pool** — gems do not level at all.

> **This is a deliberate choice to measure the worst case.** Phase 5 will
> ship with 53 weapon gems in an unfiltered pool and no escape hatch from
> bad luck. That is a legitimate way to find out how bad dilution actually
> is rather than pre-emptively fixing a number nobody has felt — but it
> means **the 5B gate is a genuine go/no-go on the gem count**, and the
> three declined fixes are the shelf it picks from. Recorded here so that
> a bad gate result reads as *expected information* rather than a failure.

### The bundle card

New, proposed by the owner 2026-08-08: *"maybe even having something
special like a bundle card every N levels, that offers more than one thing
if you pick it."*

**Sketch, for review:** every 5 levels the normal draw is replaced by a
bundle draw — three *packages* instead of four cards, each package holding
2–3 related cards, take one whole package. It is a pacing beat the
level-up loop currently has none of (BACKLOG: *"level-up has no moment"*),
it is a partial dilution answer because a pick is worth 2–3 cards instead
of one, and it lets the game hand out **coherent combinations** rather
than atoms — a package of *Detonation + Penetration* teaches the armor
lesson in one pick, which no single card can do.

It also mirrors the meta layer's gem bundles (§10), so "a themed group of
gems arriving together" is one idea the player meets in two places rather
than two ideas.

### One thing to keep resisting

Weighting extensions toward weapons with free sockets is tempting and
should be **resisted** — it quietly removes the player's agency over which
weapon to invest in, which is the decision §5's socket thresholds exist to
create.

---

## 12. What is settled, and what is left

Per `CLAUDE.md`'s ground-truth override protocol, **nothing below has been
written into `docs/DECISIONS.md` yet.** These go in as decisions when
Phase 5 actually starts, so the record is written against work that
happened rather than work that was planned.

**Headline: no decision is superseded.** Revision 1 proposed overriding
two clauses of Decision 40 and revision 2 one. After the 2026-08-08
review, **zero** — the owner's single-+/- model restored the legibility
clause, and choosing no cap and no diminishing returns restored the rest.
Socket-opening is a pure addition. The override protocol was never needed.

### Settled by the owner

| # | Settled | Where |
|---|---|---|
| 1 | Enhancement points **open sockets** at milestones | §5 |
| 2 | **One +/- per weapon**; a point raises all its attributes | §6 |
| 3 | **3 attributes default, 4 where a count is core** (Blades, Chain, Fission, Antibody) | §6 |
| 4 | **All 18 weapons ship** | §7 |
| 5 | Transformative gems have **no radicalism ceiling** | §9E |
| 6 | **Reach cut**, replaced by Attunement | §9A |
| 7 | Gem list grown past 50 — **shipped at 65** | §9 |
| 8 | Support weapons earn XP by **assist credit** | §12.1 |
| 9 | **Siphon converts at a loss**; mass stays booked as destroyed | §12.2 |
| 10 | **Extensions level to 3, then leave the pool permanently** | §7 |
| 11 | **Gems do not level**; the trade ship is the outlet for dead ones | §9 |
| 12 | **No deck-relevance gem filter in Phase 5** — measure first | §11 |
| 13 | Points **freely reassignable at any time**; no destructive respec | §5, §6 |
| 14 | **Gem inventory exists**; unsocketed gems are kept, never lost | §5 |
| 15 | **No weapon level cap, no diminishing returns** | §6 |
| 16 | **Penetration cannot push past Decision 44's armor floor** | §12.3 |
| 17 | Same gem **across weapons yes, twice in one weapon no** | §5 |
| 18 | Orbital trade ship stays **parked for Phase 6/7** | §11 |
| 19 | Starting kit: **Bolt, Chain, Poison** | §12.4 |
| 20 | **3 extensions per weapon** | §7 |
| 21 | Weapons have **no rarity or power tiers** | §12.5 |
| 22 | **Core gems draw from a separate track** | §5, §11 |
| 23 | **Four cards per level-up**, plus a **bundle card** every N levels | §11 |
| 24 | **Ward Pulse becomes Immolation Ring** — promoted from passive to weapon | §7.11 |
| 25 | **The level-up pause stays modal**; judge at the Phase 5 gate | §12.6 |
| 26 | **Phase 4's gate passed** — played by the owner 2026-08-08, *"all good"* | — |

### 12.6 · The modal level-up pause stays, for now

Decision 61 assigned this to Phase 5 — *"deliberately not done: removing
the modal pause on level-up… it belongs with Phase 5's card-pool
restructure"* — and this plan makes the interruption **larger**, not
smaller, by moving to four cards plus periodic bundle cards.

**Settled 2026-08-08: keep it modal and judge at the gate.** Decision 61
attached a condition to its own recommendation — *"the real fix **if
showers prove insufficient**"* — and gem showers have never actually been
judged insufficient. Removing the pause pre-emptively would be fixing a
problem on the strength of a prediction, which is the habit this project
has repeatedly found to be wrong (4A shipped four constants that had to be
retuned once the game was run).

Also worth stating plainly: in a no-aim game the pause interrupts nothing
the player was doing (§4, the premise correction in the 3D record). The
cost is dramatic, not mechanical — a behemoth's death getting buried under
UI — which is precisely the kind of thing a gate can judge and an argument
cannot.

**If the gate says it is bad**, the fix is non-modal cards in 5C, and the
cheaper intermediate step is making the bundle card *replace* a normal
draw rather than add to it.

### 12.1 · Assist credit — the mechanism this implies

Solvent, Repulsor and Marker destroy no mass, and XP *is* destroyed mass
(Decisions 42 and 61). Without this they would be traps.

**The rule:** when mass is destroyed against a target that is currently
marked, softened or displaced, a share of that XP is credited to the
weapon that set it up. XP stays tied to real destroyed mass, so the
economy's invariant is untouched — this is a *reallocation of credit*, not
a new source.

**What it costs to build:** targets need to carry a short-lived record of
which weapons last affected them. That is new state on both coagulants and
grid cells, and it is the single largest hidden implementation cost in
this document. It belongs in 5B alongside the socketing model, not bolted
on during Phase 6 when the support weapons arrive.

### 12.2 · Siphon converts at a loss

Mass drained by Siphon is **booked as destroyed exactly like any other
kill**, and the core healing is a separate payout computed from it. Two
containers preserved (Decision 42), the conservation invariant guarding
every phase since 3C needs no changes, and the conversion rate is a clean
balance dial with no structural side effects.

### 12.3 · The armor floor holds both ways

Penetration reduces armor to zero and no further. Decision 44's 15% floor
stays a floor only. This protects the guarantee that made armor safe to
ship — *"a bad matchup, never a brick wall"* — from the other direction,
and stops a penetration stack from quietly deleting Sclerotic and
Bulwark's entire identity.

### 12.4 · Starting kit: Bolt, Chain, Poison

Single-target, multi-target, area denial — **the three tactical roles
rather than three delivery types.** A new player meets the threat model
faster this way: motes want Chain, a grind wants Bolt, ground you cannot
hold wants Poison.

**The cost, stated plainly:** no orbital in the starting kit, so
self-centred delivery is something the player unlocks rather than
something the game teaches. Orbiting Blades is the game's best weapon and
its clearest illustration of what a socket does, and it is now behind a
purchase. If early runs read as flat, this is the first thing to revisit.

### 12.5 · No weapon rarity

Every weapon is a different *question*, not a better one. Decision 39's
unlocks-only stance already says power comes from build rather than
acquisition; tiering weapons would re-create the permanent-power-from-
grinding shape it rejected, wearing a weapon's clothes.

### Left open, deliberately

| Question | Why it is not answered here |
|---|---|
| **How many enhancement points does a run actually produce?** | Needs measurement against the live XP curve, not an argument. The 0/3/8/15/24 socket thresholds are guesses until 5B runs. |
| **What N is, for the bundle card** | Same — a pacing number, tuned against a real level curve. |
| **Whether the inventory pauses the game** | Defaulting to yes, matching the level-up overlay. Revisit only if opening it becomes a way to stall. |
| **Exactly which 3 of each weapon's 4 candidate extensions ship** | Better decided with the weapon running (§7). |
| **How a gem's effect on a *specific* weapon is described in the UI** | A 5C build requirement rather than a design choice — but a load-bearing one. *Detonation on Blades* and *Detonation on Lance* are different sentences, and the 2026-08-05 playtest's "cards appear to do nothing" was a description bug in this exact project. |
| **`PASSIVE_DEFS` and `WeaponDef.maxLevel` disposal** | A 5B cleanup item. `maxLevel` is retired outright (§6); the passives migrate to core gems. |

### Still parked

**"Does calcified tissue block projectiles?"** stays in BACKLOG *Ideas*.
It is no longer needed to justify Lance (§7.7), which removes the main
argument for taking the risk. Worth prototyping in Phase 6 once
non-projectile delivery (orbital, aura, placed, summon) is broad enough
that a blocked projectile has alternatives — not before.

---

## 13. Phasing

**Phase 5 — Framework.** No new weapons, no new gems.

| Step | Work | Gate |
|---|---|---|
| **5A-0** | ✅ Audited the 23 weapon tests before touching anything — they turned out to already be outcome tests (asserting `state.projectiles`/`state.grid.growth`/`state.orbitals`, never mocking internals), so no rewrite was needed. The concern behind this step was real in principle but did not apply in practice; recorded honestly rather than manufacturing a rewrite to match the original prediction. | ✅ Confirmed, not rewritten |
| **5A** | ✅ **Shipped 2026-08-08 — Decision 70.** The four-stage pipeline (`weapons/pipeline.ts`). All **seven** weapons on it — the six in `weapons/` plus **Immolation Ring**, promoted from Ward Pulse (§7.11). **Zero behaviour change**, verified by the unmodified 23 tests, a live debug-harness run, and an identical production bundle size. Tower-centred radius guard extended to enumerate `bladeRadius`/`frostRadius`/`immolationRadius` directly. | ✅ 339/339 tests, typecheck clean, build clean, live-verified |
| **5B** | Enhancement points, per-weapon attribute curves, socket thresholds, gem instances and inventory, socketing model in `state.ts`. Passives dissolved into core gems on their own card track. Cards become extensions (levelling to 3, then removed) + gems. **Assist credit (§12.1)** — the hidden cost, and it belongs here rather than in Phase 6. | Mass/XP invariants hold; card-pool composition test; a maxed extension is provably never offered again |
| **5C** | Pause + inventory UI: one +/- per weapon, socket/unsocket, gems returning to inventory when a socket closes, four-card draws, the bundle card, and **per-weapon gem descriptions** (§12, the known failure mode). | — |
| **▶ GATE** | **Playtest the socketing loop**, and **judge the gem count.** Does the inventory screen get opened more than once? Is enhancement a decision or a slider? And how bad is dilution really, with none of the three declined fixes in place? | |

**Phase 6 — Content**, in batches, each independently playtestable.

| Step | Work | Why this order |
|---|---|---|
| **6A** | Gems: Amplifier (A) + Behaviour (B), ~15 | Validates the pipeline against the six weapons that already exist. If a gem needs a per-weapon special case here, 5A was wrong and it is cheap to find out. |
| **6B** | Weapons: Lance, Shockwave, Fission, Immolation | The four that need nothing beyond the pipeline. Also the four that most directly fix the owner's two named gaps — single-target and AoE. |
| **6C** | Gems: Conditional (C) + Targeting (D) | Threat Priority finally lands, against the Carrier/Bulwark pair already shipped. |
| **6D** | Weapons: Mortar, Cauterizer, Solvent, Resonance, Repulsor | Needs two new subsystems — persistent terrain modification and displacement. |
| **6E** | Gems: Transformative (E) | The combinatorial layer, on top of a catalogue broad enough to make it sing. |
| **6F** | Weapons: Antibody Swarm, Marker Beacon, Mycelium | Summons and a second field. The riskiest, and the first cuts if the catalogue trims. |

**Phase 7 (Meta)** then buys: weapon unlocks, turret slots, core sockets,
gem bundles. Unchanged from §17.

### Three audit findings, and how 5A closed them

Found 2026-08-08 by re-reading every doc against this plan before starting
work. None needed a design call; all three were work items, and all three
are now done.

**1. ✅ Fixed. The tower-centred radius guard did not guard the
weapons.** `tuning/weaponGeometry.test.ts` tested `towerCenteredRadius()`
generically and never enumerated a single weapon — so it proved the
helper was correct, not that anything called it. **That is precisely how
prototype bug #5 made Orbiting Blades unable to hit ambient infection at
any tier, any level, in any run**, while its own isolated tests kept
passing. A new test now enumerates `bladeRadius`/`frostRadius`/
`immolationRadius` — the actual functions each weapon calls — across
every level and a spread of perimeters, closing the exact gap that let
bug #5 happen.

**2. Still open, correctly deferred. `pickThree`'s shuffle is biased.**
`sort(() => Math.random() - 0.5)` is not a uniform permutation. The 5B
gate exists to **measure real card-pool dilution** (§11), and a skewed
shuffle would measure a distribution the game doesn't have. **Fix in 5B,
before the gate** — not 5A's scope, since no card pool exists yet to
measure.

**3. ✅ Fixed. Ward Pulse's `clearAt` call omitted `coagulantMult`.**
Harmless before 5A (every value defaulted to 1 either way), live the
moment Penetration exists. Resolved by the promotion to Immolation Ring —
its `clearAt` call now reads `WEAPON_DEFS.immolation?.coagulantMult`
exactly like every other weapon.

**Three more balance gaps surfaced during the promotion itself**, not
caught by the original audit: Ward Pulse's cooldown never divided by
`atkSpeedMult` (Overclock had no effect on it), its damage was never
multiplied by `damageMult` (Amplifier had no effect either), and its
`10 * lvl` formula never got Phase 4C-1's `WEAPON_DAMAGE_SCALE` (+50%)
pass. **All three preserved exactly as-is** — 5A's charter is zero
behaviour change, and "the weapon got stronger" is a different change
from "the architecture moved." One is pinned with a dedicated regression
test proving Overclock still has no effect. This is an open balance
question for the owner, not a bug — see Decision 70.

---

## 14. Risks

**1. The 5A refactor is the whole bet.** If the pipeline is not expressive
enough, every subsequent gem pays for it forever; if it is over-built, six
simple weapons carry abstraction they never use. Mitigation: it is
designed against the finished catalogue (§7), not against the six weapons
that exist. That is the entire reason this document precedes it.

**2. Phase 5 ships with dilution deliberately unmitigated.** 65 gems is
past the threshold Decision 41 itself named, and all three available fixes
were declined for Phase 5 — the deck-relevance filter, the orbital trade
ship, and gems levelling out of the pool. What remains is the deck bound
on extensions, maxed extensions leaving, core gems on a separate track,
and a fourth card per draw.

This is a considered choice to measure the real number rather than
pre-empt it, and it is recorded so a bad result reads as information. But
it means **the 5B gate is a go/no-go on the gem count**, and it should be
run knowing which shelf the fix comes off.

**3. Enhancement is a slider until proven otherwise.** No cap and no
diminishing returns is Decision 40 exactly as written, including the flaw
it recorded and accepted. The socket ladder is the only counterweight in
the design. If the gate shows it collapsing, Decision 40 already names the
fix — DR per weapon, not a cap.

**3b. Assist credit is the largest hidden cost in the plan** (§12.1).
Making support weapons pay XP means targets carry a short-lived record of
which weapons affected them — new state on coagulants *and* grid cells,
touching the hottest paths in the game. It is scheduled into 5B for that
reason. If it slips to Phase 6, Solvent, Repulsor, Marker, Inversion and
Siphon all ship as traps, and they will be mis-diagnosed as "these weapons
are bad" rather than "the credit system is missing."

**4. Eighteen weapons is a lot of tuning surface** on a game whose balance
pass is deferred to Phase 8. Accept that Phase 6 ships weapons that are
*interesting and roughly right*, not balanced — and that the 31× spread
between Blades and Frost is the standing proof that "roughly right" has
been wrong before.

**5. Solvent, Repulsor and Marker deal no damage.** Three weapons whose
value is entirely indirect, in a game that shows the player a damage
number and a survival clock. If they feel like doing nothing, the fix is
feedback and legibility, not damage — but that has to be built, not
assumed.

**6. Mycelium doubles the per-tick field cost** and inherits the
reaction-diffusion divergence trap (`D * step <= ~0.25`, silent `NaN`, no
thrown error). It ships last for exactly this reason.

**7. `frozen` finally gets resolved** by the Shatter gem, closing open
question #3 — but Frost's own numbers stay bad until then. Do not
rebalance Frost before 6C; the fix is the gem.

---

## 15. Ideas considered and rejected

| Idea | Why not |
|---|---|
| Bundles as the unit of *decking*, not just unlocking | Already rejected by the owner (Decision 41) — unforeseen mid-run combinations are the more interesting game |
| Separate socket pools for extensions and gems | Two UIs, two rules, and it removes the *specialise vs. generalise* question that shared sockets ask for free |
| Per-attribute point allocation (revision 1's model) | The owner's single +/- is better: one control per weapon keeps the screen readable, restores Decision 40's legibility, and makes attribute *count* free — which is what lets Blades have four |
| Six-plus attributes per weapon | Even descriptively, a wall of numbers stops communicating. Three, four where a count is core |
| An arbitrary "one transformative gem per weapon" cap | Unnecessary — §9E's same-stage exclusion falls out of the pipeline and documents itself |
| Weighting the card pool toward weapons with free sockets | Quietly steers investment, removing the decision §5's thresholds exist to create |
| A weapon that "cuts" veins at a chosen point | Died with the no-aim correction (§4) and stays dead |
| Making Marker Beacon redirect all targeting | Duplicates Threat Priority. Kept separate so the two *combine* rather than overlap |
| Permanent stat upgrades from meta currency | Decision 39 — compounds the 17–21× scaling problem the rework exists to fix |
| Rerolls / banishes in Phase 5 | Not until the pool is real enough to feel bad. Judge at the gate |

---

*Written 2026-08-07, revised 2026-08-08 after the owner's review. Research
inputs beyond the project's own records: Path of Exile 2's support-gem
model, including the 0.3.0 change allowing a support type across multiple
skills but never twice in one skill (§5's duplicate rule); Nova Drift's
mod system, whose transformative weapon-mods are the closest existing
analogue to §9E and the reason that class is worth the pipeline it costs;
and Noita's wand modifiers, which supplied **Trigger** and **Formation**
(§9B, §9E) — the two mechanics most responsible for that game's reputation
for builds its designers never authored, and both of which only work here
because §4 turns weapons into stages rather than sprites.*
