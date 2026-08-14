# Slime TD — Post-Mortem

**Status: sunset.** Development stopped 2026-08-14. The game is playable,
builds clean, and 902 tests pass. It is not being continued.

This document exists so the ten days spent here pay forward into the next
project instead of being re-learned. It has three jobs:

1. Say honestly what the game was and why it was stopped.
2. Separate what worked from what didn't, at the level of *design ideas*
   rather than code.
3. Name the process lessons that are worth carrying regardless of what
   the next game is.

Its companion is **`docs/SOCKET-ARSENAL.md`** — the one system from this
project judged good enough to transplant, written up as a portable design
rather than as a description of this codebase.

---

## 1. What was built

| | |
|---|---|
| **Span** | 2026-08-04 → 2026-08-14 (10 days), 65 commits |
| **Source** | 145 TypeScript modules, ~12,300 lines |
| **Tests** | 902 passing across 55 files, ~13,500 lines — *more test code than source* |
| **Docs** | ~21,600 lines across `DECISIONS.md`, `PROGRESS.md`, `BACKLOG.md`, 12 session records, 22 plan documents |
| **Decisions** | 96 recorded, load-bearing |
| **Stack** | Vite + TypeScript + Canvas 2D, no framework |

**The game.** A stationary core at the center of a fixed 1920×1080 arena.
Infection spreads inward as a continuous procedural density field — not
discrete enemies — with a reaction-diffusion vein pattern underneath it.
The player cannot move and cannot aim. Auto-firing weapons level up
Vampire-Survivors-style and carve the field back. Survival time is the
score.

**Systems that reached "done and playtested":**

- **The density field as the enemy.** Growth, reveal thresholds, a
  two-axis visual system (density → alpha, maturity → colour), scar
  accumulation that hardens ground the player has already fought over.
- **Infection Events** (veins, blooms) as the sole pacing lever, replacing
  a discrete tier table.
- **Coagulants** — seven kinds, formed by bounded flood-fill out of the
  field's own mass, obeying conservation. The field is the horde's
  economy; a behemoth is an honest readout of how badly you're losing,
  never a scripted spawn.
- **The arsenal**: ten weapons on one four-stage pipeline
  (READY → ACQUIRE → DELIVER → RESOLVE), 40 per-weapon extensions,
  36 support gems in four classes, 12 core gems, two independent socket
  lines per weapon, an enhancement-point economy, and a pause/inventory
  screen to spend it in.

**Systems that were designed but never built:** Transformative gems (14),
eight of the eighteen catalogued weapons, the meta layer (currency,
unlocks, persistent deck builder), the terminal phase, the leaderboard,
audio, and the entire Phase 9 game-feel pass. Nothing here failed — the
project stopped above them.

---

## 2. Why it was stopped

The owner's own verdict:

> "It's fun to play but only for a while, as there is no input the player
> has. So it's fun, but it's not engaging — people stop caring after a few
> seconds."

That is correct, and the reason is structural, not a tuning problem. It
was written down explicitly on **day two** and its consequences were
accepted rather than solved:

> **The player cannot aim.** This is an autoshooter… Three decision
> surfaces exist, total — the pre-run deck, in-run card picks, and gem
> socketing. Nothing tactical, nothing positional.
> — `docs/sessions/2026-08-05-slime-and-arsenal-rework.md` §4

Everything after that was a rational response to a premise that was
itself the problem. The design's answer to emptiness was **"add
questions"** — one slime behaviour = one question = one viable build.
That reasoning is sound *within* the premise, and the project executed it
well: by the end there were genuinely many questions on the field. It
still didn't produce engagement, for three reasons that only become
visible in play:

**a) The decision surfaces are too far apart in time.** A level-up card
pick is a real decision. Between two of them there is 30–90 seconds
during which the player's only available action is *watching*. A
build-craft game where you cannot express the build with your hands is a
spreadsheet with a screensaver attached.

**b) Feedback for a good decision is invisible.** The player sockets
Giant-Slayer and then… the field looks the same, just slightly less of
it. In a game with discrete enemies, a build change is legible as
"things now die in one hit instead of three." Against a continuous
density field, every change reads as a small shift in an already-noisy
gradient. **The field-as-enemy idea and the build-craft idea were
actively fighting each other**, and the field won on presentation while
the build lost on legibility.

**c) "Pressure that tests the build" is not the same as "pressure."** A
question the build answers automatically is not experienced as a
question. Because there is no aiming, no movement, and no ability timing,
the answer resolves without the player's participation. The build passes
or fails its test off-screen.

**The honest summary:** the project was building a *deep* game on a
premise that structurally capped how *engaging* it could be, and no
amount of additional depth was going to lift the cap. Stopping is the
right call, and stopping now — with the arsenal system fully proven and
the field system fully proven — is a better outcome than stopping later
with more of both.

