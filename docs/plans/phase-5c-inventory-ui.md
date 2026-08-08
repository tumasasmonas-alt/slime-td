# Phase 5C — the pause + inventory screen

**Status:** ✅ **Implemented and verified 2026-08-08 — Decision 72.**
All five steps shipped. 389/389 tests, typecheck clean, build clean,
verified live via direct DOM interaction in the browser — every
open/close path, both entry points, `+`/`−` including the extension
clamp, and core-gem socketing.

**Depends on:** 5B (Decision 71) — `enhancementPool`, `socketCount()`,
`withdrawPoints()`, `weaponSockets`, `coreGems` all exist and are tested,
with no UI able to reach any of them.
**Source design:** `docs/plans/phase-5-6-arsenal.md` §5, §6, §13's 5C row;
`docs/plans/phase-5b-framework.md` §3.

---

## 1. The gate problem — raise this before anything is built

The Phase 5 gate, as written in the arsenal plan §13, asks:

> Does the inventory screen get opened more than once? **Is enhancement a
> decision or a slider?** And how bad is dilution really?

**The middle question is guaranteed to answer "slider," and it would be a
false negative.**

Decision 40 recorded the slider risk honestly — *"with free reassignment
and no diminishing returns, the optimal play is always dump everything
into whichever weapon has the most gems socketed."* The arsenal plan's
answer, §5, is that **socket thresholds are the counterweight**:
specialising buys combinatorial depth, spreading buys breadth.

**But sockets are empty until 6A.** With no gems in existence, opening a
weapon's 4th socket buys *nothing*. So specialising has no benefit beyond
raw power, spreading has no cost, and enhancement is a pure slider — not
because the design fails, but because the only mechanism that makes it a
decision has nothing to hold yet.

Running the gate now would produce a result we already know is
meaningless, and worse, one that could be mistaken for a real finding
about the design.

**Settled 2026-08-08: the gate moves, the build order does not.** Build
5C → 6-0 → 6A as planned, then run **one combined gate** once gems exist,
judging socketing, specialise-vs-spread and pool dilution together.
Nothing about 5C's own content changes.

**5C still gets a small immediate check** as soon as it ships: does the
screen get opened at all, does the +/- feel good, is the points-to-power
relationship legible, does anything break. Those are real and answerable
now. What waits for 6A is only the question that needs gems to mean
anything.

---

## 2. What 5C can actually deliver — the 5B tension, again

Same shape as `phase-5b-framework.md` §1. Being explicit up front so a
thin-feeling screen reads as expected rather than broken:

| Element | State in 5C |
|---|---|
| **+/- enhancement spending** | ✅ Fully real — changes weapon damage and cooldowns immediately |
| **Socket count per weapon** | ✅ Real and visible — derived from points via `socketCount()` |
| **Extensions occupying sockets** | ✅ Real — the placeholder extension is card-granted and sits in a socket |
| **Core gems (3 slots)** | ✅ Real — five ported passives, card-granted |
| **Withdrawal clamping on extensions** | ✅ Real and reachable — the first live caller of `withdrawPoints()` |
| **Gem socketing / unsocketing** | ⬜ **Empty** — no gem kinds exist until 6A. `gemInventory` is always `[]` |
| **Gems evicting to inventory on socket close** | ⬜ Unreachable — needs gems to evict |
| **Per-weapon gem descriptions** | ⬜ Nothing to describe until 6A |

**So the gem half of the screen ships as a visible, labelled affordance
with nothing in it** — empty socket outlines that read as "a gem goes
here," not as a broken or missing feature. Same posture 5B took with the
socket mechanism itself, and for the same reason: the alternative is
retrofitting the screen's whole layout in 6A.

---

## 3. The screen

A DOM overlay, consistent with Decision 5 (HUD and overlays are DOM/CSS
over the canvas, not canvas-drawn) and with how the level-up card panel
and start/game-over overlays already work.

