# The Socket Arsenal

**A portable design for build-craft weapon systems.**

This document is deliberately **game-agnostic and engine-agnostic**. It
describes a system that was designed, built, shipped and playtested in
Slime TD (see `docs/POSTMORTEM.md`), extracted from that game's specifics
so it can be rebuilt somewhere else. Where a Slime TD detail is mentioned
it is marked as an example, not as part of the design.

Nothing here requires TypeScript, a canvas, or a tower-defense loop. It
requires only that the game has **weapons or abilities that fire, and
things they affect.**

---

## 1. What this system is for

The design goal, stated as a question the system must answer *yes* to:

> **Is enhancement a decision, or a slider?**

A slider is "+10% damage," picked because there is nothing better. A
decision is "this changes what the weapon *does*, and it commits me." A
build-craft game lives or dies on the ratio between the two, and most
upgrade systems drift toward sliders because sliders are trivial to
author and trivial to balance.

This system's core bet is that the ratio is an **architectural** property,
not a content property. If the architecture only has a hook for "multiply
a number," every gem will be a number. Give it four different hooks at
four different points in a weapon's execution, and the content follows
the architecture.

The bet paid off. It is the one part of Slime TD judged worth keeping.

---

## 2. The foundation: one pipeline, four named stages

**Every weapon in the game is the same function, walked in four stages.**
No weapon has its own update loop.

| Stage | Question it answers | Owns |
|---|---|---|
| **READY** | Does this weapon act right now? | Cooldown, charge, resource cost, wind-up |
| **ACQUIRE** | What is it aimed at? | Target selection — *omitted entirely* for self-centred weapons |
| **DELIVER** | What is emitted? | Spawning the projectile / beam / cloud / pulse; count and geometry of emissions |
| **RESOLVE** | What happens where it lands? | Damage application, status effects, on-hit consequences |

Two structural rules make this work:

- **A weapon may omit ACQUIRE.** An aura or a self-centred pulse has
  nothing to acquire — the origin is always the caster. This is not a
  special case to work around; it is a legitimate shape, and it is what
  makes "a Targeting gem has nothing to replace here" a *meaningful*
  statement rather than a bug.
- **RESOLVE is reached by two different paths.** Instant weapons resolve
  inside DELIVER. Weapons that spawn a travelling entity resolve later,
  in shared downstream code, when that entity lands. **This split is the
  single richest source of bugs in the whole system** — see §8.1.

### Why four stages and not "an upgrade interface"

Because each stage is a different *kind* of hook, and that difference is
what stops every gem from being a multiplier:

- Hooking **READY** changes when you fire.
- Hooking **ACQUIRE** changes what you fire at — and can *replace the
  stage wholesale*, which is the strongest kind of upgrade in the system.
- Hooking **DELIVER** changes how much comes out and in what pattern.
- Hooking **RESOLVE** changes what a hit means.

A designer authoring content against four named hooks naturally produces
four flavours of upgrade. A designer authoring against one `applyMod()`
produces one.

---

## 3. Archetypes: the abstraction that makes content cheap

Every weapon declares exactly one **delivery archetype**. Slime TD shipped
six: `projectile`, `orbital`, `pulse`, `cloud`, `ring`, `beam`.

Every gem declares which archetypes it supports — **never which weapons.**

This is the difference between an N×M problem and an N+M problem, and it
was measured, not assumed: **adding a sixth archetype cost about six touch
points in the gem tables**, not a rewrite. Adding a weapon of an existing
archetype costs *zero* gem work — it inherits every gem, every socket
line, and every legality rule for free. This was confirmed live: three
weapons added in one batch needed no new UI code at all.

**The rule:** if you find yourself writing `if (weapon === 'flamethrower')`
anywhere outside that weapon's own file, the archetype set is wrong.
Either the weapon is a new archetype, or the thing you're special-casing
belongs in the archetype's definition.

Pick archetypes by **how the effect reaches the target**, not by theme or
by damage type. "Fire" is not an archetype. "A thing that travels and
stops on impact" is.

---

## 4. The gem taxonomy

Six classes. The class names are functional, and the player never needs to
see them, but authoring against them keeps the content honest.

### A · Amplifier — the numeric floor *(~6 gems)*

Flat multipliers: damage, rate, area, duration, velocity, and one that
scales with investment already made in the weapon.

**These exist on purpose and should not be designed away.** They are the
floor that makes a draw never feel wasted, and the baseline against which
every interesting gem is priced. Keep the class small.

**Combining rule that matters:** deltas are collected as additive terms
and applied as `1 + sum`, so two Amplifiers combine *additively*, not
multiplicatively. Multiplicative stacking of a class this large produces
runaway builds immediately.

### B · Behaviour — add a mechanic *(~14 gems)*

