# Phase 5B — the enhancement, socket and card-pool economy

**Status:** 📋 Proposed, awaiting the project owner's review. Nothing here
is decided or built. Written 2026-08-08, immediately after 5A shipped
(Decision 70).

**Depends on:** 5A (`weapons/pipeline.ts`), shipped and verified.
**Source design:** `docs/plans/phase-5-6-arsenal.md` §5, §6, §9F, §11, §12,
§13's 5B row; Decisions 39–41, 44.

---

## 1. The scope tension this plan exists to surface

5B's charter, per the arsenal plan's own phasing table, is *framework
only — no new content, that's Phase 6*. Working through the concrete data
model surfaced a real problem with that as a literal reading:

**Weapon-socketed support gems (Amplifier, Overclock, Multishot — all 65
of them) are themselves Phase 6 content, not Phase 5 framework.** If 5B
ships the socket *mechanism* with nothing to put in it, a level-up draws
from a pool that's largely empty on the weapon side until Phase 6 starts
landing gems. That's an honest reading of "framework before content," but
it risks 5B being untestable in the way that actually matters — a
socketing loop nobody can feel is a socketing loop nobody can judge at
the gate.

**Core gems are a different story.** Five of the twelve (§9F) —
Vitality, Regeneration, Plating, Magnetism, Avarice — are direct ports of
mechanics the game already has, working, today: the `maxHp`/`regen`/
`armor`/`pickup`/`xpGain` passives. Porting them onto "3 sockets, real
choice" rather than "unlimited concurrent levels" is bounded, low-risk
work, not new content authorship.

**§2 proposes: 5B ships the core-gem track as real, working content**
(the five ported passives), and ships the **weapon-socket mechanism**
fully wired but genuinely empty of gem types until 6A — extensions and
weapon gems are visibly "coming soon" rather than silently absent. This
keeps the socketing loop judgeable (core gems prove the model end to end)
without smuggling Phase 6 catalogue work into a framework phase. **This
is a scope call, not a decision** — flagged here rather than made
unilaterally, exactly because it changes what "playing after 5B" feels
like. See §8, Q1.

---

## 2. What changes in the data model

### `state.ts`

```ts
// Replaces the old maxLevel-capped "weapon level" — points are the
// enhancement investment, uncapped (Decision 40, no cap / no DR).
// state.weapons[key] keeps its current meaning exactly: points spent on
// that weapon. No structural change to this field.

enhancementPool: number;        // unspent points, banked from level-ups
weaponSlots: number;            // starting 3 (S5) — Phase 7 raises this

interface GemInstance {
  id: number;                   // unique per pickup, since duplicates are legal across weapons
  kind: GemKind;                // 'amplifier' | 'overclock' | ... (Phase 6 populates the union)
}

gemInventory: GemInstance[];    // unsocketed gems — picked up, not yet placed
coreGems: (CoreGemKind | null)[3];  // the 3 fixed core sockets

interface WeaponSockets {
  extensions: { kind: string; level: 1 | 2 | 3 }[];  // one entry per extension type currently held
  gems: GemInstance[];          // gem instances currently socketed here
}
weaponSockets: Partial<Record<WeaponKey, WeaponSockets>>;
```

**Why `state.weapons[key]` doesn't change shape.** It already stores "how
many points are invested in this weapon" — that *is* the enhancement
count. The only change is what reads it: `WeaponDef.maxLevel` stops
gating the card pool (§4), and a new pure function derives socket count
from it.

### `tuning/sockets.ts` (new)

```ts
// The 0/3/8/15/24 ladder (S5), as a pure function — the one place this
// shape lives, so retuning it during the Phase 5 gate is a one-line edit.
const SOCKET_THRESHOLDS = [0, 3, 8, 15, 24];
export function socketCount(pointsInvested: number): number {
  let count = 1;
  for (const t of SOCKET_THRESHOLDS.slice(1)) {
    if (pointsInvested >= t) count++;
  }
  return count;
}
```

Tested directly against the table in §5 — an invariant test, not a
mechanism test: `socketCount` never decreases as `pointsInvested` rises,
and matches the five named breakpoints exactly.

---

## 3. Enhancement points: banked, not auto-spent