```
┌──────────────────────────────────────────────┐
│  LOADOUT                    12 points unspent│
│                                              │
│  ⚡ Bolt Turret                    4 pts  − + │
│     45 pwr · 0.42s cooldown                  │
│     ◆ Prototype Mount Lv2   ○   ○            │
│                                              │
│  🔗 Chain Bolt                     1 pt   − + │
│     16 pwr · 3 forks                         │
│     ○                                        │
│                                              │
│  ☠️ Caustic Cloud                  0 pts  − + │
│     9 pwr/s · 3.4s                           │
│     ○                                        │
│                                              │
│  ── CORE ──                                  │
│  ❤️ Vitality   💧 Regeneration   ○            │
│                                              │
│                          [ Resume ]          │
└──────────────────────────────────────────────┘
```

- **Points unspent** — the same number the HUD's `PTS n` shows, now
  spendable.
- **Per weapon:** icon, name, points invested, `−`/`+`.
- **A live stat line** under each weapon — see §4, this is the important
  part.
- **A socket row:** `◆` filled (extension or gem), `○` empty. Count comes
  from `socketCount(points)`, so it visibly grows as points go in — which
  is how the player learns the ladder exists at all without a tutorial.
- **Core row:** the three core sockets and what's in them.

**`−` calls `withdrawPoints()`**, which already handles the extension
clamp — so a weapon holding two extensions simply stops going down at 3
points rather than destroying one, and the UI should show that as the
button disabling, not as a silent no-op.

**A weapon at 0 points stays equipped** (settled 2026-08-08). It still
fires, just weakly. A stat control that silently unequips would be a
surprising side effect, and freeing a deck slot mid-run is really deck
management — a Phase 7 concern, not something to hide behind a minus
button.

---

## 4. The stat line is not optional

Decision 8 shipped the HUD modifier readout early *"so a pick's effect is
confirmable the instant it's made rather than only inferable from play."*
Decision 65 sharpened it: a mechanic's state must be legible **in the
state the mechanic actually produces**. The 2026-08-05 playtest's *"cards
appear to do nothing"* finding was fundamentally this problem.

**A `+` that changes a number the player cannot see is exactly that bug
again.** Every weapon row shows its live derived stats — power, cooldown,
count where it applies — recomputed as points move. That is what makes
the +/- a decision rather than a slider you spin blind.

**Settled 2026-08-08: `WeaponDef` gains a terser `stats(lvl)`** alongside
the existing `desc(lvl)`. Different jobs, different strings — a weapon row
wants `45 pwr · 0.42s`, a card wants *"Fires at the nearest wall of
infection. Lv3: 30 pwr"*. Reusing `desc` would put full sentences in a
dense multi-weapon list and repeat flavour text the player already read on
the card that granted the weapon.

Costs one new field across all seven weapon defs, and Phase 6-0's rows get
the same readout for free.

---

## 5. Opening and closing it

**Settled 2026-08-08: a HUD button now, a key shortcut later.**

The button is consistent with every existing overlay — start, game-over
and level-up are all click-driven — and needs no discovery mechanism.
This game has **zero** keyboard input today and no controls hint anywhere,
so a key-only binding would be undiscoverable, which for a screen whose
entire purpose is to be opened repeatedly would be fatal. The key comes
after, as a power-user shortcut, once the button has taught players the
screen exists.

**It pauses** (settled 2026-08-08 for the level-up overlay; same reasoning
applies — and in a no-aim game a pause interrupts nothing the player was
doing).

**It should also be reachable from the level-up card screen**, since
"just got a point" is exactly when a player wants to spend one. Cheap to
add, and it turns the level-up beat into a natural rhythm rather than two
disconnected screens.

---

## 6. Build it for reuse — Phase 6-0 depends on this

Phase 6-0's pre-run weapon select renders the same things: a list of
weapons, each with an icon, a name, and per-weapon state. Building the two
independently means building the same list twice.

**Extract a shared weapon-row renderer** parameterised by mode:

| Mode | Used by | Right-hand control | Shows sockets |
|---|---|---|---|
| `'loadout'` | 5C inventory | `−` / `+` points | ✅ |
| `'select'` | 6-0 pre-run | checkbox / slot toggle | ⬜ (nothing invested pre-run) |

One module, two callers. This is the concrete form of "5C should build
components 6-0 can reuse," settled 2026-08-08.

---

## 7. What 5C does not touch

- **No gem picker UI.** Nothing to pick until 6A. Empty sockets render as
  affordances; clicking one does nothing (or shows "no gems yet").
