# Phase 5B — the enhancement, socket and card-pool economy

**Status:** ✅ **Complete — implemented and verified 2026-08-08, Decision 71.**
5B-1 through 5B-4 and 5B-6 shipped. **5B-5 (assist credit) was dropped**
— implementation surfaced that the mechanism as designed doesn't solve
the problem it names; raised, and the owner confirmed dropping it the
same session (§5). Moved to `docs/BACKLOG.md` *Ideas*. **No outstanding
items.** 380/380 tests, typecheck clean, build clean, verified live via a
425-second/58-level debug-harness soak test.

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

**Settled 2026-08-08: 5B ships the core-gem track as real, working
content** (the five ported passives), and ships the **weapon-socket
mechanism** fully wired but genuinely empty of gem types until 6A. This
keeps the socketing loop judgeable — core gems prove the model end to end
— without smuggling Phase 6 catalogue work into a framework phase.

The consequence to accept honestly: **at the 5B gate, the weapon half of
the socket system will have nothing in it.** That is expected, not a
failure, and the gate should be read accordingly — it can judge "does
socketing work, does the core loop feel right, how does the restructured
pool draw," but it *cannot* judge specialise-vs-spread, which needs 6A's
gems. Recorded here so a thin-feeling gate reads as information rather
than a problem.

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

**Placeholder policy, settled 2026-08-08, replaced wholesale by 5C:** each
level-up banks one point into `enhancementPool` (not auto-spent). A player
can still complete a run with every point sitting unspent — the run is not
broken, just under-optimized, which is an honest placeholder state rather
than a fabricated one.

**`updateHud` gets one new line showing unspent points** (settled — Q4).
Decision 65's rule, which 4A learned the hard way: it is not enough for a
mechanic's state to exist, it has to be *legible in the state the mechanic
actually produces*. A banked point nobody can see is the `frozen` mistake
in a new costume.

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

### Core gems: a guaranteed slot, every second level-up

**Settled 2026-08-08.** Not a whole separate draw, and not every level:
on **even-numbered level-ups**, one of the four cards is guaranteed to be
a core gem; on odd level-ups all four are weapon-side.

This is the better shape than either option originally offered. A whole
separate core draw interrupts the level-up rhythm and, with only 3 core
sockets, goes dead quickly once they're filled. A guaranteed slot in
*every* draw permanently spends a quarter of the pool on defence. Every
second level-up gives roughly one core offer per socket across an early
run, keeps three of four slots offensive on average, and never stops the
normal rhythm.

**One fallback to build:** if the core pool is genuinely exhausted — all
five owned, all three sockets full, nothing left that could change the
build — the guaranteed slot falls back to a weapon-side card rather than
offering a dead pick. Same "never offer a dead card" rule §11 of the
arsenal plan already establishes.

### Four cards per draw; the bundle card defers to 6A

Four-card draws ship in 5B. **The bundle card does not** (settled
2026-08-08).

Its whole purpose is handing out a *coherent themed package* — §11's
example, `Detonation + Penetration` teaching the armor lesson in a single
pick, which no individual card can do. With 5B's weapon-gem pool empty
(§1), a bundle could only bundle core gems and placeholder extensions:
not a thin version of the mechanic, a fundamentally different and worse
one. Judging the pacing beat against that would produce a misleading
result.

**Ships in 6A**, alongside the first real gems that give packages
something to be made of. The interval `N` is deferred with it — a pacing
number is not worth guessing at a phase early.

---

## 5. Assist credit — dropped. A re-discovery during implementation.

**Status: ✅ dropped, confirmed by the project owner 2026-08-08** —
*"it's fine to drop assist credit if the player will still get the XP
after the mass is dead."* They will; that was the finding. Moved to
`docs/BACKLOG.md` *Ideas* with the full reasoning and a note on what
would revive it.

Working through the actual mechanics to implement this step found that,
as designed, it does not solve the problem it was written to solve.
Raised rather than built, per the ground-truth override protocol
(`CLAUDE.md`, Decision 22) — the same posture Decision 62 used for the
behemoth-timing pushback.

**The original reasoning:** *"Solvent, Repulsor and Marker destroy no
mass, and XP is destroyed mass — so without assist credit they'd
generate zero XP and be traps."*

**What implementation surfaced:** XP in this game is a **single global
pool** (`state.tower.xp`), not tracked per-weapon anywhere. Any kill, by
*any* weapon in the deck, already pays into that one pool — a build
running Solvent + Bolt gets full XP credit today, right now, with no
change needed, because Bolt's own `clearAt` call generates it regardless
of what softened the target first. Enhancement points are banked the
same way (`state.enhancementPool`, §3 above) — globally, not per-weapon.

**So "assist credit" — a mechanism for *redistributing* XP between the
weapon that landed the kill and the weapon that set it up — has nothing
to attach to.** There is no per-weapon economy anywhere in this design
for it to feed. The `AssistTag`/`share` mechanism from the original
draft would be real code with a real test, permanently exercising
nothing, for a consumer that isn't planned to exist.

