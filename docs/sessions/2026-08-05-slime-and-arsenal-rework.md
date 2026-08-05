# Session record — 2026-08-05 (evening)
## The slime rework and the arsenal direction

**Type:** design session. No code was written.
**Participants:** project owner + Claude.
**Outcome:** the target design for turning the completed prototype into a
game. Agreed in full; implementation not started.

> **Why this file exists.** `docs/PROGRESS.md` is a heartbeat — it says
> what happened and points here. This file is the reasoning. It records
> the options that were *rejected* and why, because that is the part that
> stops a future session re-deriving a settled question or re-proposing an
> idea that was already tested and found broken. Read this before
> proposing changes to the slime or weapon model.

---

## Table of contents

1. [Starting point](#1-starting-point)
2. [The playtest findings](#2-the-playtest-findings)
3. [The balance math](#3-the-balance-math)
4. [Alignment: what kind of game this is](#4-alignment-what-kind-of-game-this-is)
5. [The central reframe: field as economy](#5-the-central-reframe-field-as-economy)
6. [The two-layer field](#6-the-two-layer-field)
7. [Maturity: scar, not age](#7-maturity-scar-not-age)
8. [The conservation rules](#8-the-conservation-rules)
9. [The wilderness reservoir problem](#9-the-wilderness-reservoir-problem)
10. [The coagulant roster](#10-the-coagulant-roster)
11. [Infection events: vein and bloom](#11-infection-events-vein-and-bloom)
12. [The XP economy](#12-the-xp-economy)
13. [The arsenal direction](#13-the-arsenal-direction)
14. [Meta-progression and currency](#14-meta-progression-and-currency)
15. [The plateau and the terminal phase](#15-the-plateau-and-the-terminal-phase)
16. [Ideas considered and rejected](#16-ideas-considered-and-rejected)
17. [The plan](#17-the-plan)
18. [Open questions](#18-open-questions)

---

## 1. Starting point

The port completed earlier the same day (commit `ebc58ab`). The project
had a complete, playable roguelite loop: reaction-diffusion density field,
six auto-firing weapons, eight passives, growth nodes, contact damage,
five difficulty tiers, game over and restart.

The plan of record was a balance pass (Decision 13). The owner playtested
first. That playtest is what redirected the project.

---

## 2. The playtest findings

The owner reached the tier before Apocalypse and was never meaningfully
threatened — by the end, actively pushing the cleared circle outward. Four
findings came out of it.

**Upgrade cards appeared to do nothing at high level.** Diagnosed in code
and it is *not* what it looks like. `buildCardPool()` filters maxed
upgrades correctly (`if (lvl < def.maxLevel)`). The real cause is
**description bugs that read identically**:

- `frost`, `poison` and `missile` have static descriptions —
  `desc: () => '...'` — that take no level argument at all. Every level
  shows the same card text.
- `bladeCount(7) === bladeCount(8) === 4`; the `min(…, 5)` cap is never
  reached at `maxLevel: 8`. Same for `chainCount`, capped at 6 but topping
  out at 5. So the card correctly granted a damage increase and told the
  player nothing had changed.

Worth recording because the obvious fix — "filter maxed cards from the
pool" — would have been the wrong fix for a correctly-working filter.

**Ward Pulse has no visual whatsoever.** There is no `render/ward.ts`.
`updateWardPulse` calls `clearAt` and nothing else.

**Frost Nova's ring is nearly invisible** — a 3px stroke with 0.4s life on
a 3.6s cooldown, ~11% uptime, fading alpha, low-contrast `#bfe9ff`. The
owner described expecting an "aura"; it is coded as an instantaneous
pulse, which is itself an expectation gap worth noting.

**Frozen cells have no visual at all.** Found by grep, not reported —
zero references to `frozen` anywhere in `src/render/` or
`grid/slimeLayer.ts`. Frost applies a 2-second growth suppression that the
player can never see.

**Process observation.** Decision 11 established "a weapon's signature
visual is part of the weapon, not polish." Ward Pulse slipped through
because it is classed as a *passive*, and freeze slipped through because
it is a *field state*. The rule was scoped to weapons. It should be scoped
to any mechanic with a world-space effect.

---

## 3. The balance math

Formula-level analysis (no simulation) run before the discussion.

### Weapon DPS, level 1 → 8

| Weapon | Lv1 | Lv8 | Growth |
|---|---|---|---|
| Bolt Turret | 18.2 | 191.5 | 10.5× |
| Orbiting Blades | 31.8 | 534.5 | 16.8× |
| Chain Bolt (all hops) | 19.1 | 396.6 | 20.7× |
| Chain Bolt (primary only) | 9.6 | 66.1 | 6.9× |
| Frost Nova | 2.5 | 17.1 | 6.8× |
| Caustic Cloud | 8.9 | 62.0 | 7.0× |
| Homing Missile | 11.1 | 69.4 | 6.3× |

**Scaling asymmetry.** Blades and Chain scale 17–21× because level buys
*both* count and damage — a double-dip. The others get damage only
(cooldowns bottom out early), so they scale 6–10×. At level 8 the spread
between Blades and Frost is **31×**.

### The structural difficulty finding

> **Player power scales 17–21× over a run. Infection scales 3.1×.**

And the composition is worse than the ratio suggests:

| | Scaling axes |
|---|---|
| Infection | `infectionMult` 1.0→3.1, node interval 30s→11s. Additive, capped, stops at Apocalypse. |
| Player | weapon level × count × Amplifier × Overclock × **six weapons stacking**. Multiplicative, uncapped. |

No value of `CONTACT_SCALE` fixes a curve-shape mismatch. Raise it enough
to threaten a level-30 build and it one-shots a level-5 one. **The
infection needs new scaling axes, not bigger numbers.** This is the finding
that justified a rework rather than a tuning pass.

### Node targeting

Only Caustic Cloud and Homing Missile hunt nodes, both via
`state.nodes.find(n => !n.dead)` — the *first node in array order*, not
the nearest or most dangerous.

**Orbiting Blades structurally cannot reach a node.** `bladeRadius`'s
ceiling is `64 + 2×7 = 78px`; minimum node spawn distance is
`safeRadius + 70`, i.e. 115px at the tightest tier. At any tier, any
level, by construction.

At level 1, a solo node-hunter cannot out-pace node spawn rate at *any*
tier — kill time exceeds spawn interval across the whole table.

### The hidden XP distortion

Gem value is `clamp(round(removed * 1.3), 0, 10)` — capped — and dropped
**once per `clearAt` call regardless of area covered**. So XP scales with
*number of hits*, not damage or area:

- Blades lvl 8: 4 blades × (1 / 0.22s) ≈ **18 `clearAt` calls/sec**
- Bolt lvl 8: ≈ 6/sec
- Frost lvl 8: ≈ 0.7/sec

Blades is a gem printer. The XP economy secretly rewards many-small-hits
over few-big-hits, which nobody designed.

### Other

- Undefended core death: **~94s** (520 ticks × 0.18s), matching
  `contact.test.ts` exactly. `DECISIONS.md` #15 quotes "~110s" — that
  figure predates the final #18 formula and is stale prose. The test is
  ground truth and passes.
- Cumulative XP to level 20: 1610, ≈322 gems at mid-range value.

---

## 4. Alignment: what kind of game this is

The owner corrected a framing error that invalidated a chunk of the first
brainstorm:

> **The player cannot aim.** This is an autoshooter. The reference is a
> PoE character standing still, killing a charging horde until it is
> overwhelmed and dies. Survival time is the score that goes to the
> leaderboard.

Consequences:

**Three decision surfaces exist, total** — the pre-run deck, in-run card
picks, and gem socketing. Nothing tactical, nothing positional.

Every "cut the vein at the right point" idea died here. But the important
consequence is what it implies about the slime's *purpose*:

> **In a no-aim autoshooter, the slime's job is not to create tactical
> decisions. It is to create pressure that tests the build.** Each distinct
> slime behaviour is a question the build has to answer.

One behaviour = one question = one viable build. That is precisely the
game the owner played, and it explains the emptiness better than any
numeric analysis. The entire rework is "add questions."

**Asymmetry survives the no-aim constraint.** Weapons auto-target the
nearest frontier, so a threat concentrated in one direction *pulls the
turret's fire toward it automatically*. The game aims; the slime decides
where. The player feels a shifting front without ever making a targeting
decision. This is why veins are viable.

**`safeRadius` is a misnomer.** It is a breach threshold — cross it and
the core takes damage — not a sanctuary. The name has been steering the
design language (including Claude's) and should be renamed.

---

## 5. The central reframe: field as economy

The load-bearing idea of the session.

**Before:** the field *is* the threat. Density crosses the perimeter, you
take damage. A slow uniform grind with exactly one answer — DPS.

**After:** the field is the horde's **supply**, and coagulants are the
threat.

- Density accumulates across the arena.
- Dense regions **congeal into coagulants** that charge the core,
  consuming the density they form from.
- The field still bleeds you if it sits inside the perimeter, but slowly.
  It is the clock, not the executioner.

Why this unlocks the design:

1. **It makes field-clearing meaningful without aim.** You clear to
   manage the spawner, not to push a circle outward.
2. **It generates the difficulty curve for free.** Fall behind → bigger
   coagulants → more pressure → fall further behind. The death spiral *is*
   the curve.
3. **It matches the stated fantasy** — stationary, charging horde,
   overwhelmed, dies. The horde now has a *source*, which is what this
   game has that others do not.
4. **It fixes the observed ending.** Expansion stops being the win
   condition; pushing the boundary out does not protect you from things
   that come to you.

### A correction made mid-session

Claude initially framed this as "clear the field to **starve** the horde."
That is only true of the near field. The wilderness reservoir is
unreachable (see §9) and can never be starved. The refined and stronger
statement:

> **Field control does not set how much comes at you. It sets how far
> away it forms.**

Clean near field → mass can only bank in the wilderness → threats spawn
far → you get runway. Fall behind → mass banks close → threats spawn near
→ they land before you can chew through them.

Better than "fewer spawns" because it is *visible* (the player can see the
distance the fight is happening at) and because distance is the only
resource a stationary turret has.

---

## 6. The two-layer field

The owner raised a genuine contradiction: if coagulants consume dense
regions, dense regions never persist, so high density tiers never appear.

Resolution — stop conflating two things:

| Layer | Is | Consumed by |
|---|---|---|
| **`growth`** (exists) | Quantity of slime. The horde's fuel. | Weapons **and** coagulant formation |
| **`maturity`** (new) | Quality of the ground. Terrain. | **Nobody** |

**The horde eats mass but not maturity.** When a coagulant strips a region
bare, the ground stays mature — and regrows as mature tissue: tougher,
still seeding armoured spawns. High tiers persist precisely because the
horde cannot consume them.

This also resolves the earlier objection that a cleared arena leaves
nothing to fight: clearing density does not reset the ground, so the arena
develops permanently across a run and never returns to neutral.

### Visual encoding

Two layers, two independent visual channels:

- **Density → thickness.** Opacity, mass, subtle raised look at high
  values. "How much is there."
- **Maturity → colour and texture.** Fresh = bright, saturated, wet,
  smooth. Mature = dark, desaturated, matte, fibrous through the middle,
  crystalline/plated at the top. "How hard it is."

|  | Low maturity | High maturity |
|---|---|---|
| **Low density** | Faint pink film — nothing | Dark thin crust — annoying, little payoff |
| **High density** | Bright thick slime — mass, XP, big soft coagulants | Dark thick crust — the worst ground in the game |

5 density steps × 4 maturity steps = **20 distinct visual states from two
axes**, none hand-authored. This is the answer to "5 tiers isn't enough" —
not more buckets, a second dimension.

**Constraint:** the channels must stay strictly separated. Thickness must
mean *only* mass; colour/texture must mean *only* hardness. If they bleed
into each other, 20 states read worse than 5.

**Note on the existing palette.** The code already has 5 visible buckets;
the owner perceived 3. `#5c2430`/`#8a2f42` are both dark maroons and
`#ff3f68`/`#ff7590` are both bright pinks, so five collapse into about
three perceptual groups. Part of "we need more levels" was really "the
levels I have don't read."

Cost: one extra `Float32Array` over a 150×86 grid is ~52 KB. Free.

---

## 7. Maturity: scar, not age

The most-worked problem of the session, and the one where the first
proposal was wrong.

### Why age-based maturity is broken

Weapons target `nearestFrontierPoint` — the **nearest** revealed cell, not
the densest or farthest. So the engagement zone is permanently pinned to
the inner edge of the slime, right next to the turret, **regardless of
weapon range**.

Which means the outer arena is not merely rarely touched — it is
**structurally unreachable**. In a 1920×1080 arena with a ~1150px corner
distance, the outer ~70% never takes a hit in any run, at any build, ever.

Age-based maturity therefore produces: a permanent max-calcified border by
minute three, every armoured coagulant spawning from it as the *default*
rather than the exception, and zero escalation because it front-loads then
sits still. Not a tuning problem — the mechanic points the wrong way.

### The inversion

> **The battlefield hardens. The wilderness stays soft.**

- **Wilderness:** maxes out on *density*, stays at ~zero maturity. Thick,
  soft, bright. The horde's bulk fuel — big coagulants, but ordinary ones.
- **Kill zone:** cleared and regrown repeatedly → maturity climbs → a
  hardened ring forms *exactly where you fight*.

| Concern raised | How the inversion resolves it |
|---|---|
| Edges always calcified | Never calcified — maturity requires being hit, and you cannot hit out there. |
| Armoured spawns too common | They form only from the scar ring, which needs run time to build. Rarity metered by survival duration. |
| Must be reachable, not an impenetrable wall | It is the closest ground to the turret and permanently under your guns. |
| Escalation | The ring thickens the longer you live. Difficulty rises at the point of contact, forever, no table. |

It is also a better feedback loop: **your own success creates your
difficulty.** The wilderness version was "you disturbed something
ancient," which is flavour. This is "your kill zone became a callus,"
which is consequence.

### What it looks like in play

*(Written out because the owner asked specifically for the visual
imagination of it.)*

**Minute 0–1.** Dark arena, turret centred, perimeter ring. Slime seeps in
from the edges — bright pink-red, thin, translucent, wet. The bolt carves
big satisfying chunks; gems everywhere. Ground under the cleared circle is
virgin: clean floor, no crust.

**Minute 2–4.** Slime pushed back and regrown three or four times in the
same band. That band changes *material* — faint darker veining, colour
dulling from wet pink toward desaturated maroon. Clearing takes more shots
for less area. Beyond it, still bright and soft. First vein telegraphs: a
glowing line creeping in from the edge, growth surging along it, motes
budding off.

**Minute 5–8.** The scar ring is unmistakable — a dark, matte, crusted
band 100–200px wide around the turret, crystalline or fibrous. Just past
it the wilderness is bright and thick and reads as *visibly different
material*. Congealers form out there: big, soft, slow, long travel.
Then the first Sclerotic forms **out of the ring itself** — dull, plated,
close, tanky. The mechanic teaches itself; no tooltip required.

**Minute 10+.** The ring is thick and dark. A build with range has pushed
the front outward, so a *second, fresher* ring sits beyond the old one.
**The arena develops visible strata, like tree rings** — each band a phase
of the run, innermost oldest and hardest. A veteran reads a screenshot and
knows how long the run has been going and how the build is performing.

> The target: **the arena becomes a legible record of the run, generated
> entirely by play, with nothing authored.**

### Mechanical sketch

- `maturity: Float32Array`, 0..1, same grid dimensions.
- **Gain:** `clearAt` adds maturity proportional to density removed. You
  scar what you clear.
- **Decay:** slow passive decay when a cell is not being hit — a lull
  softens the ring, and a build that relocates its front leaves the old
  ring to heal.
- **On clearing:** maturity multiplies resistance. Hard ground yields less
  mass per shot.
- **On regrowth:** mature ground regrows **slower, to a higher ceiling.**
  Deliberate — it is a *durability* threat, not a *speed* threat. Making
  the kill zone grow faster would be unfair, since it is the one place the
  player is forced to fight. It gets thick and hard; it does not rush.
- **On coagulants:** average maturity of the source region picks the
  *type*; available mass picks the *size*.
- **Cap** on maximum maturity, so there is a floor on how bad it gets.

### The slow age component (kept, with a ceiling)

Added back at the owner's request, with a **low ceiling** — roughly a
third of maximum, where scarring reaches full. It buys:

- The wilderness shifts tone across a long run instead of looking
  identical at minute 2 and minute 20.
- Very long runs eventually see weak armoured variants from deep field —
  a fifth escalation axis.
- It can never approach a calcified wall, because the ceiling forbids it.
  The original problem stays solved by construction, not by tuning.

### The build tension this produces

Emergent, not designed in:

> **Range gets you fresh mass. Penetration gets you through your own
> callus.**

The scar ring yields less XP as it hardens. Two answers: push the front
outward into virgin slime (needs range and clear speed — but widens the
scarred band and generates more armoured spawns), or stay and grind your
own hardened ground (needs penetration — but you are farming depleted
terrain and your XP suffers).

Neither is correct. Different builds resolve the same pressure
differently, and the slime asked the question without the player aiming
anything. That is the design principle from §4, passed.

---

## 8. The conservation rules

The owner identified the sharpest balance risk: *"so that we don't get
overwhelmed with 3 behemoths after killing a couple of motes."*

This is an **economy conservation problem**. If coagulants consume density
to form and return density on death, and that density re-coagulates, you
get either a runaway loop or perpetual motion.

**Rule 1 — Formation is a sink.** A coagulant consumes the density it
forms from. Field density goes *down* when one spawns.

**Rule 2 — Killing is a sink.** Damage dealt to a coagulant is mass
permanently destroyed. Death yields XP and gems, plus only a **small fixed
splatter by size class** — not a return of what it ate.

**Rule 3 — Arrival is the only real source.** Reaching the core delivers
full mass as damage *and* dumps that mass inside the perimeter, seeding a
breach that then bleeds via contact damage.

**Rule 4 — Size is emergent, not scripted.** What can form is determined
by the contiguous mature density actually available. A well-managed field
produces only motes; behemoths require a large, mature, neglected region.

### Why Rule 3 is an inversion of the first proposal

Claude initially proposed splatter as a consequence of *killing* things
close to the core. That was wrong — it made success feel punishing.

> **Splatter is the consequence of failing to kill, not of killing.**

Kill things and it is clean; let things through and it is a disaster.
Correct incentive, and legible without a tutorial.

### Why Rule 4 answers the owner's question

**You cannot get three behemoths from killing motes**, because behemoths
require sustained neglect of a large region, and motes dying does not
create that. Coagulant size becomes an *automatic readout of how badly you
are losing* — no difficulty script anywhere. A behemoth appears because
you let the field mature, not because a timer fired.

Formation also depletes its own region, which must regrow before another
can form there.

**Agreed tuning dials if this misbehaves in play: arrival speed and
arrival mass.**

---

## 9. The wilderness reservoir problem

Raised by the owner: *"won't we just get behemoths out of wilderness — a
lot of mass arriving from an area I can't even reach to clear?"*

### The math says it is worse than intuition suggests

- Total arena: 1920 × 1080 = **2,073,600 px²**
- A generous cleared disc at 400px radius: **~502,000 px²**
- **The wilderness is ~76% of the map.**

And it fills fast. Ambient growth far out is logistic at ~0.05/sec, so
`dens(t) = 1 - e^(-0.05t)` → **90% density in ~46 seconds.** Saturated by
minute one, and it stays saturated forever because nothing reaches it.

Under Rule 4 alone, that is unlimited contiguous mass from minute one:
behemoths on tap, permanently, from unreachable ground.

**Local depletion does not save it.** A behemoth stripping a ~150px patch
leaves ~22 non-overlapping patches in that annulus, each refilling in
~60–90s — a sustainable rate of roughly **one behemoth every four
seconds.** Rule 1 is necessary but nowhere near sufficient.

### The fix

> **The wilderness is a reservoir. Events are the pumps.**

Standing mass does not spontaneously coagulate. A vein or bloom must
*initiate* it. The wilderness sitting there full does nothing on its own;
it is fuel waiting for a spark.

Better than a spawn-rate cap because:

- **Pacing collapses to one lever** — event frequency and reach. Clean,
  tunable, unbounded, and therefore also the plateau fix.
- **Unreachable ground stops being a problem** — it is storage, not a
  spawner.
- **Veins and blooms become load-bearing** rather than flavour. They are
  the delivery mechanism for the entire horde.

### Is "behemoths from unreachable ground" good? Yes, with guards

Agreed as good, and as the right kind of pressure:

- Thematically it is the premise. The infection is vastly bigger than you.
  You are not winning, you are holding.
- It is the only way to get the intended drama. A behemoth crossing 700px
  of open arena, visible the whole way, *requires* it to come from far.
- Pure failure-gated difficulty gets naggy. An occasional "the world sent
  something at you, through no fault of yours" paces well against a
  background of consequences you did earn.

Guards: rare and rhythmic (event frequency owns this), heavily
telegraphed, slow, and **answerable by build rather than by field** —
burst, single-target, slows.

**The player's field lever against it is indirect but real:** a clean near
field means auto-targeting is not chewing on motes while the behemoth
closes. Field control buys **weapon attention** during the transit window.
This also makes the Threat Priority gem genuinely situational rather than
a flat upgrade.

### The resulting split

| Source | Gated by | Character |
|---|---|---|
| **Wilderness** | Event frequency | Predictable heartbeat. Big, slow, dramatic. Comes for everyone. |
| **Near field / scar ring** | Player performance | Emergent consequence. Close, fast, armoured. Only struggling players see much of it. |

A steady rhythm plus earned consequence.

---

## 10. The coagulant roster

### Identity is a function, not a table

A coagulant's identity is **derived from the field state where it forms**:

| Reading | Determines |
|---|---|
| **Contiguous mass** | Size |
| **Maturity** | Armour / type |
| **Mass shape** (solid vs. fragmented) | Whether it holds together |
| **Corridor density** (spark → core) | Whether it can feed en route |

No spawn weights to tune, and the player can always read *where something
came from* by looking at what it is.

|  | Virgin (maturity ~0) | Maturing (mid) | Scarred (high) |
|---|---|---|---|
| **Low mass** | Mote | Mote | **Sclerotic** |
| **Mid mass** | Congealer, **Blastoma** | Congealer | **Sclerotic** |
| **High mass** | **Behemoth**, **Carrier** | Blastoma | **Bulwark** (late) |

### Universal formation visual

One language for every type, with the *scale* telling you what is coming:

1. **Tell** — region begins to pulse, colour shifting
2. **Drain** — density visibly flows inward toward a point, surroundings
   thinning
3. **Rise** — mass gathers and lifts out of the field
4. **Detach** — separates and begins moving
5. **Crater** — a depleted hollow remains, refilling over the next minute

The drain is **Rule 1 made visible** — formation as a sink, shown rather
than explained. And it is the entire telegraph system for free: a behemoth
drains a crater visible from across the arena. No UI, no warning banner.

### The seven

**Mote** — *thin mass, any maturity.* A vein floods a narrow track with
fresh growth; nowhere near enough mass in one spot for anything
substantial, so it sheds — small buds detaching along the vein's length,
several at a time.
*Reads as:* the vein is shedding. *Counter:* multi-target, chain, hit
frequency.

**Congealer** — *moderate solid mass, low maturity.* A bloom lands on
saturated virgin wilderness. A patch pulls inward, a blob rises out of the
hollow, and it starts the long walk. The workhorse.
*Counter:* sustained DPS.

**Behemoth** — *large contiguous mass, low maturity, deep field.* An
enormous area drains — a crater hundreds of pixels across — and something
huge and slow rises out of it, with most of the arena to cross, visible
the whole way.
*Counter:* burst, single-target, slows. Plus spare weapon attention, which
a clean near field buys.

**Blastoma** — *high mass, but fragmented.* Forms where a vein has
**webbed** through an area leaving a lattice rather than a solid sheet.
Plenty of mass, never merges properly, so what rises is visibly lumpy with
distinct nuclei inside. Not a blob — a bag of blobs.
*Reads as:* that's going to split, because you can see the lumps.
*Counter:* AoE cleanup. Punishes an all-burst build with nothing left
after the big hit.

**Carrier** — *moderate mass, plus a dense corridor to the core.* Forms
small. What makes it a Carrier is the terrain *between it and you* — it
only forms when the field it must cross is thick. Eats its way in,
swelling, leaving a thinned trail like a worm track.
*Reads as:* it's eating its way here — the trail is the tell.
*Gate:* pure performance. Keep the field clear and there is no corridor,
so Carriers cannot form at all. A good player never meets one.

**Sclerotic** — *high maturity.* A vein reaches the scar ring, punches
through with fresh mass, and the arrival also wakes the ring itself. The
crust buckles, tears loose and drags itself off the ground: plated, dull,
slow, already inside the engagement zone.
*Reads as:* my own kill zone got up and walked at me.
*Runway:* essentially none. *Counter:* penetration — it is under your guns
from the instant it forms, so the question is whether you can *hurt* it,
not whether you can reach it.

**Bulwark** — *high maturity with soft mass behind it.* Needs hardened
ground with virgin wilderness at its back — exactly what a mid-field bloom
manufactures. Forms wide and flat rather than round: a moving wall,
escorting whatever the wilderness sends up behind it.
*Counter:* AoE, orbitals, pierce — or switching Threat Priority *off* so
damage goes past it.

### Two design notes

**Several types are gated on player failure rather than elapsed time.** A
behemoth needs a large neglected region; a Carrier cannot form without a
dense corridor. A player on top of the field never meets half the roster;
a player slipping meets all of it at once. Difficulty reads as
*consequence* rather than as a timer.

**Carrier and Bulwark should ship as a pair.** Carrier makes the Threat
Priority gem meaningful (something that gets worse when ignored). Bulwark
makes it a genuine *tradeoff* (threat-first targeting sometimes feeds
damage into a wall while motes stream past). Without Bulwark, Threat
Priority is a flat tax rather than a decision.

---

## 11. Infection events: vein and bloom

Growth nodes are removed entirely and replaced by a single **Infection
Events** system with two variants. The organising principle:

> **The vein acts on density. The bloom acts on maturity.**
>
> **Events are sparks; the terrain decides what burns.**

### Vein — a fresh-mass conduit that punches through your callus

Linear, from the arena edge inward, reusing the **existing `veinField`
reaction-diffusion pattern** — currently generated at run start and used
only as a threshold map, i.e. pure wallpaper. This makes it live.

Lifecycle:

| Phase | What happens |
|---|---|
| **Telegraph** | A path lights up dimly from the edge inward. |
| **Activation** | Grows inward, glowing. Growth rate strongly elevated along and near it. |
| **Peak** | Coagulants bud off along its length. |
| **Decay** | Dies on a timer. The slime it created remains — **the aftermath is the real problem**, not the vein. |
| **Rotation** | A new one activates elsewhere. |

It floods soft new growth along its path *including through the scar
ring*, temporarily overwriting crust with fresh tissue. A genuine
double-edge: fresh mass is easy to clear and is a burst of XP right when
the hardened ring had starved the player of it — but it is mass delivered
**close**, meaning short-runway threats and much less reaction time, with
the ring's slow-regrowth buffer gone while it lasts.

**A vein reaching the scar ring is a two-part beat:** fresh short-runway
chaff, *and* it wakes Sclerotics from the player's own callus.

**Why this matters beyond the mechanic:** the game currently has no
rhythm. Pressure is a flat line — uniform growth, everywhere, forever.
Veins give it a heartbeat: pressure builds from a direction, peaks,
subsides, moves. That is the wave structure every good autoshooter has and
this one lacks entirely.

### Bloom — a maturity accelerator

Radial, local. Rapidly ages a patch of ground, creating hardened spawn
sites where there would otherwise be none.

This fills a real gap: without blooms, armoured coagulants could only ever
come from the immediate ring, so they would always be close and always
late. Blooms let armour appear mid-field, earlier, as a discrete event —
and give Bulwark somewhere to live before the endgame.

**Blooms do double duty, and the outcome depends on where they land:**

- Deep + virgin saturated ground → the **mass** effect dominates →
  **Behemoth**
- Mid-field + older ground → the **maturity** effect dominates →
  **Sclerotic / Bulwark**

One event, one implementation, outcome read off the terrain. The player
learns to read blooms by location: *deep = something huge, mid-field =
something armoured.*

### Which event produces what

|  | Vein *(linear, injects mass)* | Bloom *(radial, hardens ground)* |
|---|---|---|
| **Deep wilderness** | Motes along its track | **Behemoth**, Congealer |
| **Mid-field** | Motes, **Blastoma** (webbed lattice) | **Bulwark**, Congealer, Sclerotic |
| **Scar ring** | Motes + triggers **Sclerotic** | Sclerotic |
| **Any, if corridor thick** | **Carrier** | **Carrier** |

### Three threat origins, three pressures

| Origin | Signature |
|---|---|
| **Wilderness** | Big, soft, slow. Long runway. Dramatic. |
| **Vein** | Fresh, close, sudden. Short runway. Easy to kill if reached in time. |
| **Scar ring / bloom** | Armoured, closest, tanky. Under your guns from formation. |

### Why the runway shrinks over a run

Counter-intuitively, a stronger build pushes the front *outward*, so the
wilderness gap **grows**. What shrinks is **where things spawn from**:

- **Early:** only the wilderness. Long, dramatic charges.
- **Mid:** the scar ring matures and produces its own, on the doorstep.
- **Late:** veins deliver close, blooms harden mid-field. Most threats
  originate near.

The spawn sources migrate inward even as the front moves outward. The
player experiences it as the fight closing in — and it needs no dedicated
lever.

---

## 12. The XP economy

### The trap avoided

If horde kills paid meaningfully more per unit mass, **neglecting the
field would become an XP strategy** — deliberately letting slime mature to
farm behemoths. Degenerate, and it fights everything else in the design.

### The model

> **XP tracks destroyed mass, wherever it is.** One unit of slime
> destroyed pays the same whether destroyed loose in the field or packed
> inside a coagulant — plus a modest **risk premium (~25–50%)** on horde
> kills for the fact it was actively trying to kill you.

Horde kills still *feel* big, because a behemoth is an enormous amount of
mass concentrated in one place — a huge XP dump that should shower gems.
But it is mass that would have been earned anyway, so there is no farming
incentive, only an honest bonus for engaging.

### The pacing comes free from existing mechanics

- Soft slime → `clearAt` radius scales up
  (`clamp(1.25 - density, 0.4, 1.25)`) → huge area per shot → fast early
  XP, the intended early rush.
- Hardened slime → small radius, ~10× resistance → far less mass per
  second → field XP naturally dries up as the run matures.
- Which pushes the economy onto the horde precisely when the horde becomes
  the main threat. **The XP source migrates in step with the threat model,
  with no scripting.**

No stall risk: the mass never stops flowing, it relocates from the ground
into things that charge you.

### Changes required

- Remove the `clamp(…, 0, 10)` value cap.
- Stop dropping one gem per `clearAt` call regardless of area; value
  becomes mass-proportional.
- Big kills drop a shower rather than a single pickup.
- Gems stay physical and drifting — good feel, and it keeps Magnetism
  meaningful as a gem.
- **Level curve goes superlinear.** `xpToNext = 12 + level * 6.5` is
  linear while clear rate is super-linear, so levels necessarily
  accelerate. Exact curve is a balance job.

---

## 13. The arsenal direction

Agreed as a PoE-style system.

**Meta layer (currency, out of run):** unlock weapons · unlock turret
weapon **slots** · unlock gem types.

**Run layer:** equip a deck of weapons pre-run → cards during the run
offer weapon levels, weapon-specific extensions, and support gems → pause
+ inventory screen to socket and re-socket.

### Two classes of upgrade

- **Weapon-specific extensions** (Blade Count, Chain Forks) —
  specialisation depth.
- **Universal support gems** (Multishot, Pierce, Splash, Duration) —
  combinatorial breadth. *Multishot on Homing Missile* and *Multishot on
  Bolt* are different fantasies. This is how 20 weapons produce build
  variety without hand-authoring 20 × N unique upgrades.

**More extensions than slots**, deliberately, so the choice is contested —
which is what makes the inventory screen earn its existence.

### Passives are dissolved entirely

Every passive becomes a gem. Amplifier → a `+damage` support gem.
Overclock → `+attack speed`. And **the Core itself gets gem slots** for
defensive/utility gems (Vitality, Regen, Armor, Magnetism).

One unified system, one card category instead of two, the core becomes
part of the build rather than a stat block, and a whole axis of card-pool
dilution disappears.

### Card pool dilution — the main risk

**20 weapons implemented naively makes the game worse.** With 20 weapons ×
levels × extensions × gems in one pool, the chance of being offered the
card you want collapses, and level-ups stop being *choices* and become
*lottery draws*.

The pre-run deck is the fix: **the deck defines the pool.** That is a
stronger argument for the unlock system than progression alone — the
meta-progression becomes a deckbuilding system rather than a grind gate.

### Targeting becomes a gem

Threat Priority / Field Priority. This permanently kills the "it takes
away my weapons" complaint — targeting moves from a hardcoded per-weapon
behaviour the player never chose to a build decision they did. And with
Bulwark in the roster it is genuinely situational rather than a flat
upgrade.

### Design axes and the current gaps

- **Delivery:** projectile · orbital · aura/pulse · placed-persistent ·
  *beam* · chain · *autonomous summon*
- **Targeting:** frontier · self-centred · *densest-point* ·
  *deepest-breach* · *scatter*
- **Effect:** clear · freeze · DoT · *terrain-modify* · *displace* ·
  *debuff*

Italics are unexplored. Four structural gaps: **nothing modifies terrain
persistently, nothing is defensively positioned, nothing displaces rather
than removes, and nothing scales up against density.**

That last one matters most. `clearAt` uses
`resistance = clamp(1.3 - dens, 0.12, 1.3)` — mature tissue is ~10×
tankier — so *every* weapon is worse against dense tissue and the only
answer to a wall is raw DPS. A weapon that gets *better* against density
inverts that and creates a genuine build decision.

### Starter ideas (retained, not final)

- **Cauterizer** — burns a line, leaves scarred ground. Terrain
  modification.
- **Resonance** — damage scales *with* local density. The anti-wall
  answer.
- **Solvent** — no damage; lowers resistance in an area. Pure force
  multiplier.
- **Repulsor** — pushes density outward instead of removing it. A
  genuinely new verb.
- **Antibody Swarm** — autonomous units hunting the densest cells.
- **Mycelium** — friendly counter-growth competing for cells. Field vs.
  field.

**Rejected:** Scalpel/Lance as originally pitched — it was justified by
artery-cutting, which died with the no-aim correction. A piercing line
weapon may still work auto-aimed, but only becomes interesting if
calcified tissue blocks projectiles. Parked.

### A design fix worth carrying forward

**Make frozen tissue brittle** (bonus damage while frozen). Frost Nova's
17 DPS at level 8 stops being a balance problem because Frost becomes a
*setup weapon* — a multiplier enabler rather than a damage source. A
design fix rather than tripling a number.

### Sequencing note

The arsenal gets **its own design session** before implementation. Content
authored against a settled threat model, not guessed at in parallel with
one.

---

## 14. Meta-progression and currency

- Currency scales with **survival time, superlinearly** — the good
  material gates behind deep runs.
- Spends on: weapon unlocks, turret weapon slots, gem types.
- Early runs earn little, so only basic weapons unlock; everything
  interesting sits behind progressively longer playthroughs.

**The trap avoided:** currency from *slime killed* rewards long runs and
high DPS, which a strong build already has — rich-get-richer. Worse, with
a difficulty plateau, slime killed is unbounded and the optimal strategy
becomes parking at a comfortable tier and farming forever.

**The dependency:** this only works if there is no plateau. §15's
compounding pressure means runs always end, so survival time is bounded
and meaningful. The currency design and the difficulty design are the same
problem solved once.

---

## 15. The plateau and the terminal phase

Five escalation axes that rise on their own in the new model:

1. **Arena-wide maturity** — more of the map is older every minute.
   Unbounded, no table.
2. **Event frequency** — more simultaneous veins/blooms over time.
3. **Ambient rate** — the existing lever.
4. **The death spiral** — falling behind compounds.
5. **Wilderness slow-aging** — capped, but real over long runs.

Honest caveat: **that may still not be enough**, because builds are
multiplicative and these are mostly linear. So: organic escalation as
primary, plus a backstop.

### Terminal phase, not an unkillable boss

An unkillable boss is a timer wearing a costume, and it flattens the
leaderboard — everyone dies at roughly the same minute regardless of build
quality.

Instead: at some deep time a **permanent escalating condition** begins —
the arena calcifying inward from the edge, the perimeter contracting
continuously, or veins ceasing to expire. Death is guaranteed, but *how
long you last inside it* still differentiates builds. Score stays
meaningful, and it is built from levers the design already has rather than
a bespoke boss.

Specifics deferred to Phase 8; the levers must exist by then rather than
being bolted on.

### `TIERS_LIST` is demoted to flavour

Difficulty becomes emergent from field state, maturity, and event
frequency. Tiers survive as a *naming and presentation* layer — names,
announcements, colour themes on a time curve — with **zero mechanical
weight**. A real architectural change to how `tick.ts` works, made
deliberately rather than by drift.

---

## 16. Ideas considered and rejected

Recorded so they are not re-proposed.

| Idea | Why rejected |
|---|---|
| **Cut the vein at a chosen point** | Requires aiming. Dead on the no-aim correction. |
| **Player-authored scar terrain** | Same — "author the arena by choosing where to clear" needs aim. |
| **Age-based maturity as primary** | Outer ~70% of the arena is structurally unreachable, so it produces a permanent calcified border by minute 3, makes armoured the default, and front-loads instead of escalating. Inverted to scar-based; age retained only with a low ceiling. |
| **Splatter as a penalty for killing close** | Made success feel punishing. Inverted: splatter is the penalty for *failing* to kill (Rule 3). |
| **"Clear the field to starve the horde"** | Only true of the near field; the wilderness reservoir is unreachable. Refined to "field control sets spawn *distance*, not rate." |
| **Mass alone triggers coagulation** | The wilderness saturates in ~46s and is 76% of the map — infinite behemoths from minute one. Fixed by making events the trigger. |
| **Local depletion as the only gate** | ~22 patches × ~90s refill ≈ one behemoth every 4s. Necessary but nowhere near sufficient. |
| **Squared proximity damping** (earlier session) | ~1900s to visible growth near the core — effectively never. Linear retained. |
| **Unkillable boss as the endgame cap** | A timer in costume; flattens the leaderboard. Replaced with the terminal phase. |
| **Currency from slime killed** | Rich-get-richer, and unbounded under a plateau — rewards farming over pushing. Replaced with survival time. |
| **More density buckets as the fix for legibility** | The code already has 5; the palette collapses them to ~3 perceptually. Fixed by a second axis (maturity) plus a corrected palette. |
| **Scalpel / Lance** | Justified by artery-cutting, which needed aim. Parked pending the projectile-blocking decision. |
| **Filtering maxed cards from the pool** | The filter already works correctly. The real bug is static/plateauing card descriptions. |

---

## 17. The plan

### Phase 3 — The Horde
*The identity change. Ends with a game that is no longer the prototype.*

| Step | Work |
|---|---|
| **3A** | Teardown. Remove nodes entirely (`systems/nodes.ts`, node targeting in `poison.ts`/`missile.ts`, node damage in `clear.ts`, `tuning/nodes.ts`). Rename `safeRadius` → `perimeter`. Demote `TIERS_LIST` to flavour. |
| **3B** | Infection Events framework. Lifecycle: telegraph → activate → peak → decay → rotate. Vein (density injector, linear, reuses `veinField`). Bloom (radial; mass-concentration only until maturity exists). |
| **3C** | Coagulants Wave 1. Formation sampling, the four conservation rules, Mote/Congealer/Behemoth, transit, arrival damage + breach splatter, drain/crater formation visual. |
| **▶ GATE** | **Playtest.** First time the game is the new game. Tune arrival speed and mass. |
| **3D** | XP economy. Mass-based, cap removed, risk premium, gem showers, superlinear level curve. |
| **▶ GATE** | **Playtest** for pacing. |

### Phase 4 — The Terrain
| Step | Work |
|---|---|
| **4A** | `maturity` field. Scar accumulation from `clearAt`, slow age with low ceiling, decay, cap. Effects on clear resistance and regrowth ceiling. |
| **4B** | Two-axis visual system. Density → thickness, maturity → colour/texture. Fixes the palette collapse. |
| **4C** | Coagulants Wave 2. Bloom's maturity role activates. Blastoma, Carrier, Sclerotic, Bulwark. The vein-hits-ring beat. |
| **▶ GATE** | **Playtest.** Do the tree rings read? Is the scar ring interesting or oppressive? |

### Phase 5 — Arsenal Framework
Weapon slots, extension slots, support gems, core gems, passives
dissolved, pause + inventory UI, existing six ported in.
**Gate: playtest the socketing loop.**

### Phase 6 — Arsenal Content
**Its own design session first** — the weapon/extension/gem catalogue.
Then implementation in batches toward 20.

### Phase 7 — Meta
Currency, unlocks, deck builder, start menu.

### Phase 8 — Endgame + Balance
Terminal phase, the real balance pass, leaderboard.

### Phase 9 — VFX and feel
Deferred deliberately.

### Why maturity moved after Wave 1

The earlier sketch had the maturity field as step 3A. Working through
coagulant formation showed that **Wave 1 needs no maturity at all** —
Mote, Congealer and Behemoth are pure density readings. Putting maturity
first would have blocked the most important playtest behind the largest
visual system. Get the identity change on screen early, tune the
conservation rules against something playable, then layer terrain on top.

### Risks

1. **Coagulant formation is the one real technical unknown.** "Contiguous
   mass in a region" needs flood-fill or sampling, per event, inside the
   tick budget. Everything else is well-understood work. Prototype it
   first in 3C.
2. **The test suite takes a hit.** `nodes.test.ts` goes entirely;
   `contact.test.ts`, `growth.test.ts` and weapon tests need rework.
3. **Keep `contact.test.ts`'s outcome test.** "An undefended core dies"
   survives this redesign intact — exactly the invariant-over-mechanism
   test Decision 20 argued for, and the best available proof the rework
   did not break lethality.
4. **The scar ring might feel oppressive** — the player is forced to fight
   in their own hardening zone. That is what the 4C gate is for.
5. **Two-axis visuals could read worse than one** if the channels are not
   cleanly separated.
6. **The conservation rules could still misbehave.** Dials: arrival speed
   and mass.

---

## 18. Open questions

**🔴 1. What drives the perimeter now?** — *blocks 3A.*
`TIERS_LIST` currently shrinks it 100 → 45. With tiers demoted to flavour
that driver is gone. Options: fixed; an independent time curve; or
breach-driven (shrinks as hits land — fits the consequence philosophy but
may spiral).
*Claude's recommendation: fixed for now, revisit in Phase 8. In the new
model the perimeter's job is much smaller — it is the line where breach
splatter starts bleeding the core, not the primary difficulty lever.*
**Not decided. Needs the owner's call before 3A starts.**

**2. Does meta-currency buy permanent stat upgrades, or unlocks only?**
Recommendation: unlocks only. Permanent stats compound the §3 scaling
problem on top of an already 17× in-run curve. Never explicitly
confirmed.

**3. What happens to `frozen`?** Frost's growth-suppression survives
conceptually but probably becomes a gem effect rather than a
weapon-specific mechanic. Phase 5 concern; noted so it is not lost.

**4. Does calcified tissue block projectiles?** Raised as high-impact —
it would differentiate whole weapon families and give the parked
Scalpel/Lance a reason to exist — but it is the riskiest single item
here, since a crust that makes your main weapon useless could feel awful.
Recommendation: prototype in Phase 4 and decide from feel.
