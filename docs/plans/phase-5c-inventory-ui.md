# Phase 5C — the pause + inventory screen

**Status:** 📋 Proposed, awaiting the project owner's review. Nothing here
is built.

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

**Recommendation: move the gate, not the build order.** Build 5C → 6-0 →
6A as planned, then run one combined gate once gems exist. Nothing about
5C changes; only the point at which we stop and judge moves later. §9 Q1.

**What 5C's own smaller gate can still usefully check:** does the screen
get opened at all, does the +/- feel good, is the points-to-power
relationship legible, does anything break. Those are real and worth
checking as soon as it ships.

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

This means 5C needs a small per-weapon "describe current stats" function.
`WeaponDef.desc(lvl)` already exists and is close, but it is written for
card copy ("Fires at the nearest wall of infection. Lv3: 30 pwr"). §9 Q3
asks whether to reuse it or add a terser stat-only variant.

---

## 5. Opening and closing it

**Needs a decision — §9 Q2.** The options differ in more than convenience:
this game has no other keyboard input at all today, so a key binding
introduces a whole input concept, while a button is consistent with every
existing overlay.

Whatever opens it, **it pauses** (settled 2026-08-08 for the level-up
overlay; same reasoning applies — and in a no-aim game a pause interrupts
nothing the player was doing).

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
| **5C-1** | The overlay's HTML/CSS in `index.html`; `ui/inventory.ts` with open/close/pause wiring. Shared weapon-row renderer (§6). | Opens, pauses, closes, restores `paused` correctly |
| **5C-2** | `+` / `−` wired to `enhancementPool` and `withdrawPoints()`; buttons disable at their real limits (no points left; clamp reached). | Pure spend/withdraw logic unit-tested in `systems/` — the UI stays a thin wrapper, as 5B did with `systems/cards.ts` |
| **5C-3** | Live stat lines per weapon (§4); socket row rendering from `socketCount()`; core-gem row. | Stat text changes when points change; socket count matches the ladder |
| **5C-4** | Reachable from the level-up card screen (§5). | — |
| **▶ small gate** | Does it open, does +/- feel legible, does anything break? **Not** the "decision or slider" gate — that waits for 6A (§1). | |

---

## 9. Open questions

1. **Does the Phase 5 gate move to after 6A?** (§1) Recommend **yes** —
   the "decision or slider" question is unanswerable with empty sockets,
   and a false negative there is worse than no data. Build order is
   unchanged either way.
2. **How is the inventory opened?** A HUD button is consistent with every
   existing overlay and needs no new input concept; a key (Tab / I) is
   faster and more standard for the genre but this game currently has
   **zero** keyboard input, so it is a new concept to introduce and
   discover. Recommend a **button, plus a key as a shortcut** once the
   button has taught it exists.
3. **Stat line: reuse `WeaponDef.desc(lvl)` or add a terser stat-only
   variant?** `desc` is card copy — a full sentence plus one number.
   Recommend a **separate short `stats(lvl)`** on `WeaponDef`, since a
   weapon row wants "45 pwr · 0.42s" not a sentence, and the card pool
   still wants the sentence.
4. **Should `−` be allowed to take a weapon to 0 points and unequip it?**
   Or does a weapon stay equipped at 0, occupying a deck slot? Recommend
   **stays equipped at 0** — unequipping via a stat control is a
   surprising side effect, and freeing a deck slot mid-run is a Phase 7
   deck-management concern, not a 5C one.
