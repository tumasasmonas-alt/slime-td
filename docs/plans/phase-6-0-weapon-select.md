# Phase 6-0 — the pre-run weapon select

**Status:** ✅ **Shipped 2026-08-09.** All eight steps of §8 built and
verified live in-browser (§7's invariant tests + a full manual pass:
selection, the capacity refusal, both entry points, a non-default deck
actually equipping and rendering, Try Again preserving it, and the
existing 5C inventory screen confirmed unaffected). 393/393 tests,
typecheck clean, build clean. Not yet committed — the owner asked for a
report before anything is pushed.

**What this is.** A screen shown before a run starts, where the player
chooses which weapons to bring. A list, a selection, a start button.
**No currency, no unlocks, no persistence beyond the page session** —
Phase 7 layers those onto this screen rather than building a second one.

**Why it is first in Phase 6, and why it blocks everything after it.**
The deck defines the card pool from 5B onward, and the owner settled on
2026-08-09 that **the pool never offers a weapon** — so this screen is
the only mechanism in the game by which any weapon is ever equipped.
Without it, every weapon shipped in 6C through 6G is unplayable, and four
already-shipped ones (Blades, Frost, Missile, Immolation Ring) stay
unreachable. See `docs/BACKLOG.md` and `docs/plans/phase-6-roadmap.md`
finding 1.

**Source:** `docs/plans/phase-6-roadmap.md` (the batch this belongs to and
the four settled calls); `docs/plans/phase-5-6-arsenal.md` §5, §11, §12.4,
§13's 6-0 row; `docs/plans/phase-5c-inventory-ui.md` §6 (which scaffolded
`ui/weaponRow.ts`'s `'select'` mode for exactly this); Decisions 39, 40,
71, 72.

---

## Table of contents