Pierce, Fork, Chaining, Bounce, Homing, Ricochet, Multishot, Formation,
Echo, Barrage, Splash, Overflow, Kickback, Priming.

The class that carries most of the system's character. Split across
DELIVER (how many emissions, in what pattern) and RESOLVE (what a hit
does).

Two design notes worth preserving:

- **Multishot and Formation are the same count bonus with different
  geometry** — Multishot jitters the spread, Formation locks it to fixed
  symmetric offsets. Mechanically distinct, cheap to author, and they read
  differently in play. A good template for "one more gem" that isn't
  filler.
- **Barrage is a deliberate trap** — it converts one shot into many
  smaller ones, which is *worse* against flat armour reduction. Content
  that is wrong in a specific, learnable situation is more interesting
  than content that is uniformly mediocre.

### C · Conditional — situational, and therefore valuable *(~9–11 gems)*

Bonus damage keyed on target or player state: armour penetration, bonus
vs. high-mass targets, bonus vs. low-mass targets, bonus vs. hardened
terrain, bonus vs. dense terrain, bonus at low health, bonus at close
range, a ramping streak bonus, an armour strip.

All of them are RESOLVE-stage. **This class is nearly free to author** —
they read only target state or player state, never anything
archetype-specific, so they are legal on everything with no refusal table
at all. Highest content-per-unit-of-work in the system.

Two rules found the hard way:

- **Resolve once per hit, not per affected unit**, for anything that
  can't vary within a single hit (player health, distance from origin).
  Folding it into the hit's power once is both cheaper and correct.
- **Threshold-style finishers should key on a fraction of the target's
  *own* starting size**, not an absolute. An absolute threshold deletes
  small targets on sight and does nothing to large ones.

### D · Targeting — replace the default *(~7–8 gems)*

Target the biggest threat, the weakest, the deepest incursion, the densest
ground, whatever was hit last, or lock onto one target until it dies.

**This class replaces ACQUIRE wholesale** — it is the only class that
substitutes a stage rather than modifying one. Consequences:

- **At most one Targeting gem per weapon.** You cannot replace a stage
  twice. Enforce at socket time, not in the UI.
- **A weapon's built-in special targeting should be implemented as one of
  these gems, "built in"**, routed through the same dispatcher. Two
  parallel implementations of "target the biggest thing" will drift.
- This is the class with **real refusals** (see §5).

### E · Transformative — change what the weapon *is* *(~14 gems)*

Designed in full, never built. The intended top of the ladder: a gem that
converts a weapon into a different weapon rather than improving it.
Recorded here as the acknowledged gap — the system was proven without
them, and they are the obvious next place to look for depth.

### F · Core — global, not per-weapon *(~12 gems)*

The dissolved passives: max health, regeneration, pickup radius, and so
on. They go into a small number of **fixed** slots on the player/core
rather than into a weapon.

**One non-obvious rule, learned from a live exploit:** a core gem's effect
must apply at **socket time**, not at pick-up time, and removing it must
clamp derived values. Un-socketing a max-health gem has to bring current
health down with it, or the player has a free permanent buff for the cost
of one socket-then-unsocket.

---

## 5. Refusal vs. reinterpretation

The most important content directive in the system, and it was a
correction made mid-build:

> **Don't just not give the player gems.**

The naive approach is a legality matrix: this gem is illegal on that
weapon. The result is dead draws, a growing table nobody can hold in their
head, and — worse — content that gets *narrower* as the roster grows.

The approach that worked: **every gem gets a real, distinct reading on
every archetype unless the reading would be a no-op or a duplicate of
another gem.**

Examples of reinterpretation carrying real weight:

| Gem | on a projectile | on an orbital | on an aura/pulse |
|---|---|---|---|
| **Pierce** | passes through targets | removes the per-blade hit cooldown | ignores density resistance |
| **Fire rate** | shorter cooldown | faster re-hit on the same patch | shorter pulse interval |
| **Homing** | steers mid-flight | biases toward the threatened side | offsets the pulse centre |
| **Threat Priority** | targets the biggest | *(as aura)* bonus damage to the biggest thing hit | same |

**Refuse only for these two reasons**, and record which one applies:

1. **It would be a guaranteed no-op.** Example: a gem meaning "only act
   outside the perimeter" on a weapon whose radius already floors outside
   the perimeter. This is a silent dead socket — the exact failure the
   system exists to prevent.
2. **It would duplicate another gem's reading on that archetype.** Two
   gems that both mean "spin faster" on the same weapon is the "this card
   does nothing" bug wearing a second name.

**And the corollary rule, which was violated once and cost a whole
batch:** if a gem's *description* claims a reading on an archetype, the
*mechanism* must exist on that archetype. Four gems shipped with honest,
evocative descriptions of readings that were not wired up on six of ten
weapons. It took a dedicated later batch to make the text true. Either
wire it or refuse it — never write the copy first.

