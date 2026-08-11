# Phase 6D-3 — making the shipped gems real

**Status:** planned, greenlit as part of the full 6D batch (2026-08-10),
at **full scope** including the `clearAt` return change (owner's call).
**Umbrella:** `docs/plans/phase-6d-conditional-targeting-gems.md` §4a, §7,
§7a.
**Ships:** no new gems. Makes six *already-shipped* gems do what their
descriptions claim, on every weapon.
**Depends on:** 6D-0 — multiplying a weapon that has no targets proves
nothing.

> **This batch exists because the audit found the game is lying to the
> player.** Socket Fork into Frost today and the inventory screen reads
> *"Splits into two on a kill, each continuing outward."* Nothing splits.
> That is not an undisclosed gap; it is wrong copy attached to a real
> purchase decision.

---

## 1. The three defects

From the umbrella's audit (§4a), verified against code:

1. **Fork, Chaining, Bounce, Ricochet work on Bolt Turret alone.**
   `systems/resolveOpts.ts` exposes `projectileFlags()`; exactly one
   weapon module imports it. `chain.ts` and `missile.ts` push projectiles
   with no behaviour flags at all. `gems.ts:158` discloses these as
   "projectile archetype only" — **the truth is one weapon of ten.**
2. **Multishot and Formation divide damage by emission count
   unconditionally** (`blades.ts:133`, `frost.ts:68`), making them exactly
   **zero** on Blades and a **downgrade** on Frost.
3. **Homing is an explicit no-op on `beam`** — honest, disclosed in the
   description itself, and left alone. Listed for completeness.

Six of twenty gems, dead or worse on most of the roster.

## 2. Step 1 — four weapons, no new mechanism

`chain.ts`, `missile.ts`, `fission.ts` and `lance.ts` need to call
`projectileFlags(state, key)` and merge it into the flags they already
pass, exactly as `bolt.ts` does. Nothing else differs between them.

**This takes four gems from 1 weapon to 5, and it is the cheapest fix in
the entire 6D batch.** It ships first, before any design work, so that
the rest of the batch is measured against a baseline that already works
where it was supposed to.

Watch for: Chain Bolt already has its own hop machinery (`fireChain`).
The Chaining *gem* must compose with it, not double it — a chain weapon
with the Chaining gem should hop further, not hop twice per hop.

## 3. Step 2 — the `clearAt` return change

**Full scope, per the owner's call.** `gems.ts:158`'s stated blocker is
real for the literal on-kill readings: `clearAt` returns only a mass
figure, so no caller can know *which* coagulant it hit or killed.

**The change:** `clearAt` returns a richer result — the mass removed
(unchanged, for every existing caller) plus the coagulants it touched and
which of them died. The existing scalar return is preserved as the
default read so the ~15 call sites don't all change at once.

This is deliberately the **same shape** as 6C-1's `ClearOptions.shape`
generalization, which is the precedent that makes it safe:
- Extend the one damage path; never add a second (arsenal §4's hard
  constraint, held since 5A).
- **Prove the existing behaviour byte-identical before adding anything
  new** — 6C-1 required this of the disc path and it is required here of
  the scalar return. Non-negotiable, same as last time.

## 4. Step 3 — the per-archetype readings

With Step 2 landed, the four gems get real readings everywhere. Several
reuse machinery that already shipped, which is the strongest evidence
these are the *right* readings rather than invented ones — Immolation's
Fork **is** Second Ring; pulse Ricochet **is** a Shockwave ring with a
negative speed.

| Gem | orbital (Blades) | pulse (Frost/Shockwave) | ring (Immolation) | cloud (Poison) | beam (Lance) |
|---|---|---|---|---|---|
| **Fork** | hit sheds a small projectile from the blade's own position | pulse spawns a second smaller pulse at its rim | second ring at 1.5× radius *(Second Ring's machinery)* | splits into two smaller clouds on expiry | splits into two diverging beams past its endpoint |
| **Chaining** | hit arcs to the nearest target beyond the orbit | follow-up pulse centred on the farthest point touched | delayed outward ring at 2× radius | tendril cloud toward the nearest mass | continues from its endpoint to a second target |
| **Bounce** | blade jumps to a different orbit radius on hit | re-emits a smaller pulse offset from centre | alternates inner/outer ring each tick | hops to the next mass on expiry | reflects to a second target |
| **Ricochet** | blades reverse orbit direction, re-sweeping ground | an **inward**-travelling ring after the outward one *(Shockwave's machinery)* | a second tick at reduced power shortly after | drift direction reverses | fires again along the same line at reduced power |

Most of these are weapon-local — the weapon already knows its own hit
position, and 6A-2's deferred-emission queue already exists. Step 2 is
what makes the *on-kill* variants (Fork's "on a kill", Bounce's
coagulant-to-coagulant hop) real rather than approximated.

**Termination by construction**, the discipline Salvo's `armAt` (6B-2)
and Chain Fission's generation counter (6C-1) both used: every re-emission
here carries a generation counter checked against its parent's, so no
reading can produce an unbounded cascade. This matters more than usual —
Ricochet on a ring plus Echo plus Barrage is a three-way multiplier.

## 5. Step 4 — the emission-multiplication rule

The rule that replaces unconditional division:

> **Divide damage only when the extra emissions can overlap the same
> target. When they cover new ground, damage stays whole.**

This is not a buff for its own sake — it makes the division *correct* in
the case where it currently applies, and removes it where it was never
justified.

| Archetype | Multishot becomes | Damage |
|---|---|---|
| projectile | unchanged — a spread that can converge on one target | **divided** (as today) |
| **orbital** | extra orbit **centres**, each carrying blades, each orbiting the core at its own radius *(the owner's satellite reading)* | **whole** |
| **ring** | concentric rings further out | **whole** |
| **pulse** | sequential waves at full radius, not simultaneous shrunken ones | **partial** (later waves reduced, like Echo) |
| cloud | extra clouds around the point, less shrunken than today | **partial** |
| beam | unchanged — diverging beams can converge | **divided** |

**Formation** is the fixed-pattern variant of each and needs no separate
design once Multishot is right.

**The renderer is the real cost here.** The satellite orbit reading needs
`render/` to draw blades around a moving centre rather than the core, and
concentric rings need Immolation's ring visual to handle more than one
radius. Second Ring already proved the latter is possible.

## 6. Step 5 — fix the copy

`tuning/gems.ts`'s class comment argues against disclosing the gap in the
gem descriptions, on the grounds that it *"would read as an
unfinished-game admission mid-run."* That was defensible when the gap was
one batch old and scheduled. **Once this batch lands the argument is moot
— the descriptions become true.**

The audit's real lesson goes in the record instead: a gem description is
a purchase decision, and copy that describes intent rather than behaviour
is a bug with a UI, not a documentation gap.

## 7. Tests

1. **No gem is inert on any weapon it is legal on.** For each of the six
   gems × each of the ten weapons: socketing it must produce a measurably
   different outcome than not socketing it. **This is the test whose
   absence allowed the whole defect class**, and it is the batch's
   deliverable as much as the code is.
2. **`clearAt`'s scalar return is byte-identical** for every existing
   caller, proven before the new readings are added (§3).
3. **Multishot is never a downgrade** — for each archetype, total mass
   removed with the gem ≥ without it. Blades' exact-zero and Frost's
   negative are the two regressions this pins.
4. **Every re-emission terminates** — no cascade exceeds its generation
   bound, asserted with Ricochet + Echo + Barrage stacked.
5. **Chain Bolt's own hops compose with the Chaining gem** rather than
   doubling (§2).
6. **Descriptions match behaviour** — a test that every gem legal on an
   archetype has a non-placeholder reading wired, so copy and code can't
   drift apart again silently.

## 8. Order of work

1. Test 1's harness (fails for six gems × nine weapons immediately —
   which is the proof it tests something).
2. §2's four call sites. Re-run test 1: it should now pass for four more
   weapons with zero new mechanism.
3. §3's `clearAt` return, with test 2 gating it before anything consumes
   the new data.
4. §4's readings, archetype by archetype, weapon-local ones first.
5. §5's multiplication rule, renderer last.
6. §6's copy pass.

## 9. Risks

- **This is the largest 6D sub-batch**, and it touches `clearAt` — the
  single hottest and most load-bearing function in the codebase, guarded
  by three documented prototype bugs.
- **The satellite renderer is genuinely new drawing**, not a parameter
  change, and §9½'s visual-cost history says this project's estimates are
  least reliable exactly here (6A-2's "cheap" estimate was measured on the
  wrong axis).
- **Ricochet + Echo + Barrage on a ring** is the combinatorial case; the
  3C playtest already found a frame-rate cliff from a similar stack, which
  is why `systems/emissions.ts` has a cap at all.

## 10. As-built delta

**Partial ship, 2026-08-11 — Steps 1–3 landed, Steps 4–5 did not.** Full
reasoning: Decision 92.

- **Step 1** shipped as planned for `chain.ts`, `missile.ts`, `fission.ts`.
  `lance.ts` was moved out of Step 1 into Step 3 instead — its beam has no
  `Projectile` entity, so `projectileFlags()` doesn't compose onto it the
  way it does for the other three; the §4 table already scoped Lance's
  readings as bespoke, so Step 3 was always going to touch it regardless.
- **Step 2** shipped as planned: `ClearResult` (`removed`/`touched`/
  `killed`), scalar return proven byte-identical first, zero production
  call sites needed migration (only test assertions did).
- **Step 3** shipped in full, including the owner's explicit choice of
  full bespoke Shockwave mechanisms (not the Ricochet-only fallback) when
  asked mid-batch. Every one of the six weapon archetypes (Blades,
  Frost/Shockwave, Immolation, Poison, Lance) now has a real, weapon-
  appropriate Fork/Chaining/Bounce/Ricochet reading, matching §4's table.
  One implementation snag worth knowing before touching this code again:
  Blades' Chaining reading needed an inline nearest-excluding-X scan
  rather than `systems/targeting.ts`'s `bestCoagulant()`, which cannot
  express that query — see Decision 92 for the full explanation.
- **Step 4 (the emission-multiplication rule) and Step 5 (copy fix, the
  §7 test matrix, this delta's own completion) are unbuilt.** Multishot/
  Formation still divide damage unconditionally — still a precise zero on
  Blades, still a downgrade on Frost. `tuning/gems.ts`'s Multishot/
  Formation copy is therefore still wrong; its Fork/Chaining/Bounce/
  Ricochet copy is now true. Pick up at §8 step 5 (`emissionPlan`'s
  `plan.count` divisor in `blades.ts`/`frost.ts`/every other weapon that
  reads it) — the renderer work (satellite orbit centres, concentric
  rings) is the part §9 already flagged as the real cost and the least
  reliably estimated.
- Cut here by the same weekly-limit constraint Decisions 88/89 already
  recorded for the inter-batch playtest gate — this was a clean stopping
  point (everything shipped is tested and green), not an interrupted one.
