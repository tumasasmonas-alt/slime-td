# Session record — 2026-08-07
## Phase 3D: the XP economy, and a premise correction

**Type:** implementation session, with a short design pass at the front.
**Participants:** project owner + Claude.
**Outcome:** Phase 3D shipped — the last step of Phase 3. Playtested and
confirmed better by the owner.

> **Why this file exists.** Most of this session was small, well-specified
> implementation that `PROGRESS.md` could have carried alone. Three things
> earned a record: the owner correcting a framing error in how Claude was
> reasoning about the game, a design problem (mass level-ups) whose fix
> turned out to already be sitting in the plan unrecognised, and a
> deliberate *deferral* that pushed against a load-bearing decision and
> was resolved by not deciding yet.

---

## Table of contents

1. [Starting point — and the choice not to skip](#1-starting-point--and-the-choice-not-to-skip)
2. [The premise correction](#2-the-premise-correction)
3. [The curve: cost per level, not value per kill](#3-the-curve-cost-per-level-not-value-per-kill)
4. [The risk premium](#4-the-risk-premium)
5. [Mass level-ups, and the fix that was already in the plan](#5-mass-level-ups-and-the-fix-that-was-already-in-the-plan)
6. [Behemoth timing: a pushback, and a deferral](#6-behemoth-timing-a-pushback-and-a-deferral)
7. [What shipped](#7-what-shipped)
8. [Ideas considered and rejected](#8-ideas-considered-and-rejected)

---

## 1. Starting point — and the choice not to skip

The session opened with Claude presenting three candidate next steps —
3D (XP), 4A/4B (maturity), or jumping to 5 (arsenal framework) — because
the previous session's docs and the plan of record disagreed about what
came next. The previous session had ended pointing at the arsenal, on the
back of the owner's remark that balance couldn't be judged without more
weapons.

**The owner rejected the fork outright:**

> I think we shouldn't jump or skip phases, let's be linear, clear and
> focused. Let's not add answers that there are no questions for yet.

That second sentence is a sharper statement of §4 of the 2026-08-05 record
than anything in the record itself, and it settles the ordering question
permanently: **Phase 4 adds questions; Phases 5/6 add answers.** Answers
before questions is building for pressure that does not exist yet.

The owner also clarified what they had actually meant by "we can't
balance yet" — not *sequencing*, but **scope**: weapon damage numbers,
slime speed, overall game feel. Those need the systems in place first.
That is a Phase 8 concern (Decision 13's supersession), not a reason to
reorder Phase 3.

So: 3D, linearly.

---

## 2. The premise correction

While laying out 3D's open questions, Claude described stacked level-up
cards as landing *"right when the arena is most dangerous."* The owner
caught the assumption underneath it:

> Before continuing please remind yourself the premise of the game... it's
> like a turret defence but imagine a stationary PoE character mowing down
> hordes. There is no aiming. Because from your text it feels like you
> still want to think that the player is aiming at any point, which is not
> true.

The correction is right and worth recording, because the error is subtle
rather than obvious. Nothing in that sentence *said* the player aims — but
"most dangerous" only carries weight if the player has moment-to-moment
agency they're being denied. **They don't.** Weapons fire and target
themselves. A modal pause interrupts nothing the player was doing.

This is the same class of error §4 of the 2026-08-05 record was written to
prevent, and it recurred anyway, which is itself the argument for keeping
the premise written down:

> The player is a stationary PoE character mowing down a horde. No aiming,
> no movement, no positioning. Three decision surfaces exist in total: the
> pre-run deck, in-run card picks, gem socketing. Survival time is the
> score. The field is the horde's *economy*, not the threat. Field control
> buys spawn **distance**, never spawn rate.

**Restating the level-up problem correctly** changed what counted as a fix.
It is not "the player can't react." It is:

- Three build decisions made back to back, blind — you can't see what the
  first pick did before making the second.
- A behemoth dying is the game's biggest dramatic beat, and it gets buried
  under UI.
- Level-ups *are* the pacing rhythm. Three at once spends the beat and
  leaves nothing behind it.

That reframing is what made §5's fix visible.

---

## 3. The curve: cost per level, not value per kill

The 2026-08-05 record (§12) and Decision 31 both say the level curve goes
superlinear and leave the shape as "a balance job." Claude asked for the
shape rather than picking silently, since shape is more than a number.

**The owner's answer contained the load-bearing half of the reasoning:**

> I think we can balance the levels not by how much XP is given, but by
> how much XP is needed to level up, so the amount of XP per level needed
> should increase per level. That is how it should and does work in other
> games.

This matters more than it looks. **Granted XP must stay honest to
destroyed mass**, or Decision 31's entire anti-farming argument collapses —
the moment grant value becomes a pacing dial, "which mass is worth more"
becomes tunable, and neglecting the field to farm behemoths becomes a
strategy. Putting the whole pacing lever on *cost* leaves the grant side
untouched and physically honest.

Shape agreed: **quadratic**, `12 + 6.5·L + 0.45·L²`.

| Level | Old (linear) | New (quadratic) |
|---|---|---|
| 1 | 19 | 19 |
| 5 | 45 | 56 |
| 10 | 77 | 122 |
| 20 | 142 | 322 |

Identical at level 1 by construction, so the intended early rush (§12:
soft slime → wide `clearAt` radius → fast early XP) survives untouched. It
bends from there — ~1.6× the old cost by level 10, ~2.3× by level 20.

Geometric (`base · rᴸ`) was the alternative and was not taken: it makes
deep levels genuinely rare, which sounds right but hard-couples the whole
curve to one growth constant. Quadratic gives one coefficient to tune with
a shape that stays legible at both ends.

**The fast-first-level shim is gone.** `freshState()` had hardcoded
`xpToNext: 10` with a comment explaining it was prototype parity, bypassing
the formula for level 1 only. The owner's call: *"No fast first level."*
Level 1 now comes from the curve like every other level.

---

## 4. The risk premium

Decision 31 specifies a "modest risk premium (~25–50%)" on horde kills —
mass that was actively trying to kill you pays a little more than the same
mass cleared loose in the field.

Claude recommended 25%, the bottom of the written range. **The owner went
lower still:**

> Risk bonus should be not that big, like 25 percent max — I think keep it
> to 15 percent.

Correct instinct, and for the reason the range exists at all: the failure
mode Decision 31 guards against gets *worse* the higher this number goes.
At some premium, deliberately letting the field mature to farm behemoths
becomes the optimal XP strategy, and the design has no other defence
against that — the honest-grant rule (§3) removes every alternative dial.
15% is comfortably inside the safe zone and trivially raisable later; a
number that's too generous is discovered as a degenerate strategy months
after it ships.

Implementation note that mattered: the premium applies to **only the
coagulant share** of a `clearAt` call's removed mass, never the grid share.
Decision 42 anticipated this exactly — *"the risk premium is one multiplier
on the coagulant portion"* — so `clearAt` now tracks `coagulantRemoved`
alongside `totalRemoved`. `totalRemoved` stays the honest physical figure
the return value and the gem-drop threshold use; only the XP basis carries
the bonus.

---

## 5. Mass level-ups, and the fix that was already in the plan

**The problem, raised by the owner:**

> One behemoth kill can cause 3 level ups is not good in the long run
> while it is fun.

Real, and 3D actively makes it worse: the value cap came off in 3C, so a
behemoth kill is now a genuinely large XP number arriving as a single
pickup.

The owner proposed scaling both sides — XP dropped *and* XP required —
citing WoW. Worth recording why that only half-applies here: in WoW, mob
XP rises with mob level, so the two curves track each other. **In this game
coagulant mass is capped by construction** (`FORMATION_RADIUS_CAP`,
Decision 43), so per-kill XP plateaus rather than climbing. What *does*
rise over a run is total XP throughput, via event frequency. So the cost
curve is the right lever and the grant side needs no scaling — which lands
in the same place as §3, from a different direction.

**But the curve alone doesn't fix the early case**, and this is the part
worth recording. At low level, thresholds are ~19–30 XP while a behemoth
kill pays hundreds. No plausible curve makes an early behemoth kill worth
less than a level.

**The actual fix was already in the plan, unrecognised.** §12 lists gem
showers on big kills, and separately notes gems stay physical and drifting
"for good feel, and it keeps Magnetism meaningful." Read together with the
drift system, that is not two cosmetic notes — it is a rate limiter:

> **Gems are the XP delivery mechanism, and delivery takes time.** A
> behemoth dying 600px out showers a dozen gems that drift in over several
> seconds. The XP arrives as a stream, not a dump, so the level-ups spread
> themselves across the fight instead of stacking into one modal queue.

So `dropGemShower` splits any large value into up to 12 gems. One
refinement added on top: **per-gem drift jitter**. Without it, a behemoth
killed right at the perimeter has no drift distance and its whole shower
arrives nearly simultaneously — the clump problem returns in the exact
situation where it matters most. Each shower gem now samples its own speed
multiplier (0.7–1.3×), so a shower always arrives as a stream regardless of
where it died.

**Explicitly not done:** removing the modal pause on level-up. It is the
real fix if showers turn out to be insufficient, but it belongs to Phase 5,
which restructures the card pool anyway. Noted rather than pre-empted.

---

## 6. Behemoth timing: a pushback, and a deferral

The owner raised, alongside the level-up problem:

> We will have to fix appear times of behemoths etc, because at lvl 1 a
> behemoth is unstoppable.

The observation is real — a vein injects mass far faster than ambient
growth, so it can manufacture a dense enough patch to spark a behemoth
early in a run.

**Claude pushed back rather than implementing it**, per the ground-truth
override protocol (Decision 22 / `CLAUDE.md`). A level- or time-gate on
behemoth formation contradicts **Rule 4** (Decision 27): size is emergent
from available mass, never scripted, which is what makes coagulant size *an
automatic readout of how badly the player is losing*. A spawn gate is
precisely the scripted difficulty lever the entire rework exists to delete.

Non-scripted levers that reach the same outcome do exist: the
`MASS_BEHEMOTH` threshold, `FORMATION_RADIUS_CAP`, and — per Decision 28 —
the intended one, event frequency and reach. It's also possible the problem
was already substantially fixed by the previous session's speed halving,
which the owner had not yet played at the time of the report.

**The owner's call: defer entirely.**

> We can wait till we have all the systems to revisit this question about
> the behemoth spawning too early. Thank you for reminding and pushing
> back, I appreciate it.

Recorded as Decision 62. The value here isn't the deferral itself — it's
that a load-bearing decision got tested rather than quietly overwritten,
which is the whole purpose of Decision 22 existing.

---

## 7. What shipped

| Area | Change |
|---|---|
| `tuning/xp.ts` | `xpToNext` quadratic; `COAGULANT_XP_RISK_PREMIUM = 0.15`; `GEM_SHOWER_UNIT` / `GEM_SHOWER_MAX_COUNT` |
| `grid/clear.ts` | Tracks `coagulantRemoved` separately; premium applied to the XP basis only; routes through `dropGemShower` |
| `systems/gems.ts` | New `dropGemShower`; per-gem `driftJitter` applied to drift speed |
| `state.ts` | `Gem.driftJitter` field; `xpToNext: xpToNext(1)` replacing the hardcoded `10` |

241/241 tests passing (up from 231 — 10 new across the curve's shape, the
premium's coagulant-only scope, and shower splitting/capping/conservation/
jitter). Typecheck and build clean.

**Owner's playtest verdict: "it plays much better now."**

One new item surfaced by that playtest and deliberately not fixed here:
**infection events fire too often at the start of a run.** In BACKLOG.

---

## 8. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **Jump to Phase 5/6 (arsenal) next** | Owner: don't skip phases. Phase 4 adds *questions*; 5/6 add *answers*. Answers before questions is building for pressure that doesn't exist yet. |
| **Geometric level curve** (`base · rᴸ`) | Makes deep levels genuinely rare, but hard-couples the whole curve to one growth constant. Quadratic keeps one legible coefficient. |
| **Scaling granted XP as a pacing lever** | Breaks Decision 31's anti-farming guarantee — the moment grant value is tunable, "which mass pays more" becomes a strategy. All pacing lives on level *cost*. |
| **Risk premium at 25–50%** (Decision 31's original range) | The higher it goes the more attractive field-neglect farming becomes, and the honest-grant rule removes every alternative defence. Landed at 15%. |
| **Capping XP carried per grant** | Would fix stacked level-ups by destroying XP, breaking mass-conservation of the reward economy. Gem showers achieve the same spreading without discarding anything. |
| **Removing the modal level-up pause now** | The right fix if showers prove insufficient, but it belongs with Phase 5's card-pool restructure rather than being pre-empted here. |
| **Gating behemoth formation on level or elapsed time** | Contradicts Rule 4 (Decision 27) — size must stay an emergent readout of player performance, not a script. Deferred to Decision 62; non-scripted levers exist if it's still a problem later. |