---

## 6. Sockets and the economy

### Two independent lines per weapon

- **Extensions** — bound to one specific weapon, define its identity,
  level up (1→3) rather than being duplicated.
- **Support gems** — free-floating, socket into any archetype-legal
  weapon.

**They must not compete for the same sockets.** This was designed as a
shared pool, shipped as a shared pool, and reversed after review: a shared
pool means every identity-defining upgrade is priced against a generic
one, and the generic one usually wins. Two lines, two ladders.

### The investment ladder

Sockets open as points are invested in that weapon, on a per-line ladder
(Slime TD: extensions at 5 and 10 points; gems at 0/3/8/15/24). This makes
investment itself a decision — spread thin across the roster, or go deep
on one weapon and open its fifth socket.

### Rules that are worth copying verbatim

- **No destructive respec, ever.** Everything un-sockets back to
  inventory, always. Removes a whole category of player anxiety at zero
  design cost.
- **Everything banks.** A gem with nowhere to go goes into inventory
  rather than being filtered out of the draw. The alternative — gating the
  draw on free sockets — produces a **dead pool** the moment a player
  fills up, which is exactly what happened and had to be fixed.
- **Surplus needs a sink.** If everything banks, players accumulate items
  they cannot place. Plan the conversion (recycle-to-currency, a shop, a
  crafting input) as part of the economy, not as an afterthought. Slime TD
  never built one, and surplus was simply surplus.
- **The same gem may sit in several different weapons, never twice in the
  same one.**
- **Duplicates of a levelling item level it in place** rather than
  granting a second copy. This is the one deliberate exception to
  "everything banks."
- **Cards should be drawn blind to what the player owns**, with the single
  exception above. Ownership-aware pools shrink toward nothing.

### One pacing rule, learned from a playtest

**Ramp the draw rate of situational classes rather than gating them.**
Targeting and Conditional gems are near-useless at level 1 — there is
nothing yet to condition on — and offering them at uniform weight from the
start reads as a wasted draw. The fix that worked: each candidate from
those classes rolls against a chance that ramps from a low floor (~0.15)
to full parity by roughly level 10. A curve, not a gate.

---

## 7. Reading the system's own honesty

Two diagnostic questions to run against any content batch before shipping
it. Both caught real defects.

**Q1: "Is any gem a silent no-op on any weapon it's legal on?"**
Ask it per gem × per archetype. Slime TD's answers, at the point the
question was first asked seriously: **six of twenty shipped gems were dead
or actively worse on most of the roster.** Four had readings wired for
exactly one archetype; one divided damage by emission count even where the
extra emissions physically could not overlap the same target — a precise
**zero** on one weapon and a **downgrade** on another.

**Q2: "What does this constant actually do at level 1, level 8, and level
20?"**
Read the tuning constants against the shipped code, not against the design
document. This found a weapon whose radius was **identical at levels 1, 8
and 12** — its per-level growth term never cleared the floor it was
clamped to. Live for days, under a green test suite.

Neither question is answerable by a type checker or by unit tests. Both
are cheap to ask on a schedule.

---

## 8. Traps — the specific bugs this system produces

Every one of these was hit. They are properties of the architecture, so
they will recur in any reimplementation.

### 8.1 The producer/consumer gap *(the worst one)*

When a weapon spawns an entity that resolves later, its upgrade fields
have to survive the trip. Slime TD added nine new RESOLVE fields; they
reached every weapon's spawned entity correctly, and were then **silently
dropped at impact** by three consumers that read the entity back through a
hardcoded field list written before those fields existed.

**Six of ten weapons would have shipped every gem in that class completely
inert.** The type checker was clean. All 823 tests passed. Structural
typing does not flag a property nobody reads back out.

**Mitigations, in order of value:**
1. **One shared interface** for the field set, extended by every entity
   type that carries it — so adding a field is one edit, not four.
2. **At least one spawn-to-impact test per archetype**, crossing the whole
   boundary. Testing either end alone is exactly what missed this.
3. Treat "a field reaches the entity" as **no evidence at all** that it
   reaches resolution.

### 8.2 Options that reach one code path and not the siblings

When RESOLVE gains a new option (a shape mask, an angular sector, a
falloff change), wire it into **every** branch of the resolution code —
the simple path, the complex path, and the per-target loop — even if only
one caller needs it today. A field that means one thing in one branch and
nothing in another is a landmine with a fuse measured in weeks.

### 8.3 Adding to an array while iterating it

The fork/split mechanic pushed child entities onto the same array the
update loop was mid-iteration over. Every forked child was silently
discarded. Caught by tests, but only because a test existed that counted
them.