**The actual risk the original text was reaching for** is narrower than
"assist credit" implies: a deck built from *only* no-damage weapons
(hypothetically, all of Solvent + Repulsor + Marker with no damage
dealer at all) generates zero kills and therefore zero XP. But no
version of assist credit fixes that either — if nothing in the deck ever
calls `clearAt` with power, there is no XP event to redistribute in the
first place. **That outcome reads as a legitimate consequence of a bad
build, consistent with the game's own philosophy** (Decision 27: no
scripted safety net, the field's state is the honest readout of how the
player is doing) **— not a system failure needing a fix.**

**Recommendation, accepted: do not build this.** If Phase 6 support
weapons turn out to *feel* bad despite the economy being fine — a real
possibility, since a player watching Solvent do nothing to their kill
count is a UX concern even with XP flowing correctly — the fix belongs at
the UI/feel layer (crediting a kill notification to the setup weapon,
say), not the economy layer. That is a Phase 6 question, judged against
real gems, not a Phase 5B one.

**Flagged for the owner rather than silently dropped**, since removing a
committed plan item is exactly the kind of change this project's
conventions say to raise rather than decide alone. Confirmed and closed
the same session; **Phase 5B is complete with no outstanding items.**

---

## 6a. The render-layer structural pass

*Added 2026-08-08, settled the same session. Prompted by the owner's
question about how weapons respond visually to gems and extensions.*

5A made gems O(1) in weapons for **behaviour**. It did nothing for
**rendering**, and an audit found the render layer is split down the
middle:

| Module | Pattern |
|---|---|
| `render/projectiles.ts` | **Generic** ✅ — reads `p.color`/`p.radius` off the entity |
| `render/clouds.ts` | **Generic** ✅ — same |
| `render/orbitals.ts` | **Weapon-coupled** ❌ — hardcoded ninja-star, `BLADE_COLOR`, `POINTS = 4` |
| `render/novaFx.ts` | **Weapon-coupled** ❌ — hardcoded colour, and a **single slot** rather than a list |

**Two concrete fixes, both small, both applying the pattern the other two
modules already use** — the entity carries its own appearance, the
renderer reads it:

1. **`OrbitalVisual` gains appearance data.** Today it is `{x, y, radius}`
   with no identity, so the Orbital Conversion gem — which puts *any*
   weapon's effect on an orbiting body — would draw Frost Nova as a cyan
   shuriken. Adding a shape/colour field makes generic orbitals possible
   and turns that gem from the worst case in the catalogue into a free
   one (arsenal plan §9½).
2. **`state.novaFx` becomes a list.** It is `NovaFx | null` — a single
   slot. Two pulse weapons firing in the same frame overwrite each other.
   **This is a latent bug today**, not a hypothetical: Immolation Ring
   exists now and is scheduled for its visual in 6B, and Shockwave lands
   in the same batch. Either one makes this real.

**Why 5B and not 6A** (settled): both are structural rather than content,
they are cheap now and annoying to retrofit, and doing them here means
6A's first real gems land against a render layer that can already carry
them — rather than 6A shipping a refactor *and* its own content, with the
novaFx overwrite arriving as a confusing visual bug first.

**Explicitly not in scope:** no new visuals, no new entity types, no
gem-response rendering. This is the same kind of pass 5A was — moving
structure so future content is cheap, changing nothing the player sees.
`drawOrbitals` must still draw the identical shuriken for Blades
afterward, and that is the test.

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
- **No new visuals.** §6a moves render *structure* only. Immolation
  Ring's missing visual stays a 6B item; nothing gains a gem-response
  visual until there are gems.
- **No pre-run weapon select.** Settled 2026-08-08 as **Phase 6-0**,
  moved forward from Phase 7 so Phase 6's weapon batches are playtestable
  by the owner rather than only through the debug harness. 5C should
  build its inventory from components that screen can reuse.
- **No weapon-slot purchasing.** Phase 7 doesn't exist yet; `weaponSlots`
  starts at 3 and stays there through 5B/5C/6.
- **The `pickThree` biased shuffle gets fixed here** (carried over from
  the 5A audit, §13 of the arsenal plan) — small, but belongs before the
  dilution measurement this phase's own gate depends on.

---

## 7. Order of work

