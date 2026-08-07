# Phase 4C-2 — Carrier and Bulwark

**Status:** planned, awaiting greenlight. Written 2026-08-07.
**Depends on:** 4C-1 shipped (`docs/plans/phase-4c1-wave2-armour.md`).
**Source design:** `docs/sessions/2026-08-05-slime-and-arsenal-rework.md`
§10, §11; Decisions 30, 42, 44.

> **Ends Phase 4, and ends in a playtest gate.** The last two members of
> §10's roster, and the only two that need machinery the codebase doesn't
> have.

---

## 1. Why these two are together

§10 is explicit: *"Carrier and Bulwark should ship as a pair. Carrier makes
the Threat Priority gem meaningful (something that gets worse when
ignored). Bulwark makes it a genuine tradeoff (threat-first targeting
sometimes feeds damage into a wall while motes stream past). Without
Bulwark, Threat Priority is a flat tax rather than a decision."*

**Worth naming honestly: Threat Priority is a Phase 5 gem and does not
exist yet.** So the reason §10 gives for pairing them lands a phase later
than the pair itself. They still work standalone — Carrier is pure
failure-gated pressure, Bulwark is a sponge that arrives first under
nearest-wins targeting (Decision 45) — and building them now is correct
under the project's own ordering rule: **Phase 4 adds questions, Phase 5/6
adds answers.** Carrier and Bulwark *are* the question Threat Priority
answers.

---

## 2. The architectural change: bodies made of parts

Everything about coagulants currently assumes a single circle:

| Site | Assumption |
|---|---|
| `clearAt`'s coagulant loop | `circleOverlapArea(hit, body)` |
| `findCoagulantHit` | `dist > c.radius + hitRadius` |
| `nearestFrontierPoint` | surface distance = `dist - radius` |
| `render/coagulants.ts` | seed circles inside `c.radius` |

Bulwark is specified as *"wide and flat rather than round: a moving wall."*
That breaks all four.

**Chosen approach: model a body as a cluster of circles.**

```ts
parts?: { dx: number; dy: number; r: number }[]   // offsets from centre
```

`radius` stays as the **bounding circle for broad-phase rejection** — every
existing cheap-reject stays exactly as written. Narrow phase iterates
`parts` when present. Absent (the default) means a single part at the
centre, which is precisely today's behaviour, so every Wave 1 kind is
untouched.

Rejected alternatives:

| Approach | Why not |
|---|---|
| Approximate Bulwark as a bigger circle | Loses the "wall" read entirely — the shape *is* the mechanic |
| True ellipse / capsule geometry | Ellipse-circle overlap area is analytically messy; would need a new `circleOverlapArea` sibling and its own tests |
| Rotate/scale the existing circle | Same problem as the ellipse, plus every consumer needs orientation |

The cluster approach **reuses every piece of circle maths already written
and tested**, and it composes: Blastoma (4C-1) is literally described as "a
bag of blobs" and could be retrofitted onto the same model later if its
seed-based rendering proves insufficient.

---

## 3. Carrier

*"Moderate mass, plus a dense corridor to the core. What makes it a Carrier
is the terrain between it and you."*

**Formation gate — the fourth field reading.** Sample the straight line
from the spark point to the core at intervals, averaging revealed density.
Above `CORRIDOR_DENSITY_THRESHOLD` → Carrier. One line sample per formation
attempt; formation happens on discrete event moments, not per tick, so cost
is irrelevant (the same reasoning Decision 43 used for the flood-fill).

**This is the roster's purest failure gate.** §10: *"Keep the field clear
and there is no corridor, so Carriers cannot form at all. A good player
never meets one."* Difficulty as consequence, not as a timer.

**Movement — it eats.** Decision 42 left this hook open deliberately
(*"cheap to leave, annoying to retrofit"*). As a Carrier travels it
consumes grid growth in a small radius and adds it to its own mass, leaving
a visibly thinned trail — §10's "worm track," which is also its tell.

Two things to get right:

- **Conservation.** This is a grid→entity transfer, the same direction as
  formation, so the invariant holds by construction. The existing
  end-to-end conservation test should be extended to cover a feeding
  Carrier rather than assumed to still pass.
- **A swelling cap.** Mass drives radius *and* arrival damage, so an
  uncapped Carrier crossing a saturated field compounds badly. Cap total
  mass gained relative to starting mass.

