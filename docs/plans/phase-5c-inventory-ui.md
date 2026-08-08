# Phase 5C — the pause + inventory screen

**Status:** 📋 **Scope settled 2026-08-08, not yet built.** The four open
questions in §9 were answered the same session and are folded in below.
Ready to implement on greenlight.

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
| **5C-1** | `WeaponDef.stats(lvl)` across all seven weapons (§4) — pure data, no UI, so the rest of the phase has something to render. | Every weapon def has a non-empty `stats()`; it changes with level |
| **5C-2** | The overlay's HTML/CSS in `index.html`; `ui/inventory.ts` with the HUD button, open/close and pause wiring. Shared weapon-row renderer (§6). | Opens, pauses, closes, restores `paused` correctly |
| **5C-3** | `+` / `−` wired to `enhancementPool` and `withdrawPoints()`; buttons disable at their real limits (no points banked; clamp reached; a weapon at 0 stays equipped). | Pure spend/withdraw logic unit-tested in `systems/` — the UI stays a thin wrapper, as 5B did with `systems/cards.ts` |
| **5C-4** | Live stat lines per weapon; socket row rendering from `socketCount()`; core-gem row. | Stat text changes when points change; socket count matches the ladder |
| **5C-5** | Reachable from the level-up card screen (§5). | — |
| **▶ small check** | Does it open, does +/- feel legible, does anything break? **Not** the Phase 5 gate — that is now one combined gate after 6A (§1). | |

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
  self-explanatory; that is a guess until someone plays it.
- **Everything about specialise-vs-spread**, which needs 6A's gems (§1).