---

## 3. What worked, and is worth keeping

### 3.1 The socket arsenal — the project's best output

This is the one thing being transplanted wholesale. Full write-up:
**`docs/SOCKET-ARSENAL.md`**. Summary of *why* it worked:

- **One pipeline, four named stages** meant each gem class attaches to a
  stage rather than to a weapon. Adding a sixth weapon archetype
  (`'beam'`, Phase 6C-2) cost about six touch points in the gem tables
  instead of an N×M rewrite. That is the whole payoff of the abstraction
  and it was measured, not assumed.
- **Archetype-based gem legality**, not per-weapon whitelists. A gem
  declares what kinds of delivery it supports; weapons declare their
  kind. New content on either axis is one row, not a matrix update.
- **Two independent socket lines** (extensions vs. support gems) so
  identity-defining upgrades never compete with generic ones for space.
- **No destructive respec, ever.** Everything unsockets back to
  inventory. This single rule removed an entire category of player
  anxiety and cost nothing.
- **The reinterpretation directive.** The owner's call — *"don't just not
  give the player gems"* — forced every gem to have a real, distinct
  reading on every archetype instead of being refused. Pierce means
  "passes through" on a projectile and "no per-blade hit cooldown" on an
  orbital. This is where most of the system's character came from, and it
  would never have emerged from a refusal table.

### 3.2 Mass conservation as a design constraint

Coagulants are made *out of* the field, not spawned next to it. The
crater left behind is real. This made the enemy legible as an economy and
killed a whole class of scripted-difficulty temptations before they could
be proposed. **Any future project with an "enemy resource" should steal
this rule.** It costs one invariant and it pays for itself in design
arguments you never have to have.

### 3.3 The documentation discipline

21,600 lines of docs against 12,300 lines of source is not obviously
correct, and on a solo two-machine project it was. The specific practices
that earned their keep:

- **A decision register with reasoning, not just outcomes.** Repeatedly
  prevented re-litigating settled questions and, more importantly,
  prevented "fixing" deliberate oddities. Several entries exist purely
  because the obvious fix reintroduces a real bug.
- **"Ideas considered and rejected" sections.** Cheapest possible
  insurance against re-proposing something already found broken.
- **Recording as-built deltas** — where the implementation deviated from
  the plan and why. Every batch had at least one. That gap is where the
  real learning lives.
- **The ground-truth override protocol** — raise it with the owner and
  wait, don't unilaterally mark a documented decision superseded.

**What to trim next time:** `PROGRESS.md` grew to 2,900 lines because
each session's entry preserved full narrative. The *current state* header
was updated faithfully, but the session log became an unread archive. A
hard cap — say, the last five sessions inline and everything older moved
to `docs/sessions/` — would have kept the same value at a third of the
size.

### 3.4 Testing invariants rather than mechanisms

Recorded as Decision 20 and honoured throughout: prefer *"an undefended
core dies"* over *"damage is sampled at radius X."* Outcome tests
survived multiple redesigns of the thing underneath them. The mechanism
tests that did get written are exactly the ones that had to be rewritten
when the mechanism changed.

---

## 4. What didn't work

### 4.1 The premise (see §2)

The single largest lesson. Stated as a rule for next time:

> **Establish where the player's hands are before designing what their
> head does.** Build-craft depth is a multiplier on moment-to-moment
> agency. If the agency is zero, the product is zero no matter how large
> the multiplier gets.

### 4.2 A continuous field is a bad canvas for build legibility

Beautiful, novel, technically satisfying, and it swallowed every piece of
player feedback. Discrete enemies are "boring" precisely because they are
*countable* — and countability is what makes a build change visible. If a
future project uses a field, it should be **terrain**, not the enemy.

### 4.3 Balance was deferred until it became unmeasurable

Deferring the balance pass to "Phase 8" was defensible each individual
time it was decided. The cumulative effect was that player power scaled
17–21× across a run while the threat scaled 3.1×, and this was known from
the 2026-08-05 playtest and carried for nine more days. By the time it
was addressed (Phase 6D-0), the fix had to reshape four separate curves
at once, and the very next playtest showed it had overshot on two of
them.

**The lesson is not "balance earlier."** It's: *keep the shape of the
curves comparable at all times, even when the numbers are wrong.* A
threat curve that flattens while player power doesn't is a **structural**
defect that a numeric pass can never fix, and it was visible in the
tuning constants from very early on. Structural balance and numeric
balance are different work, and only the numeric half is safe to defer.

### 4.4 Shipping in batches without playtesting between them

Phases 6D-0, 6D-1 and 6D-2 shipped back-to-back on typecheck + tests
alone. The result was predictable and duly arrived: the first playtest
found that the 6D-0 reach fix had overshot badly, and everything built on
top of it (two whole gem classes) had been tuned against an unverified
foundation. Three of those four batches had a documented "playtest before
the next one" gate, which was overridden.