Decision 42's constraint still holds absolutely: a Carrier **reads from and
writes to** the grid, but is never composited *into* it.

---

## 4. Bulwark

*"High maturity with soft mass behind it. Needs hardened ground with virgin
wilderness at its back — exactly what a mid-field bloom manufactures. Forms
wide and flat rather than round: a moving wall, escorting whatever the
wilderness sends up behind it."*

**Formation gate.** High source maturity (as Sclerotic) **plus** high mass
— the cell 4C-1 deliberately left routing to Sclerotic. That branch splits
here, which is why 4C-1 flags it in code rather than leaving it silent.

**Body.** Parts arranged in a line perpendicular to its travel direction,
so it presents maximum frontage toward the core. Highest armour in the
roster, since armour derives from source maturity (4C-1) and Bulwark forms
from the most hardened ground there is.

**What it does to the fight, with no special-casing:** under nearest-wins
targeting a wide body is closest along a wide arc, so it soaks fire that
would otherwise reach whatever is behind it. That *is* the escort
behaviour, emergent from geometry rather than from an aggro rule — the same
way Decision 45 predicted coagulants would become "just another close
thing."

---

## 5. Tests

1. **Multi-part damage** — a hit overlapping two parts does more than one
   overlapping a single part; a hit inside the bounding circle but between
   parts does nothing. The whole point of narrow phase.
2. **Single-part bodies behave exactly as before** — a regression guard for
   every Wave 1 kind, since `parts` is optional.
3. **Targeting and collision use nearest part**, not centre distance.
4. **Corridor detection** — a dense line spark forms a Carrier; the same
   mass with a cleared corridor does not.
5. **Carrier feeding conserves mass exactly** — grid loss equals entity
   gain, tick by tick.
6. **Carrier swelling is capped.**
7. **Bulwark forms from high maturity + high mass**, where 4C-1 would have
   produced a Sclerotic.
8. **End-to-end conservation across a full feed → transit → arrival
   cycle**, extending the existing invariant test.

---

## 6. Risks

**The parts refactor touches four systems at once.** Damage, collision,
targeting and rendering all change together, and three of them are on the
hot path. Mitigated by keeping `radius` as the broad-phase bound so the
cheap rejects are untouched, and by test 2 pinning existing behaviour
before anything else moves.

**Carrier is the first entity that writes to the grid.** Everything else
either reads it (weapons, targeting) or writes at a discrete moment
(formation, arrival). A continuous per-tick write from a moving entity is a
new pattern, and the conservation invariant is the thing that catches it
going wrong.

**Counters still don't exist.** Bulwark's stated counters are *"AoE,
orbitals, pierce — or switching Threat Priority off"*: pierce and Threat
Priority are Phase 5, and the AoE roster is thin enough that it's already a
BACKLOG item. Same posture as 4C-1 — tune gently, expect the gate to say
"needs Phase 5," and note that's information rather than failure.

**This is the fullest the threat model gets before the arsenal exists.**
Which is exactly why Phase 6's design session was scheduled after it.

---

## 7. Order of work

1. `parts` on `Coagulant`; broad/narrow phase split in `clearAt`,
   `findCoagulantHit`, `nearestFrontierPoint`. Tests 1–3.
2. Corridor sampling in `systems/formation.ts`; Carrier identity. Test 4.
3. Carrier feeding in `systems/coagulants.ts`, with its cap. Tests 5, 6, 8.
4. Bulwark identity and body construction. Test 7.
5. `render/coagulants.ts` — draw parts; Bulwark's plated wall read.
6. Live verification: a Carrier's worm track visible behind it, a Bulwark
   visibly soaking fire for what follows.
7. Docs, and **the Phase 4 playtest gate**.

---

## 8. Out of scope

| Item | Where |
|---|---|
| Threat Priority gem | Phase 5 — the answer to the question this phase asks |
| Penetration, range upgrades | Phase 5/6 |
| More AoE weapons | Phase 6 arsenal session (BACKLOG) |
| Does calcified tissue block projectiles? | BACKLOG *Ideas* |
| Formation drain/tell visual | BACKLOG |
| Event frequency / vein-bloom weighting | BACKLOG — judge at this phase's gate |
