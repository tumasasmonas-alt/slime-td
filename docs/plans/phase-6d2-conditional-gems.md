# Phase 6D-2 — the Conditional gems

**Status:** planned, greenlit as part of the full 6D batch (2026-08-10).
**Umbrella:** `docs/plans/phase-6d-conditional-targeting-gems.md` §3, §3a.
**Ships:** 9 Conditional gems (Shatter and Sterilizer cut as duplicates
of shipped 6B extensions; Corrosion kept).
**Depends on:** 6D-0 — every gem here is damage-conditional, and they want
a difficulty curve that is already the right shape.

---

## 1. What ships, and what each one does

Nine gems. Proposed numbers are first-draft, sized against Amplifier's
+45% flat damage, and expected to move at Phase 8.

| Gem | Effect | Reads |
|---|---|---|
| **Penetration** | Subtracts a flat amount from the target's effective armour before damage | target armour |
| **Virulence** | +damage against high-**maturity** ground | `grid.maturity` |
| **Saturation** | +damage scaled by local **density** at the hit | `grid.growth` |
| **Giant-Slayer** | +damage against **high-mass** coagulants | coagulant mass |
| **Culling** | +damage against **low-mass** coagulants; instantly finishes near-dead ones | coagulant mass |
| **Corrosion** | Hits stack a lasting **armour reduction** on the target | writes a debuff |
| **Desperation** | +damage scaling up as **core integrity drops** | `state.tower.hp` |
| **Proximity** | +damage the **closer to the core** the target is | distance |
| **Momentum** | Damage **ramps while landing hits**; resets on a miss or a kill | per-weapon streak |

Six read the target, two read the player's own state, one writes a
debuff. **None is a flat multiplier** — that is exactly what separates
this class from a second Amplifier class, and it is the bar any
replacement for a cut gem must clear.

## 2. The two cuts, and the one reversal

Caught by auditing the catalogue against **shipped 6B extensions**, which
nobody had done — 6B's own review checked the opposite direction only.

- **Shatter** ❌ — Frost's **Shatter Core** extension is the same
  mechanic under the same name; `chill` and `shatter` are live
  `ClearOptions` fields. Worst case of the three: only Frost applies
  chill, so the gem is **dead in any deck without Frost and redundant in
  any deck with it**, since Shatter Core already grants its bonus "from
  any source."
- **Sterilizer** ❌ — `suppressRegrowth` ships via Frost's **Rime** and
  Immolation's **Ash**.
- **Corrosion** ✅ *(recommended for cutting, reversed by the owner)* —
  overlaps Poison's **Corrosive**, but 6D-0 makes armour matter, and a
  universal armour-strip is then load-bearing rather than a Poison
  speciality.

**Saturation is narrowed** rather than cut: it overlaps Immolation's
**Backdraft** extension and, more subtly, the **Pierce** gem. The
distinction that must hold in the implementation — Pierce *ignores* the
density resistance penalty; Saturation *pays you* for density. If
Saturation is implemented as a resistance bypass it becomes a duplicate
and should be cut instead.

## 3. Mechanism

All nine are RESOLVE-stage, which means **new `ClearOptions` fields and
no second damage path** — arsenal plan §4's one hard constraint, and the
rule 6A-2, 6B-2 and 6C-1 all held to.

Most of the machinery already exists:

| Gem | Hook | New? |
|---|---|---|
| Penetration | `opts.armorIgnoreCap` | **already exists** (Lance's Piercing Core) |
| Corrosion | `opts.armorShred` | **already exists** (Poison's Corrosive) |
| Virulence | new — reads `grid.maturity[i]` in `applyCellDamage` | new field |
| Saturation | new — reads `dens` in `applyCellDamage` | new field |
| Giant-Slayer / Culling | new — read `c.mass` in the coagulant loop | new fields |
| Proximity | new — distance from core, both loops | new field |
| Desperation | new — read `state.tower.hp`, resolved once per call | new field |
| Momentum | new — per-weapon streak counter in `GameState` | new field + state |

**Two of nine need no new mechanism at all.** The rest are single
multiplier terms inside the two loops `clearAt` already runs.

**Ordering rule, inherited from 6B-2's Shatter Core:** a hit that *writes*
a debuff does not itself benefit from it. Corrosion's armour strip applies
after its own damage resolves, or the gem silently doubles its own effect
and stops being a setup card.

**Culling's "instantly finishes near-dead coagulants"** needs a threshold
expressed as a fraction of the coagulant's *own* mass at formation, not an
absolute — otherwise it does nothing to behemoths and deletes motes on
sight.

## 4. Interaction with 6D-0

Deliberate and worth stating, since it changes how these read:

- **Penetration goes from nice to essential** once armour rises and
  scales with time. It is the class's most load-bearing gem (Decision 44
  called it "obvious and load-bearing" before armour existed at all).
- **Proximity is the aura weapons' own zone.** After 6D-0 moves the auras
  out to 165–210px, Proximity rewards exactly the band they now occupy —
  the two changes compound, which is intended.
- **Corrosion only earns its slot because armour rose.** If 6D-0's armour
  change is reverted, re-open the cut.

**The caveat that must not be forgotten:** the catalogue's original fix
for Frost being weak was *a gem* (Shatter). That is fixing an
unconditional problem with a randomly-offered item, and it did not work.
**6D-0's tuning fix is what makes aura weapons viable; Proximity only
makes them exciting.** No gem in this batch is allowed to be load-bearing
for a weapon's basic viability.

## 5. Tests

1. **Each gem changes damage in its condition and not outside it** — the
   direct guard against a mis-wired multiplier. This is the exact class of
   bug 6B-2's own tests caught twice (Shatter Core's literal-vs-fractional
   multiplier; Chill Field's no-op `max()`).
2. **Fraction conventions match every sibling field** — `+X%` expressed
   as a fraction, not a literal multiplier. Shatter Core shipped as a
   *damage reduction* because this convention was broken once already.
3. **No gem is a silent no-op on any archetype** — the 6D-1 harness,
   reused.
4. **Corrosion respects `COAGULANT_ARMOR_FLOOR`**, as Corrosive does.
5. **Corrosion's own hit doesn't benefit from its own strip** (§3's
   ordering rule).
6. **Culling's finisher is mass-relative**, asserted against both a mote
   and a behemoth.
7. **Desperation reads current HP, not max** — and is inert at full HP.

## 6. Order of work

1. Penetration and Corrosion first — both hooks exist, so they prove the
   card/socket plumbing end to end before any new `clearAt` field.
2. The four target-reading multipliers (Virulence, Saturation,
   Giant-Slayer, Culling) — one `applyCellDamage` term each.
3. Proximity and Desperation — resolved once per `clearAt` call rather
   than per cell, since neither varies within a single hit.
4. Momentum last — the only one carrying per-weapon state across ticks.

## 7. Risks

- **Nine conditional multipliers stack**, and with 6D-0's uncapped
  escalation the late game is where they compound. The batch's own
  playtest should specifically look for a build that trivialises the
  curve, not just for whether individual gems work.
- **Saturation vs Pierce** (§2) is the duplication most likely to be
  discovered only in play.
- **Momentum vs Blades' Serration** is a known soft overlap, accepted.

## 8. As-built delta

*To be filled in when this ships.*