**5C ships the real +/- control.** Without it, 5B needs *some* answer for
what happens to a banked point so the game stays playable and testable
through this phase — the same problem 4A solved with a crude placeholder
rather than shipping blind.

**Proposed placeholder policy, replaced wholesale by 5C:** each level-up
banks one point into `enhancementPool` (not auto-spent). A player can
still complete a run with every point sitting unspent — the run is not
broken, just under-optimized, which is an honest placeholder state rather
than a fabricated one. `updateHud` gets one new line: unspent points, so
the gap is visible rather than silently inert (Decision 11's rule again —
a mechanic's state needs to be legible even in placeholder form).

**Rejected: auto-spend evenly across decked weapons.** Tempting, but it
manufactures behaviour ("the game is choosing your build for you") that
5C's real +/- will immediately contradict once it ships — a placeholder
should be legibly *incomplete*, not a fake version of the real feature.
Banked-and-idle is honest; auto-spent-evenly is not.

---

## 4. Card pool restructuring

### Weapon level cards are removed outright

Decision 40's core move, not yet implemented — today's `buildCardPool()`
still offers `{ kind: 'weapon', nextLevel }` cards. **5B deletes that
branch entirely.** Weapon power now comes only from `enhancementPool`
spend (§3), never from a card pick.

### New-weapon cards are gated on free slots

Today any weapon under `maxLevel` is offered, uncapped by anything — a
single run can currently equip all seven. **5B adds the gate the slot
system requires**: a "new weapon" card only appears if
`Object.keys(state.weapons).length < state.weaponSlots`. This is a real
behaviour change enabled by, and required by, the slot system existing at
all — not a change that could have shipped in 5A.

### Extensions level 1→3, then leave the pool permanently

The owner's rule (settled 2026-08-08), better than either option
originally offered: an extension picked at level 3 is removed from the
card pool **entirely** — no repeat offer, no drop, no orbital-trade-ship
substitute (that stays parked for Phase 6/7 per §11). Requires tracking
level per extension-per-weapon in `WeaponSockets.extensions` (§2).

**Per §1, no real extensions ship in 5B.** The leveling-and-removal
*mechanism* is built and tested against a placeholder extension type or
two (enough to prove the invariant — "a maxed extension is provably never
offered again," the 5A phasing table's own gate criterion) without
authoring real per-weapon mechanics, which is 6B's job.

### Core gems draw from a separate track

**Cadence not yet specified anywhere in the design doc — a genuine gap,
not an oversight.** Proposed: every 3rd level-up shows a core-gem draw
(3 choices from the 5 ported core gems, §1) instead of the normal weapon
draw. Flagged in §8, Q2 — a pacing number, cheap to retune, not worth
blocking on.

### Four cards per draw, plus a bundle card every N levels

Both settled 2026-08-08. `N` is unspecified — proposed **every 5 levels**
as a starting guess, tuned at the gate. The bundle card's actual packages
(§11: *"three packages, each holding 2–3 related cards"*) need real gem
content to build from — **the bundle mechanic ships in 5B, its first real
packages ship whenever 6A's gems exist to fill them.** Until then, a
5B-era bundle draw offers packages of whatever's actually available
(likely just core gems + a placeholder extension pairing) — thin, but
honest, same reasoning as §1.

---

## 5. Assist credit — the hard part, done here rather than deferred

**Why this can't wait for Phase 6.** Solvent/Repulsor/Marker (Phase 6
weapons) destroy no mass, so without assist credit they'd generate zero
XP the moment they ship — §14 of the arsenal plan already flagged this as
the single largest hidden cost. Building the *plumbing* now, against the
existing seven weapons (all of which currently destroy mass directly and
would credit 100% to themselves), means 6D's actual no-damage weapons
have something to plug into rather than a system built in a rush against
deadline pressure.

**The mechanism:**

```ts
// A short-lived tag on whatever a "setup" effect touched — marked,
// softened, displaced. No Phase 6 weapon uses this yet; every current
// weapon's clearAt call passes no assist tag, so 100% of credit goes to
// whichever weapon actually destroyed the mass, exactly today's
// behaviour. This is pure plumbing until Phase 6 has a producer.
interface AssistTag {
  weaponKey: WeaponKey;
  expiresAt: number;   // state.time-relative
  share: number;        // 0..1, fraction of resulting XP credited to weaponKey
}
```

Coagulants get `assistedBy?: AssistTag`; grid cells would need the same,
but **grid-cell assist tagging is deferred to Phase 6D** when a
grid-affecting setup weapon (Solvent) actually exists — adding a third
per-cell array now, for a producer that doesn't exist, is exactly the
kind of premature plumbing this project's own conventions warn against.
Coagulant-only assist tracking is sufficient to prove the mechanism and
keeps 5B's grid-memory footprint unchanged.

`clearAt`'s XP accounting (`grid/clear.ts`) gains one branch: if the
target carries an unexpired `assistedBy`, split the XP basis by `share`
between the destroying weapon and the assisting one. **Zero behaviour
change for every weapon that exists today** — nothing sets `assistedBy`
yet, so this is dead code exercised only by a direct unit test until
Phase 6 has a producer. Flagged plainly as such rather than silently
built and forgotten.

---

## 6. What 5B does *not* touch

- **`damageMult`/`atkSpeedMult` stay global**, exactly as today. §9A's
  Amplifier/Overclock becoming *per-weapon socketed gems* rather than
  flat global passives is real, Phase-6-shaped work — it changes what
  every weapon's `clearAt`/cooldown call site reads from, and doing it
  now without real gems to socket would be speculative plumbing. Noted
  as a known Phase 6A dependency, not built here.
- **No inventory UI.** 5C's job, entirely. 5B is verified via tests and
  the debug harness, same as every "logic before UI" phase this project
  has shipped (4A's placeholder is the closer analogy than "no UI at
  all," but 5B genuinely has no in-world visual to show — see §7).
- **No weapon-slot purchasing.** Phase 7 doesn't exist yet; `weaponSlots`
  starts at 3 and stays there through 5B/5C/6.
- **The `pickThree` biased shuffle gets fixed here** (carried over from
  the 5A audit, §13 of the arsenal plan) — small, but belongs before the
  dilution measurement this phase's own gate depends on.

---

## 7. Order of work

| Step | Work | Test |
|---|---|---|
| **5B-1** | `tuning/sockets.ts`, `enhancementPool`, `weaponSlots`, starting kit (Bolt/Chain/Poison per §12.4) in `startRun()`. Fix `pickThree`'s shuffle. | `socketCount` invariant; starting-kit test |
| **5B-2** | Card pool: remove weapon-level cards, add slot-gated new-weapon cards, extension leveling-and-removal (placeholder extension types), core-gem separate track, 4-card + bundle draws. | Card-pool composition test; "a maxed extension is never offered again" |
| **5B-3** | Core gems: port the five existing passives onto 3-socket selection. Remove the old unlimited-concurrent-passive model. | Regression: existing passive-effect tests still pass, now gated through sockets |
| **5B-4** | Gem inventory + `WeaponSockets` model; socket-closing-returns-to-inventory on point withdrawal (no destructive respec, §5 of the arsenal plan). | Conservation test: a gem is never lost, only relocated |
| **5B-5** | Assist credit plumbing (§5), coagulant-only. | Direct unit test with a synthetic `assistedBy` tag; confirm zero behaviour change with none set |
| **▶ GATE** | Full suite + debug-harness run: a max-level run banks and can (via a temporary debug-only spend, same spirit as 5A's removed bridge) allocate points, draws cards from the restructured pool, core gems socket correctly. | |

---

## 8. Open questions — need the owner's call before 5B-2

1. **Does 5B ship thin** (mechanism only, mostly-empty weapon-gem pool)
   **or pull forward a handful of real gems** (Amplifier, Overclock,
   maybe Multishot) so the socketing loop is actually judgeable at the
   gate? §1. Recommend: ship thin, and treat "is the loop still worth
   judging with an empty pool" as itself a finding the gate produces —
   but this is a real tradeoff, not an obvious call.
2. **Core-gem draw cadence** — every 3rd level-up is a placeholder guess
   with no basis in anything settled. §4.
3. **Bundle card interval `N`** — same, a pacing guess (proposed: 5).
4. **Should `enhancementPool` display in the HUD before 5C's real UI
   exists**, so an unspent point isn't invisible? Recommend yes (§3) —
   but it's a scope addition to "just the model," worth confirming.
