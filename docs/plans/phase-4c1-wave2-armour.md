# Phase 4C-1 — armour, Sclerotic and Blastoma

**Status:** ✅ implemented and verified live 2026-08-07, same day as written
and greenlit — Decision 68. Two constants changed after live verification;
see §10.
**Source design:** `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
§10 (the coagulant roster) and §11 (infection events); Decisions 30, 44, 48.
**Scoping conversation:** 2026-08-07, with the project owner.

> **The phase where maturity stops being scenery.** 4A built the terrain
> layer, 4B made it readable. 4C is where it starts *picking what the horde
> sends* — §10's "identity is a function, not a table."

---

## 1. Why 4C is split

4C as written is meaningfully bigger than 3C, and 3C needed a
playtest-and-fix round afterwards. 3C shipped three kinds where everything
was "same formula, different numbers." Full 4C is four kinds **plus** two
structurally novel mechanics — Carrier writing back into the grid as it
travels, and Bulwark being non-circular when every damage, collision,
targeting and render path currently assumes a circle.

Split along that seam, agreed with the owner:

| | Content | Novel machinery |
|---|---|---|
| **4C-1** *(this plan)* | Bloom's maturity payload, armour from maturity, **Sclerotic**, **Blastoma**, +50% weapon damage | None — identity rules over existing mechanics |
| **4C-2** | **Carrier** + **Bulwark**, the pair §10 asks for | Multi-part bodies; entity→grid writes |

The split keeps Carrier and Bulwark together, which §10 explicitly
requires.

---

## 2. Agreed scope decisions (2026-08-07)

1. **Blastoma splits at 50% of its starting mass** into **two** fragments
   that divide the remaining mass between them. Owner's call. Splitting on
   *death* was rejected as impossible — at death there is no mass left to
   give children, and inventing some would break Rule 2 (killing is a
   sink). A threshold split conserves exactly and still delivers the
   fantasy: burst it down, it breaks apart, there's cleanup left.
2. **Tune armour gently, and raise weapon damage by 50%.** Owner: *"the
   game is quite hard as of now, so tune it gently and maybe tune up the
   damage the weapons do by 50%, so we can see our things implemented
   working but also not be overwhelmed in 30 seconds of gameplay."* See §8.
3. **Projectile-blocking (open question 4) is out of scope**, moved to
   BACKLOG's *Ideas*.

---

## 3. What the flood-fill has to start measuring

§10 derives identity from four field readings. Two exist, two don't:

| Reading | Determines | Status |
|---|---|---|
| Contiguous mass | Size | ✅ `floodFillMass` |
| **Maturity** | Armour / type | 4A built the field; nothing reads it yet |
| **Mass shape** (solid vs fragmented) | Whether it holds together | ❌ — needed for Blastoma |
| Corridor density | Whether it can feed en route | 4C-2 (Carrier) |

`floodFillMass` already walks exactly the cells that matter, so both new
readings ride the existing traversal — no second pass.

**Maturity** — plain mean of `grid.maturity` over the visited cells. §7
says "average maturity of the source region picks the type."

**Fragmentation** — a fill ratio, comparing what the flood *reached*
against what it actually *filled*:

```
maxDist     = furthest visited cell from the spark
expectedCells = π · maxDist² / cellSize²      // the disc it spanned
fillRatio   = cells.length / max(1, expectedCells)
```

A solid saturated patch fills its disc → ratio near 1. A **webbed** vein
lattice reaches far along thin corridors while visiting few cells → ratio
low. That is precisely §10's Blastoma condition — *"forms where a vein has
webbed through an area leaving a lattice rather than a solid sheet"* — and
it needs no new data structure, just two more accumulators in a loop that
already runs.

---

## 4. Identity

`coagulantKindFromMass(mass)` becomes
`coagulantKindFrom(mass, maturity, fillRatio)`:

```
if maturity >= MATURITY_SCLEROTIC        -> 'sclerotic'
if mass >= MASS_BLASTOMA
   && fillRatio < FRAGMENTATION_THRESHOLD -> 'blastoma'
if mass >= MASS_BEHEMOTH                 -> 'behemoth'
if mass >= MASS_CONGEALER                -> 'congealer'
                                          -> 'mote'