### 8.4 A convention violation that inverts the effect

A bonus field wired as the literal multiplier instead of `1 + bonus`
turned a **+70% damage** upgrade into a **70% reduction**. When a system
has a field convention, every new field must follow it — and a test should
assert the *direction* of every bonus, not just that it changed something.

### 8.5 Stale names after a redesign

When a mechanic is redesigned, rename its key, not just its display text.
A key still called `flare` driving a "Radar Sweep" mechanic is the drift
that makes a codebase stop matching its own documentation.

### 8.6 Descriptions that lie

Covered in §5. It is worth its own line because it is the trap that is
*invisible in play* — the player believes the copy and never finds out.

---

## 9. Porting this to a game where the player has agency

Slime TD had no aiming and no movement (that was why it was sunset). The
system was therefore built with **three decision surfaces total**: the
pre-run loadout, in-run draws, and socketing. Everything above still
holds, but a game with real moment-to-moment input changes the design in
five specific places.

**a) ACQUIRE becomes partly the player's job.** In an aimed game, the
default ACQUIRE is "where the player is pointing." That does not delete
the Targeting class — it *sharpens* it. A Targeting gem becomes "this
weapon overrides your aim under condition X" (snap to the biggest threat,
prefer the lowest-health target, fire at the last thing you hit), which is
a far more interesting trade than it was when there was no aim to
override.

**b) A new hook appears: the player's own state.** Movement speed,
position, facing, dodge, resource. Conditional gems get an entire second
axis to key on — bonus while moving, while standing still, immediately
after a dash, at a target's back. **This is the highest-value addition
the new premise unlocks**, and it is almost free given the class is
already the cheapest to author.

**c) Legibility gets solved for free — use it.** Against discrete enemies
a build change is *countable*: things that took three hits now take one.
That was the missing feedback channel in Slime TD (post-mortem §2b).
Design the on-hit feedback deliberately rather than assuming it appears.

**d) READY becomes interesting.** With no player input, READY was just a
cooldown timer. With input, it is cast time, channel, charge-and-release,
resource cost, and animation commitment — the stage where "this weapon
feels heavy" actually lives. Expect it to carry as much gem content as
DELIVER does.

**e) Archetypes should be chosen against the *new* geometry.** Slime TD's
six exist because the enemy was a radial density field around a stationary
core. A top-down game with a moving player and discrete enemies wants a
different set — likely something like: melee arc, projectile, beam,
ground-placed area, aura-on-self, summon. Do not inherit the old six.

**What does *not* change:** the four stages, archetype-based legality, the
two socket lines, reinterpretation over refusal, no destructive respec,
everything banks, the ramp on situational draws, and every trap in §8.

---

## 10. A content bank that already exists

`docs/plans/phase-5-6-arsenal.md` is a fully-designed catalogue of **18
weapons and 65 support gems in six classes**, of which 10 weapons and 36
gems were built. The remainder — including the entire Transformative class
— is authored, reasoned about, and unimplemented.

It is written against Slime TD's specific fiction and geometry, so it is a
**source of mechanics, not of content to copy**. The parts that transfer
cleanly are the gem class structure, the coverage matrix method (§8 of
that document — which archetypes have an answer to which threats, and
where the holes are), and the §9½ *visual cost* classification: an
up-front judgement of which gems need new rendering versus which are free,
made **before** scheduling the batches. That classification is what
correctly predicted which batch would be expensive, and the one time it
was skipped, the estimate was wrong.

---

## 11. The one-page version

If everything above is lost, these eleven lines are the system:

1. Every weapon is the same function walked in four named stages:
   **READY → ACQUIRE → DELIVER → RESOLVE**.
2. A weapon may **omit ACQUIRE**; that is a real shape, not an edge case.
3. Every weapon declares one **archetype**. Every gem declares which
   archetypes it supports — **never which weapons**.
4. Gems come in classes that each hook a **different stage**: numeric,
   behavioural, conditional, targeting, transformative, global.
5. **Reinterpret, don't refuse.** Refuse only for a guaranteed no-op or a
   duplicate — and never write copy for a reading you haven't wired.
6. **Two independent socket lines**: weapon-bound identity upgrades, and
   free-floating support gems. They never compete.
7. **No destructive respec. Everything banks. Plan the sink for surplus.**
8. **Ramp situational draws** from a low floor to parity; don't gate them.
9. **A field reaching a spawned entity is not evidence it reaches
   resolution.** Test spawn-to-impact, per archetype.
10. Ask, every batch: *is any gem a silent no-op on any weapon it's legal
    on?* and *what does this constant do at level 1, 8 and 20?*
11. Numeric balance is deferrable. **Structural balance is not** — if the
    threat curve flattens while player power doesn't, no numeric pass will
    ever fix it.