- **No pre-run weapon select.** Phase 6-0, right after this.
- **No new game mechanics at all.** Every system 5C drives already exists
  and is tested; this phase is purely the interface to them.
- **No weapon-slot purchasing.** Phase 7.
- **No changes to the card pool.** 5B settled it.

---

## 8. Order of work

| Step | Work | Test |
|---|---|---|
| **5C-1** | ✅ `WeaponDef.stats(lvl)` across all seven weapons (§4). | ✅ Every weapon def has a non-empty `stats()` |
| **5C-2** | ✅ The overlay's HTML/CSS in `index.html`; `ui/inventory.ts` with the HUD button, open/close and pause wiring. Shared `ui/weaponRow.ts` (§6), `'select'` mode scaffolded for 6-0. | ✅ Live-verified: opens, pauses, closes, restores `paused` correctly |
| **5C-3** | ✅ `+`/`−` wired to `systems/sockets.ts`'s `investPoints()`/`withdrawPoints()`. **`withdrawPoints()` gained a real behaviour change here**: withdrawn points now return to `enhancementPool` — 5B built it as inert plumbing with no caller to notice the gap. Buttons disable at real limits (`minPointsForSockets()`, new exported helper; empty pool). | ✅ `systems/sockets.test.ts` — conservation round-trip, the extension-clamp disable condition, pool-empty disable |
| **5C-4** | ✅ Live stat lines, socket dots from `socketCount()`, core-gem row from `state.coreGems`. | ✅ Live-verified: stat text and socket dot count both update immediately on `+`/`−` |
| **5C-5** | ✅ "Manage Loadout" button inside the level-up panel; `main.ts` tracks which entry point opened the screen so closing returns to the right place (resume, or re-show pending cards). | ✅ Live-verified full round trip: cards → Manage Loadout → inventory → Resume → cards reappear, `pendingLevelUps` untouched |
| **▶ small check** | ✅ Opens and closes cleanly from both entry points; `+`/`−` read legibly; extension clamp visibly disables rather than silently no-op'ing. **Not** the Phase 5 gate — that is one combined gate after 6A (§1). | |

---

## 9. Settled 2026-08-08

| # | Question | Call | Where |
|---|---|---|---|
| 1 | Phase 5 gate timing | **Moves to after 6A** — one combined gate, build order unchanged | §1 |
| 2 | How the screen opens | **HUD button now, key shortcut later** | §5 |
| 3 | Stat line source | **New terser `stats(lvl)`** on `WeaponDef`, alongside `desc(lvl)` | §4 |
| 4 | `−` down to 0 points | **Weapon stays equipped**, fires weakly | §3 |

All four went to the recommendation. **Nothing is blocking.**

### Still genuinely open, deliberately

- **Whether the +/- actually feels good** — the one thing 5C's own small
  check can answer, and it can't be argued in advance.
- **Whether the socket row teaches the ladder** without a tutorial. The
  intent is that watching `○` appear as points go in is
  self-explanatory; confirmed live that the dots do grow correctly as
  points go in — whether it *reads* as teaching itself is still a guess
  until someone plays it cold.
- **Everything about specialise-vs-spread**, which needs 6A's gems (§1).

### One thing 5B left inert that 5C exposed

`withdrawPoints()` shipped in 5B as pure plumbing with no caller — and it
had a real gap: withdrawn points were removed from the weapon but never
credited back to `enhancementPool`. Harmless while nothing called it, but
a genuine bug the moment something did. Fixed here, alongside a new
`investPoints()` (the mirror on the spend side) and an exported
`minPointsForSockets()` so the `−` button can disable itself exactly at
the clamp rather than showing live and silently no-op'ing. Both are
tested for round-trip conservation: investing then withdrawing the same
amount changes nothing about the pool-plus-weapon total.

### A minor tuning observation, not a bug

A weapon at 0 points now computes strictly below its old "level 1"
baseline — e.g. Bolt at 0 points is 8 pwr / 0.60s cooldown, versus 15 pwr
/ 0.55s at 1 point, because every weapon formula was written assuming
`lvl >= 1` and 5B's model lets `lvl` (now "points invested") reach 0.
Consistent with "stays equipped, fires weakly" as settled — just noting
it produces a genuinely sub-baseline weapon, not a floor at the old
level-1 number, in case that reads as surprising in play.