1. [What the owner settled](#1-what-the-owner-settled)
2. [Scope — in and out](#2-scope--in-and-out)
3. [The screen](#3-the-screen)
4. [The card-pool change](#4-the-card-pool-change)
5. [State and data flow](#5-state-and-data-flow)
6. [Modules touched](#6-modules-touched)
7. [Tests](#7-tests)
8. [Order of work](#8-order-of-work)
9. [What this deliberately leaves for Phase 7](#9-what-this-deliberately-leaves-for-phase-7)
10. [Risks](#10-risks)

---

## 1. What the owner settled

Five calls, all 2026-08-09.

| # | Call |
|---|---|
| 1 | **A deck always fills every slot.** `state.weaponSlots` weapons exactly, no more and no fewer. Slot count is a Phase 7 currency purchase, never a per-run choice. |
| 2 | **The deck is immutable during a run.** No mid-run weapon changes, ever. |
| 3 | **The card pool never offers a weapon.** Extensions for decked weapons, support gems, core gems — that is the whole pool. |
| 4 | **Try Again keeps the last deck**, so the restart loop stays one click. |
| 5 | **A second button sits below it**, opening the loadout window, which carries its own start button. Same shape on the start screen: `Start Run` primary, `Choose Weapons` secondary. |

Call 1 **supersedes** one clause of the arsenal plan §5 — *"an unlocked
slot is optional to use, and that is a real decision… a 4-weapon deck
draws from a tighter, higher-quality pool than a 6-weapon deck."* That is
no longer true: the deck is always full, so deck *size* is not a lever
and pool tightness is not something the player tunes. The decision the
screen asks is **which** weapons, never **how many**.

Recorded as a supersession rather than folded in silently, per
`CLAUDE.md`'s ground-truth protocol. It is a clean one — §5's clause cost
nothing to give up because nothing else in the design depended on it, and
call 3 (no weapons in the pool) is what makes a partial deck incoherent:
a slot left empty could never be filled by anything.

---

## 2. Scope — in and out

**In:**

- A weapon-select overlay listing every weapon in `WEAPON_DEFS`.
- Selection of exactly `state.weaponSlots` weapons, enforced in the UI.
- A start button on that overlay.
- `Choose Weapons` on the start screen, beside `Start Run`.
- `Change Loadout` on the game-over screen, below `Try Again`.
- The chosen deck surviving across runs within the page session.
- `startRun()` equipping the chosen deck rather than a hardcoded kit.
- **Deleting the `newWeapon` card branch** and its slot-gating logic.

**Out, deliberately:**

- **Currency, costs, unlocks, locked weapons.** Phase 7 (Decision 39).
- **`localStorage`.** The owner asked for Try Again to remember the deck,
  not for it to survive a browser refresh. In-memory is what was asked
  for; the upgrade is a few lines whenever Phase 7 wants it.
- **Mid-run deck changes.** Explicitly ruled out (call 2).
- **Gem or extension pre-loading.** The screen picks weapons only.
  Sockets start empty and fill during the run, unchanged.
- **Enhancement-point pre-allocation.** Points bank from level-ups; the
  run still starts at zero.
- **Sorting, filtering, search.** Seven weapons now, eighteen by the end
  of Phase 6. A scrolling list handles both; §10 flags where that stops
  being true.

---

## 3. The screen

### Entry points

```
START SCREEN                          GAME-OVER SCREEN
┌────────────────────┐                ┌────────────────────┐
│  SLIME TD          │                │  Core Overwhelmed  │
│  <blurb>           │                │  <run stats>       │
│                    │                │                    │
│  [ Start Run ]     │  primary       │  [ Try Again ]     │  primary, keeps deck
│  [ Choose Weapons ]│  secondary     │  [ Change Loadout ]│  secondary
│  ⚡ 🔗 ☠️  <- deck  │                │  ⚡ 🔗 ☠️  <- deck  │
└────────────────────┘                └────────────────────┘
           │                                     │
           └──────────────┬──────────────────────┘
                          ▼
              ┌──────────────────────────┐
              │  Choose Your Loadout     │
              │  2 of 3 slots filled     │
              │  ┌────────────────────┐  │
              │  │ ☑ ⚡ Bolt Turret   │  │
              │  │   15 pwr · 0.55s   │  │
              │  │ ☑ 🔗 Chain Bolt    │  │
              │  │ ☐ 🗡️ Orbiting Blades│ │
              │  │ … one row per weapon│  │
              │  └────────────────────┘  │
              │  [ Start Run ]           │  disabled until exactly 3
              │  [ Back ]                │
              └──────────────────────────┘
```

**The deck line under the buttons is the important small detail.** Both
screens show the current deck as a row of weapon icons, so what you are
about to start with is legible without opening anything. That is what
makes `Try Again` safe as a one-click path — the player is never guessing
what they just re-rolled into.

### Selection rules

- **Exactly `state.weaponSlots` weapons** (3 today). `Start Run` on the
  select overlay is **disabled** until the count matches, with the
  `n of N slots filled` counter as the explanation. Disabled-and-labelled
  rather than silently ignoring the click, matching 5C's treatment of the
  `+`/`−` limits (Decision 72).
- **Checking a weapon when the deck is already full is refused**, and the
  refusal must be visible: unselected rows go disabled at capacity rather
  than accepting a click that does nothing. Same principle as above.
- **Never zero.** Falls out of the exact-count rule.

### Row content

`ui/weaponRow.ts`'s `'select'` mode exists but is scaffolding — currently
a bare checkbox with no bound state and no description. It needs:

| Element | Source |
|---|---|
| Checkbox, reflecting current selection | new `selected` input |
| Disabled state at capacity | new `disabled` input |
| Icon + name | `WeaponDef.icon` / `.name` — already rendered |
| Stat line at level 1 | `WeaponDef.stats(1)` — reuses 5C's addition |

**No new `WeaponDef` field.** `stats(1)` is what a player wants here —
what this weapon does when the run starts — and it already exists.
Reaching for a new `role` blurb would be authoring weapon copy, which is
6B/6C content work, not this batch's.

---

## 4. The card-pool change

**`systems/cards.ts` loses the `newWeapon` card kind entirely.** Per the
owner's call 3, weapons never appear in the pool. What goes:

- The `{ kind: 'newWeapon'; key: WeaponKey }` variant of `CardChoice`.
- Its block in `buildWeaponSidePool()`, **including the
  `equippedCount < state.weaponSlots` gate** — that gate exists only to
  decide whether to offer a weapon, so it goes with it.
- Its `applyCardChoice()` branch (`state.weapons[choice.key] = 1`).
- Its rendering branch in `ui/upgradeCards.ts`.

**After this, nothing in the game mutates the set of equipped weapons
after `startRun()`.** That is the property call 2 asks for, and deleting
the branch is what makes it structurally true rather than merely
currently true. Worth an invariant test (§7) precisely because it is the
kind of guarantee a future feature could quietly break.

**The pool gets smaller, and that is fine.** Today the `newWeapon` branch
is unreachable anyway (the deck is always full), so removing it changes
no live behaviour — it removes dead code and the possibility of it coming
back to life by accident. The pool's live content is unchanged:
extensions for decked weapons, the legacy `damage`/`atkSpeed` passives
(until 6A deletes them), and core gems on their own track.

---

## 5. State and data flow

**The chosen deck is not run state and must not live in `GameState`.**
`freshState()` is rebuilt wholesale on every `startRun()` (`main.ts`), so
anything stored there is destroyed exactly when the deck needs to
survive. It is *pre-run configuration*, which is a different lifetime.

**Where it lives:** a module-level `selectedDeck: WeaponKey[]` in the new
`ui/weaponSelect.ts`, with a getter and a setter. One owner, explicit
lifetime, and the natural place for Phase 7 to swap in a persisted read
without touching any caller.

```
  ui/weaponSelect.ts                     main.ts
  ┌─────────────────────────┐
  │ selectedDeck: WeaponKey[]│  ◀──── setDeck()  ◀── select overlay
  │   default: bolt/chain/   │
  │            poison        │
  └───────────┬─────────────┘
              │ getDeck()
              ▼
        startRun()  ───▶  state = freshState()
                          for (key of getDeck())
                            state.weapons[key] = 1
```

**The default stays Bolt / Chain / Poison** — arsenal plan §12.4's
settled starting kit, unchanged. A player who never opens the screen gets
exactly today's game, which is also what makes this batch safe to ship:
the default path is behaviour-identical.

**`startRun()` stops hardcoding.** Its current three assignments become a
loop over `getDeck()`. Each weapon still starts at 1 point invested — the
convention every `weapons/*.ts` file relies on for its "is this equipped"
check, and every damage formula's `lvl >= 1` floor (`cards.ts:122–128`
documents this).

**One guard worth building rather than assuming:** if `getDeck()` ever
returns a deck whose length disagrees with `state.weaponSlots` — a stale
deck after Phase 7 sells a fourth slot, say — `startRun()` should clamp
and top up from the default kit rather than starting a run with two
weapons. Cheap, and it turns a future Phase 7 sequencing bug into a
non-event.

---

## 6. Modules touched

| Module | Change |
|---|---|
| **`ui/weaponSelect.ts`** | **New.** The overlay: render the list, hold `selectedDeck`, enforce the exact-count rule, expose `getDeck()`/`setDeck()`. Thin DOM wrapper over `weaponRow`, matching how `ui/inventory.ts` is structured. |
| **`ui/weaponRow.ts`** | Fill in the `'select'` branch: bind `selected`, honour `disabled`, render `stats(1)`. `WeaponRowHandlers.onToggle` already exists. |
| **`ui/overlays.ts`** | Wire `Choose Weapons` and `Change Loadout`; render the deck-icon line on both screens. |
| **`index.html`** | The select overlay's markup and styles, following the existing `.overlay` / `.panel` / `.panel-wide` pattern; two new buttons; two deck-line containers. |
| **`main.ts`** | `startRun()` reads `getDeck()`; wire the two new buttons; the length-vs-slots guard. |
| **`systems/cards.ts`** | Delete the `newWeapon` kind, its pool block, its slot gate, its apply branch (§4). |
| **`ui/upgradeCards.ts`** | Delete the `newWeapon` render branch. |
| **`systems/cards.test.ts`** | Remove cases asserting `newWeapon` behaviour; add the two invariants (§7). |

No changes to `state.ts`, any system, any weapon, or any renderer. **This
batch touches no simulation code at all**, which is the main reason it is
cheap and the main reason it is safe to put first.

---

## 7. Tests

Written as invariants rather than mechanisms, per Decision 20 — these
have to survive the 18-weapon roster, the 6-slot maximum, and Phase 7's
unlocks.

| Test | Invariant |
|---|---|
| **No card ever grants a weapon** | Across `buildWeaponSidePool()`'s output, every `CardChoice['kind']` is one of `extension`/`coreGem`/`passive`/`heal` — never anything that mutates `state.weapons`' key set. The structural version of call 3. `systems/cards.test.ts`. |
| **`getDeck`/`setDeck` round-trip and don't alias** | Pure state layer, `ui/weaponSelect.test.ts`. |
| **`resolveDeck` falls back on a length mismatch** | The stale-deck guard (§5), and pins the default kit as the fallback value. `ui/weaponSelect.test.ts`. |

**What did not get a unit test, and why.** "Every weapon is selectable"
and "a run's deck is exactly the chosen deck" are properties of DOM
rendering and `main.ts`'s orchestration respectively — this project has
no jsdom environment configured (`vitest.config.ts` runs `node`), and
every existing `ui/*.ts` module (`inventory.ts`, `overlays.ts`,
`upgradeCards.ts`) is untested by design, verified live instead (5C's own
record does this explicitly). Adding jsdom for one screen would break
that convention for no shared benefit. Both properties **were** verified
live (§8, step 8) — every weapon row rendered, a genuinely non-default
deck equipped and ran, and `Try Again` preserved it across a real restart.

Existing `cards.test.ts` cases asserting `newWeapon` pool behaviour got
**deleted, not adapted** — the mechanism they cover is gone, and adapting
them would leave tests defending a shape the design has dropped.

---

## 8. Order of work

Each step leaves the game running and testable.

| # | Step | Done when |
|---|---|---|
| 1 | `ui/weaponSelect.ts` with `selectedDeck`, `getDeck()`, `setDeck()`, default kit. No UI yet. | Unit-testable; game unchanged. |
| 2 | `startRun()` reads `getDeck()`, plus the length guard. | Game behaviour identical — the default kit is the old hardcode. |
| 3 | Delete the `newWeapon` branch across `cards.ts` / `upgradeCards.ts`; prune its tests. | Suite green; pool composition unchanged in practice. |
| 4 | Fill in `weaponRow`'s `'select'` mode. | Renders a bound, disable-able row with a stat line. |
| 5 | The overlay: markup, styles, list, counter, exact-count enforcement, Start / Back. | Openable, selectable, startable. |
| 6 | Start-screen and game-over-screen buttons; the deck-icon line on both. | Both entry points work; `Try Again` keeps the deck. |
| 7 | Write the §7 invariants. | Green. |
| 8 | **Verify live in the browser** — every entry point, the capacity refusal, the disabled Start, a run actually starting with a non-default deck, and a level-up draw containing no weapon card. | Zero console errors; typecheck and build clean. |

**Step 8 is not optional.** Every phase since 4A has found real bugs only
by running the game, and 5C found a live bug in 5B's plumbing the moment
a button became its first caller — this batch adds four new buttons.

### What changed during implementation

Built as planned, with one small signature widening: `renderWeaponRow`'s
`state` parameter became `GameState | undefined` (throwing at runtime if
called in `'loadout'` mode without one) rather than adding a second
rendering function — `'select'` mode never touched `state` in the first
place, so the plan's own §5 point about the deck living outside
`GameState` extends naturally to the row renderer that draws it.

**Live verification (step 8) hit the project's own documented Vite
self-reload quirk mid-test** (BACKLOG: *"occasionally does an unprompted
full-page reload... never correlated with anything in the game code"*) —
a duplicate `[vite] connecting/connected` pair appeared and briefly made
the deck line look wrong (reset to the default kit after a genuinely
different deck had been confirmed working). Re-running the same sequence
without the reload landing mid-sequence showed the true behaviour:
weapon tray, start-screen deck line and game-over deck line all agreed
with the actual selection (`🔗☠️🔥` for a Chain/Poison/Immolation pick),
in-game visuals matched (Immolation Ring's periodic ring, no orbiting
blade when Blades wasn't decked), and `Try Again` preserved the deck
into a fresh run. No code fix needed — this is the same artifact already
on record, not a regression from this batch.

**Confirmed live, beyond the artifact above:** the capacity refusal (a
disabled checkbox does not register a click — verified by attempting to
over-select a 4th weapon and observing no state change); `Change
Loadout` opening pre-checked with the run's actual deck; `Back` returning
to the game-over screen rather than the start screen; the level-up card
pool offering only extensions for the three decked weapons plus a core
gem, with no `newWeapon`-shaped card anywhere in the draw; and the
existing 5C inventory screen (`'loadout'` mode of the same
`renderWeaponRow`) rendering correctly with zero regressions.

---

## 9. What this deliberately leaves for Phase 7

Stated so the screen is recognisably a foundation rather than a stub:

- **Currency and weapon unlocks.** Rows gain a cost and a locked state;
  the list itself does not change shape.
- **Buying slots.** The exact-count rule already reads
  `state.weaponSlots`, so a fourth slot works with no change here.
- **Persistence across sessions.** One `localStorage` read and write
  behind `getDeck()`/`setDeck()`, which exist as a pair for this reason.
- **Gem bundles and the deck builder proper** (arsenal plan §10).

---

## 10. Risks

**1. Eighteen weapons will not fit this list comfortably.** Seven rows
fit; eighteen scroll, and scrolling a choice you make every run is worse
than it sounds. The screen ships simple now on purpose — but by 6E the
list is past a dozen, and that is the point to revisit grouping by role
or a two-column layout. Named here so it is a scheduled reconsideration
rather than a surprise.

**2. Choosing three of eighteen with no information is a bad choice.**
Rows show name and level-1 stats, which says what a weapon *does* but not
what it *answers* — and the coverage matrix (§8 of the arsenal plan) is
the actual decision the player is making. The honest fix is role copy per
weapon, which is 6B/6C content work. Flagged, not solved here.

**3. Deleting `newWeapon` removes the only mid-run source of variety the
card pool had.** After this, a run's weapon set is fixed at second zero
and every card is an extension or a gem. That is exactly what the owner
asked for and it makes the deck decision matter more — but it does put
more weight on extensions and gems being interesting, which is 6A and 6B.
If runs start feeling samey before those land, this is the cause and it
is expected rather than a regression.

**4. In-memory persistence loses the deck on a dev-server reload**, and
the Vite dev server is documented as occasionally self-reloading
(BACKLOG). Mildly annoying during a long playtest. `localStorage` is the
fix and it is a few lines whenever it becomes irritating.

---

*Planned 2026-08-09. Awaiting greenlight. All five design calls settled
by the owner the same session; §1's supersession of arsenal plan §5's
optional-slot clause is the only decision-record change this batch
carries.*