```

Matches §10's table, with one deliberate gap: the table puts **Bulwark** in
the high-mass/scarred cell, which 4C-1 doesn't have — so high-mass scarred
ground yields a Sclerotic for now. 4C-2 splits that branch. Worth a comment
in the code so it reads as staged rather than forgotten.

**Armour is a function of source maturity, not a per-kind table.** A
Sclerotic is armoured *because* it formed from hardened ground, which keeps
Rule 4's "emergent, never a spawn table" intact and means armour needs no
separate balancing for kinds that don't exist yet:

```
armor = maturity · ARMOR_AT_FULL_MATURITY
```

Decision 44's consumption path is already built — `clearAt` does
`max(power - armor, power · COAGULANT_ARMOR_FLOOR)` and has since 3C,
sitting dormant at `armor: 0`. This is the phase that finally feeds it.

---

## 5. Blastoma's split

New `Coagulant` fields: `splitAtMass` (0 = never splits). Set at formation
to `mass · 0.5` for a Blastoma, 0 for everything else.

**The check runs in `updateCoagulants`, not in `clearAt`** — deliberately.
`clearAt` iterates `state.coagulants` while dealing damage, and pushing
fragments onto that array mid-iteration is the same class of hazard as
mutating state during a draw call (Decisions 4/7). The split is a
lifecycle event; it belongs in the update pass.

```
if (c.splitAtMass > 0 && c.mass <= c.splitAtMass) -> split
```

Each fragment takes **half the remaining mass**, is offset perpendicular to
its travel direction, gets `splitAtMass = 0` so nothing splits twice, and
derives radius/speed/kind from its own mass like any other coagulant.
Conservation is exact: parent mass in, same mass out, in two containers.

> **Resolved:** derive from mass, as recommended. The owner's "two little
> motes" was describing the fantasy, not a hard requirement — *"I agree
> with deriving it from the mass."* Confirmed as-built: fragments call
> `coagulantKindFromMass`, the same Wave 1 function every fragment always
> used, and read as congealers or motes depending on the parent's size at
> the moment it split, matching Rule 4 rather than a hard-coded kind.

---

## 6. Bloom's maturity payload

Decision 48 shipped bloom in 3B with its real job deferred; 4A scoping
confirmed the target as 4C so that 4A's global resistance change could be
read on its own. This is that job.

`applyBloomGrowth` already walks its radius with a falloff. Maturity
injection rides the same loop and the same falloff, gated to the active and
peak phases exactly as growth is, and respecting `MATURITY_MAX` plus the
`matBucket`/dirty discipline (Decision 67).

This is what makes §11's promise real — *"blooms let armour appear
mid-field, earlier, as a discrete event"* — instead of Sclerotics only ever
coming from the ring, which would make them always close and always late.

---

## 7. Sclerotic's trigger: the vein wakes the ring

§11's two-part beat: *"a vein reaching the scar ring is fresh short-runway
chaff, **and** it wakes Sclerotics from the player's own callus."*

`randomVeinPoint` currently samples the trunk uniformly. Change it to
sample several candidates and prefer high-maturity ones. That produces
Sclerotics naturally whenever a vein crosses the scar ring, with no
special-case trigger and no new system — the vein is still just a spark,
and the terrain still decides what burns (§11's organising principle).

---

## 8. Weapon damage +50%

A single `WEAPON_DAMAGE_SCALE = 1.5` in `tuning/weapons.ts`, multiplied
into all six `*Damage(lvl)` functions rather than editing twelve
coefficients by hand. One knob, trivially revertible, and it reads as what
it is — a balance-pass dial, not a rebalanced curve.

**Why it ships in this phase specifically:** 4C-1 adds the game's first
nonzero armour while §7's counter for it (penetration) is a Phase 5 gem
that doesn't exist. Without a compensating change the gate would only tell
us "armour is too strong," which we already know and can't fix yet.

---

## 9. Rendering

Coagulants gain a `sourceMaturity` field and colour from 4B's
`MATURITY_COLORS` accordingly, instead of always `MATURITY_COLORS[0]`.
That makes the roster readable at a glance and costs nothing — the palette
already exists and is already the game's material language.

- **Sclerotic** — bone, with flatter, tighter seeds and less wobble.
  Decision 46 anticipated exactly this: *"the same shapes in the mature
  palette with flatter, plated edges."*
- **Blastoma** — more seeds with less overlap, so it visibly reads as *a
  bag of blobs* rather than one blob. §10: "that's going to split, because
  you can see the lumps." Decision 46 again: *"the same renderer with more
  seeds and less overlap."*

Wave 2's rendering was designed to come nearly free, and it does.

---

## 10. Tests

1. **Identity** — high maturity → sclerotic; high mass + low fillRatio →
   blastoma; otherwise the existing mass thresholds, unchanged.
2. **Fragmentation metric** — a solid filled region scores high; a thin
   webbed corridor scores low. Tested on synthetic grids so it can't drift.
3. **Armour scales with source maturity**, and is ~0 on virgin ground, so
   Wave 1 behaviour is unchanged where maturity hasn't accrued.
4. **Nothing is ever unkillable** — even at maximum armour a hit still
   removes mass (Decision 44's floor, now actually exercised).
5. **Blastoma splits at its threshold**, produces exactly two fragments,
   and **mass is exactly conserved** across the split.
6. **Fragments never re-split**, however far they're damaged.
7. **Bloom raises maturity inside its radius and not outside**, and only
   during active/peak.
8. **The end-to-end mass-conservation invariant still holds** — the
   existing test extended to cover a split mid-transit.

---

## 11. Risks

**Armour lands before its counter exists — the main one, and known.** §7's
build tension is *"range gets you fresh mass, penetration gets you through
your own callus"*, and penetration is a Phase 5 gem. 4A was tuned gently
for this reason; 4C-1 stacks armoured enemies on top. Mitigated by scope
decision 2 (gentle armour + 50% damage), but this is the phase where the
design record's own risk #4 gets tested for real.

**The fragmentation metric may not fire in practice.** The threshold is a
guess until a real vein-webbed region is measured in-browser. If Blastomas
never appear, the metric — not the roster — is what's wrong. Worth checking
with the debug harness early rather than at the gate.

**+50% damage may overshoot**, especially against Wave 1 kinds that were
tuned without it. One constant, easily walked back.

---

## 12. Order of work

1. `floodFillMass` returns mean maturity and fill ratio. Test 2.
2. `tuning/coagulants.ts` — new kinds, thresholds, `coagulantKindFrom`,
   `coagulantArmor`. Tests 1, 3, 4.
3. `systems/formation.ts` — wire identity, armour, `splitAtMass`,
   `sourceMaturity`.
4. `systems/coagulants.ts` — the split, in the update pass. Tests 5, 6, 8.
5. `systems/events.ts` — bloom maturity payload; maturity-biased vein
   sampling. Test 7.
6. `tuning/weapons.ts` — `WEAPON_DAMAGE_SCALE`.
7. `render/coagulants.ts` — colour by source maturity; per-kind seed shape.
8. **Live verification with the debug harness** — confirm Sclerotics
   actually appear where the ring is, Blastomas appear off vein lattices,
   and a split looks like a split.
9. Docs.

---

## 13. Out of scope

| Item | Where |
|---|---|
| Carrier, Bulwark | 4C-2 |
| Multi-part / non-circular bodies | 4C-2 |
| Does calcified tissue block projectiles? | BACKLOG *Ideas* — scoped out by the owner |
| The formation drain/tell visual | BACKLOG — a known §10 gap, own item |
| Event frequency and vein/bloom weighting | BACKLOG — best judged at the 4C gate |
| More AoE weapons (Blastoma's stated counter) | Phase 6 arsenal session |

---

## 14. What changed during implementation

Two constants, both found via the debug-harness methodology (Decision 59)
— neither showed up any other way, since both required watching Sclerotic
actually appear (or fail to) across a real multi-hundred-second run.

**(a) `BLOOM_MATURITY_ACTIVE_RATE`/`PEAK_RATE` raised roughly 4x (0.04/0.07
→ 0.15/0.2).** A bloom's own formation attempt fires at the *instant* peak
begins (`advancePhase` arms `formationTimer` to 0 exactly then), so only
the 4s active-phase window has actually accumulated maturity by the time a
bloom tries to spark itself — not active+peak combined, which the first
pass assumed. At the original rate, a bloom's own epicenter reached only
~0.16 maturity by its own spark moment, nowhere near
`MATURITY_SCLEROTIC_THRESHOLD`. §11's "blooms let armour appear mid-field,
earlier" wasn't happening at all until this was caught and fixed.

**(b) `MATURITY_SCLEROTIC_THRESHOLD` lowered from 0.55 to 0.4.** Formation
reads *mean* maturity over the whole flood-filled footprint, and that mean
dilutes hard toward the surrounding region's average — a single grid cell
can scar up to ~0.97 under sustained combat, but the highest mean any
coagulant actually sparked at, across a 500s max-weapons run even after
fix (a), was ~0.46. 0.55 was simply never reachable in practice. 0.4 sits
with real headroom above `AGE_CEILING` (0.33, so passive aging still can't
trigger it alone) and below what was empirically observed as reachable.
Verified after both fixes: Sclerotics formed regularly (5 of 8 active
coagulants in one run), with armor scaling correctly and rendering in the
correct pale palette.

Everything else — the identity function's structure, the fragmentation
metric, the split mechanics, the +50% weapon damage — shipped as planned
with no changes.