| Step | Work | Test |
|---|---|---|
| **5B-1** | ✅ `tuning/sockets.ts`, `enhancementPool`, `weaponSlots`, starting kit (Bolt/Chain/Poison per §12.4) in `startRun()`. Fixed `pickThree`'s biased shuffle (now `shuffled()`, Fisher-Yates). HUD line for unspent points. | ✅ `socketCount` invariant (`tuning/sockets.test.ts`) |
| **5B-2** | ✅ Card pool: weapon-level cards removed entirely, slot-gated new-weapon cards, extension leveling-and-removal (`PLACEHOLDER_EXTENSION_KIND`), 4-card draws, guaranteed core slot on even level-ups with its exhausted-pool fallback. **No bundle card** (still 6A). Logic split into `systems/cards.ts` (pure, testable) with `ui/upgradeCards.ts` as a thin DOM wrapper — the project's existing systems/render separation, applied to UI. | ✅ `systems/cards.test.ts` — pool composition, "a maxed extension is never offered again," core slot on even/absent on odd, exhausted-pool fallback |
| **5B-3** | ✅ Core gems: `CoreGemKey` reuses `PassiveKey`'s own values directly rather than a translation layer — `state.passives[key]` stays the exact field driving `damageMult`/`atkSpeedMult`/etc., untouched. `state.coreGems` (3 fixed slots) is new bookkeeping for which physical sockets are filled; duplicates disallowed (implementation-time call, undocumented in the design — flagged in the report). `damage`/`atkSpeed` deliberately stay on the pre-5B unrestricted mechanism (§6). | ✅ Existing `passives.test.ts` (24 tests) passes completely unmodified — confirms the port didn't touch the multiplier math |
| **5B-4** | ✅ `GemInstance`/`WeaponSockets`/`gemInventory` in `state.ts`; `systems/sockets.ts`'s `withdrawPoints()` — gems evict to inventory most-recently-socketed-first, **extensions clamp the withdrawal rather than ever being destroyed** (no extension-inventory exists to return them to). No live trigger yet (5C's +/- ships it); tested directly, same pattern as 5A-era plumbing. | ✅ `systems/sockets.test.ts` — conservation (a gem is never lost, only relocated), the extension clamp, zero-points-to-withdraw no-op |
| **5B-5** | ❌ **Not built.** Assist credit doesn't solve the problem it names — see §5. Withheld pending the owner's confirmation. | — |
| **5B-6** | ✅ Render structural pass: `OrbitalVisual` gained `shape`/`color`/`glowColor`, `state.novaFx` is a list. Blades/Frost moved their hardcoded render constants onto the entity (zero visual change — same hex values). `render/orbitals.ts`/`render/novaFx.ts` now dispatch on entity data instead of assuming a specific weapon. | ✅ `systems/novaFx.test.ts` gained a two-simultaneous-effects case proving the old single-slot overwrite is fixed |
| **▶ GATE** | ✅ Full suite (380/380) + a live debug-harness run: starting kit confirmed (Bolt/Chain/Poison), 8-level card-pool composition dump confirmed the core-gem cadence and the absence of any `'weapon'`-kind card, a maxed extension confirmed to vanish from the pool, and a 425-second/58-level random-pick soak test with all 7 weapons at max ran with zero console errors and filled all 3 core sockets with no duplicates. | |

---

## 8. Settled 2026-08-08

| # | Question | Call | Where |
|---|---|---|---|
| 1 | Thin 5B, or pull forward real weapon gems? | **Thin** — core gems real, weapon side empty until 6A | §1 |
| 2 | Core-gem cadence | **Guaranteed slot, every second level-up**, with an exhausted-pool fallback | §4 |
| 3 | Bundle card interval | **Deferred entirely to 6A** — needs real gems to bundle | §4 |
| 4 | Enhancement pool visible pre-5C? | **Yes** — one HUD line | §3 |
| 5 | When does the render structural pass happen? | **5B**, as step 5B-6 | §6a |
| 6 | When does a pre-run weapon select land? | **Phase 6-0**, moved forward from Phase 7 | §6 |
| 7 | Classify all weapons/gems by visual cost? | **Yes** — done, arsenal plan §9½ | — |

**Nothing is blocking.** Two of the first four went against the plan's own
proposals and both are improvements: the guaranteed-every-second-level
core slot avoids both failure modes the original options had, and
deferring the bundle card avoids judging a mechanic by a version of it
that couldn't work.

**5–7 came from the owner's UI/UX question** and produced the session's
sharpest finding: the visual-cost classification (arsenal plan §9½) showed
that **four of the six expensive transformative gems share rendering with
a weapon, and the old phase order shipped the gem first in every case.**
6E and 6F are now swapped so the weapons establish the visual vocabulary
and the gems generalise it, rather than each gem inventing rendering its
weapon would then duplicate.

### Still genuinely open, deliberately

- **The socket ladder's numbers** (0/3/8/15/24) are untested against a
  real XP curve. `tuning/sockets.ts` exists as a single pure function
  specifically so the gate can retune them in one line. The live soak
  test reached level 58 in ~7 minutes of simulated time on a max-weapons
  build — an extreme upper bound, not a realistic pacing signal.
- **Whether the gate can conclude anything about enhancement-as-slider**
  with an empty weapon-gem pool. Probably not — see §1. That is the
  known limit of this gate, not a defect in it.
- ~~**Assist credit** (§5) — awaiting the owner's confirmation~~ — settled
  the same session: confirmed dropped, moved to `docs/BACKLOG.md` *Ideas*.

### One implementation-time call, not written down anywhere before now

**Core gems disallow duplicates** — at most one of each of the five
types active across the 3 sockets, never two copies of the same one.
Neither the arsenal plan nor this plan's earlier drafts specified this;
the general weapon-gem duplicate rule (§5 of the arsenal plan: same gem
across different weapons, never twice in one) doesn't obviously transfer
to "the core" as a single weapon-equivalent with 3 sockets. Chose "5
types competing for 3 slots" over "which type to stack" as the more
legible framing for a first cut — cheap to revisit if it reads wrong at
the gate.