The counter-example in the same project is instructive: **every phase
since 4A found real bugs only by running the game**, never by the test
suite. 902 tests could not tell anyone that Immolation "clears almost the
entire screen."

### 4.5 Test suites do not catch integration gaps

The sharpest bug of the project (Decision 91): nine new gem fields
reached each weapon's spawned entity correctly, and were then silently
dropped at impact time by three consumers with hardcoded field lists.
`tsc` was clean. All 823 tests passed. Six of ten weapons would have
shipped every Conditional gem completely inert.

It was caught only because the batch's own plan called for a test written
as an actual *spawn-to-impact* test rather than checking either boundary
alone. **The rule worth carrying: a value reaching a producer is not
evidence it reaches the consumer.** Structural typing will not tell you
about a property nobody reads back out.

### 4.6 "Odd" numbers hiding structural defects

Phase 6D began as "add 19 gems" and turned into a balance-and-honesty
pass, because reading the tuning constants against the shipped code found
four defects the design docs did not show — including **Orbiting Blades
having an identical radius at levels 1, 8 and 12**, and six of twenty
shipped gems being dead or actively worse on most of the roster. All of
it had been live for days, under a green test suite.

Worth an occasional deliberate audit pass: *read the constants against
the code and ask what each one actually does at level 1, level 8 and
level 20.*

---

## 5. Process lessons, condensed

Nine things that were true in this project and are probably true in the
next one:

1. **The premise is load-bearing.** Write down the input model on day one
   and stress-test *it* before designing anything on top.
2. **Playtest gates are gates.** Overriding one always costs more than
   the time it saved.
3. **The test suite finds mechanism bugs; only playing finds design
   bugs.** Both are needed; neither substitutes.
4. **Test the invariant, not the mechanism**, wherever the invariant can
   be stated as an outcome.
5. **Check producer *and* consumer.** Every plumbing change needs at
   least one end-to-end test crossing the boundary.
6. **Structural balance is not deferrable**; numeric balance is.
7. **Record the reasoning, not the changelog.** Git has the changelog.
8. **Record what was rejected and why.** It is the cheapest documentation
   there is and the most re-read.
9. **A shape problem cannot be fixed by cutting magnitude.** The Radar
   Sweep redesign (Decision 95) is the crisp example: no reduction to a
   full-circle pulse's radius, power or frequency stops it from hitting
   everything at once. Only changing it to a wedge did. Reach for the
   shape when three magnitude cuts in a row haven't helped.

---

## 6. Known state at sunset

The repository is left green and honest, not tidied to look finished.

- **902 tests pass, `tsc --noEmit` clean, `npm run build` clean.**
- **Two known open bugs**, both recorded in `docs/BACKLOG.md` and
  deliberately left unfixed:
  - 🔴 Immolation/Shockwave pulses grant XP for clearing *unrevealed*
    density — `grid/clear.ts`'s `applyCellDamage` reads `grid.growth[i]`
    without an `isRevealedIdx` check. This is the exact sharp edge
    `CLAUDE.md` names and that `contact.ts` was already fixed for;
    `clearAt`'s grid path never got the same fix.
  - 🔴 Multishot/Formation divide damage unconditionally — a precise
    **zero** on Blades and a downgrade on Frost. This is Phase 6D-3
    Step 4, planned in full in `docs/plans/phase-6d3-gem-reality.md` §5
    and never built.
- **Phase 6D-3 Steps 4–5 are the only unfinished planned work.** Anyone
  resuming would start there.
- The `.nvmrc` (22.12.0) and installed Node (24.19.0) still disagree.
  Harmless; `package.json` engines permits both.

---

## 7. Where the reasoning lives

If this project is ever revisited or mined for parts, read in this order:

1. **`docs/SOCKET-ARSENAL.md`** — the transferable system. Start here if
   the goal is to reuse rather than to understand.
2. **`docs/sessions/2026-08-05-slime-and-arsenal-rework.md`** — what the
   game is. §4 is the no-aim premise; §16 is ideas considered and
   rejected.
3. **`docs/sessions/2026-08-06-arsenal-and-coagulant-mechanism.md`** —
   how the field and coagulants work in code.
4. **`docs/plans/phase-5-6-arsenal.md`** — the full 18-weapon, 65-gem
   catalogue design. Most of it was never built and remains a usable
   content bank.
5. **`docs/DECISIONS.md`** — 96 decisions with reasoning. §"The design
   rework" (#23–46) is the game; #47 onward are implementation findings.
6. **`docs/BACKLOG.md`** — everything discovered and not fixed.

`archive/` holds the original prototype and is non-authoritative.
