# Phase 6A-3 — the loop fixes from the post-6A playtest

**Status:** 📋 **Planned 2026-08-09. Awaiting greenlight.** Nothing
implemented.

**What this is.** A small corrective batch between 6A and 6B, addressing
three of the six findings from the owner's first playtest on real gems.
Not new content — every item here is something 6A shipped that doesn't
survive contact with a real run.

**Why it comes before 6B.** 6B adds three real extensions per weapon,
which compete for the same sockets and arrive through the same card pool
and the same socketing UI. Both are currently broken in ways that would
make 6B's content unevaluable: the pool goes dead, and the socketing
interaction is unclear enough that the owner doubted it functioned at
all. It is also what the **Phase 5 gate** needs — that gate cannot judge
*"is enhancement a decision or a slider?"* while the pool offers only
Emergency Repair.

**Source:** the six playtest findings recorded in `docs/BACKLOG.md`
("Found in the 2026-08-09 post-6A playtest"); the owner's four answers,
2026-08-09; Decisions 31, 61 (the XP economy), 71 (the socket economy),
74–75 (Phase 6A); `docs/plans/phase-5-6-arsenal.md` §5, §11.

---

## Table of contents

1. [What the owner settled](#1-what-the-owner-settled)
2. [The XP curve goes geometric](#2-the-xp-curve-goes-geometric)
3. [The card pool stops caring about sockets](#3-the-card-pool-stops-caring-about-sockets)
4. [Socketing becomes legible](#4-socketing-becomes-legible)
5. [Deferred, with semantics recorded](#5-deferred-with-semantics-recorded)
6. [Modules touched](#6-modules-touched)
7. [Tests](#7-tests)
8. [Order of work](#8-order-of-work)
9. [Open questions](#9-open-questions)
10. [Risks](#10-risks)

---

## 1. What the owner settled

Four answers, 2026-08-09, after the playtest.

| # | Call | Consequence |
|---|---|---|
| 1 | **The XP curve goes geometric, now** — without measuring the DPS curve first. | §2. Accepted as unmeasured; the constant is isolated so a retune is one line. |
| 2 | **The card pool should not care whether the player has free sockets.** *"It shouldn't matter if i have open sockets or not, i should still be offered the same pool."* | §3. **Supersedes arsenal plan §11's no-dead-card rule for gems.** |
| 3 | **Leftover gems become currency** — a small amount on death, and the orbital trade ship recycles them mid-run. | Phase 7 work, not built here. Recorded so §3's "you will accumulate unusable gems" consequence is intentional, not an oversight. |
| 4 | **Core gems, when unsocketing is built, return to a core-gem inventory**, and removing `maxHp` clamps current HP to the reduced maximum. | §5. Deferred — semantics recorded now so the eventual build doesn't re-litigate it. |

**One sequencing note.** The owner's answer to *"what should I build
next"* was *"just #2 and #5 now, defer #1 and #4"* — but the same set of
answers chose *"go geometric now"* for #1 and volunteered, unprompted,
that *"the amount of levels the player is getting currently is insane...
I got up to lvl 80 within like what, not even 10 mins of playing."*
**#1 is therefore treated as in scope**, on the reading that the level
rate is upstream of the gem flood #3's answer describes. #4 stays
deferred. Raised explicitly rather than resolved silently.

---

## 2. The XP curve goes geometric

**The diagnosis, restated** (full version in BACKLOG): cost is quadratic
in level, income is proportional to DPS, and 6A's Amplifier gems make DPS
grow multiplicatively. Time per level is `O(L²) / O(DPS)` — once DPS
outgrows `L²`, time per level **falls**. Level 80 in under ten minutes is
that curve crossing over.

**The shape.** Keep the existing quadratic as the base and multiply it by
a per-level growth factor:

```
xpToNext(L) = round( (XP_BASE + XP_LINEAR·L + XP_QUADRATIC·L²) · XP_GROWTH^(L-1) )
```

**`XP_GROWTH^(L-1)`, not `^L`, is deliberate** — it makes `xpToNext(1)`
come out *exactly* as it does today (19), preserving Decision 61's
explicit intent that *"the intended early rush survives."* The curve only
begins to diverge as the exponent bites.

**First draft: `XP_GROWTH = 1.08`.** What that does, against today:

| Level | Today | Proposed | Multiple |
|---|---|---|---|
| 1 | 19 | 19 | 1.0× |
| 5 | 56 | 76 | 1.4× |
| 10 | 122 | 244 | 2.0× |
| 20 | 322 | 1 390 | 4.3× |
| 30 | 612 | 5 700 | 9.3× |
| 50 | 1 462 | 62 300 | 43× |
| 80 | 3 412 | 1 460 000 | 428× |

Early game is untouched by construction, the mid-game bends, and the late
game becomes geometric — which is the only class that outruns a
multiplicative power curve.

**`XP_GROWTH` is one named constant in `tuning/xp.ts`**, so retuning after
a playtest is a one-line edit. It is a **first draft and expected to
move** — every constant in this project has, and this one was chosen
without the measurement pass that was offered and declined.

**What must not change: the income side.** Decision 31's anti-farming
guarantee depends on granted XP staying honest to destroyed mass. Nerfing
`gemValueFromRemoved` would make neglecting the field an XP strategy.
Decision 61 already settled this — *"the pacing lever is what a level
costs, never what a kill grants"* — and this change stays inside it.

---

## 3. The card pool stops caring about sockets

**The owner's rule**, verbatim: *"I think it shouldnt matter if i have
open sockets or not i should still be offered the same pool. The pool
should not care if i have something."*

This **supersedes `phase-5-6-arsenal.md` §11's no-dead-card rule as it
applies to gems** — recorded as a deliberate, disclosed supersession per
`CLAUDE.md`'s ground-truth protocol. §11 is not wrong; its premise
changed. It assumed a gem you cannot socket is *worthless*, which stops
being true once leftover gems convert to currency (call 3).

**What changes:**

- `buildWeaponSidePool` stops filtering gems through `gemHasLegalHome` —
  every gem in `ALL_GEM_KEYS` is always a candidate.
- `buildBundlePool` stops requiring that every gem in a package has a
  legal home.
- Duplicates are fine. The pool does not check what the player already
  owns or has socketed.
- `gemHasLegalHome()` loses its only caller and is **deleted** along with
  its tests. `gemLegalFor()` stays — the socket picker still needs it,
  and `socketGem()` still refuses illegal placements.

**This deletes finding #2 at the root.** The pool can no longer go dead,
so no gem-upgrade system, no extended socket ladder, and no scaling
fallback needs designing. The `{ kind: 'heal' }` fallback stays as a
genuine last resort but should now be unreachable in practice.

**The asymmetry, flagged rather than decided (see §9).** Extensions
have **no inventory to bank into** — `applyCardChoice` writes an
extension straight into a weapon's socket, and there is no
extension-inventory anywhere in the design (this is also why
`withdrawPoints()` clamps rather than evicting one). So an extension card
drawn with no free socket is *genuinely unplaceable*, not merely
redundant. **This plan keeps the free-socket gate on extensions only**,
and lets gems and bundles ignore sockets entirely. If the owner wants
extensions to bank too, that is a larger change (a new inventory, a new
placement UI) and belongs with 6B, which is where real extensions land.

---

## 4. Socketing becomes legible

**The finding.** The owner could not tell whether socketing worked:
*"the area that you need to click to socket the gems is very unclear, the
empty support socket is too small and unintuitive... Even I second
guessed if it worked or is there a bug that you cant socket anything."*

**This is the project's own worst-known failure mode recurring.** The
2026-08-05 *"cards appear to do nothing"* finding is cited across the
design docs as the thing to design against, and 6A-1 built the
open-the-picker-on-pick flow specifically to avoid it. It came back one
layer down: the **pick** is visible now, the **socket** is not.

**Three concrete causes, all in `ui/weaponRow.ts` / `index.html`:**

1. An empty socket is a bare `○` text glyph — no padding, no minimum hit
   area, no border, no label.
2. Its only affordance is a `title` tooltip, which you must already
   suspect is clickable to discover.
3. **There is no persistent view of owned gems anywhere.** The only path
   to inventory is clicking an empty socket, which then filters to gems
   legal *for that weapon* — so a gem that fits nothing currently equipped
   is invisible in the entire UI. After §3 ships, the player will hold
   many such gems, which makes this much worse.

**What ships:**

- **A persistent gem inventory panel** beside the loadout list, showing
  every owned gem grouped by kind with a count, its icon and name. This
  is the owner's explicit request: *"we should have in the loadout screen
  sort of an inventory section to the side of the loadout screen, where
  you could see all of your available gems."*
- **Click-to-place as the primary interaction.** Clicking a gem in the
  panel enters a *placing* state: every socket it can legally go into
  highlights across all weapon rows, and illegal ones visibly dim.
  Clicking a highlighted socket places it; clicking the gem again, or
  anywhere else, cancels.
- **Real click targets.** An empty socket becomes a proper control — a
  minimum ~28×28px hit area, a dashed border, a `+` glyph rather than a
  near-invisible `○`, and a hover state. Filled gem sockets keep
  click-to-unsocket but gain the same sizing and an explicit hover cue.
- **An instruction line**, because discovery has already been shown to
  fail here once: a short *"Click a gem, then an empty socket"* hint above
  the panel. Explicit beats discoverable for an interaction this
  load-bearing.
- The existing click-empty-socket-to-open-a-picker path **stays** as a
  second route — it works, it is tested, and removing a working path to
  replace it wholesale is a bigger change than the finding warrants.

---

## 5. Deferred, with semantics recorded

**Finding #4 — core gems cannot be unsocketed — is not built in this
batch**, per the owner's sequencing answer. The design questions that
blocked it are now answered, so the eventual build doesn't re-open them:

- **A core gem returns to a new core-gem inventory**, never destroyed —
  consistent with the *"no destructive respec, ever"* rule (arsenal plan
  §5, call 13) that `unsocketGem()` and `withdrawPoints()` both already
  honour. This means a new inventory container, since `state.gemInventory`
  holds weapon gems only.
- **Removing `maxHp` reduces max HP by 20 and clamps current HP to it.**
  Socketing currently does `maxHp += 20` *and* heals 20; without the
  clamp, a socket/unsocket loop is a free heal.

**Findings #3 (slime balance) and #6 (point/gem abundance) stay deferred**
as the owner directed. #6 shares a root cause with §2 — re-measure it
after the curve change rather than tuning grant rates against a moving
target.

---

## 6. Modules touched

| Module | Change |
|---|---|
| `tuning/xp.ts` | `XP_GROWTH` constant; `xpToNext` gains the geometric term |
| `systems/cards.ts` | Gems and bundles stop gating on free sockets; extensions keep their gate |
| `systems/gemSockets.ts` | Delete `gemHasLegalHome` (loses its only caller) |
| `ui/inventory.ts` | The gem inventory panel; placing-state ownership |
| `ui/weaponRow.ts` | Socket controls resized/relabelled; highlight + dim states for placing mode |
| `index.html` | Panel markup, panel/socket/highlight CSS, layout for the side panel |

Deliberately untouched: `systems/xp.ts` (`grantXp` is unchanged — only
the cost function moves), `tuning/sockets.ts` (the ladder stays as it is;
§3 removes the reason to extend it), and every weapon module.

---

## 7. Tests

**Curve invariants, not coefficients** (Decision 20 — test the invariant,
not the mechanism, so a retune doesn't break the suite):

- `xpToNext(1)` is unchanged from the pre-6A-3 value — the early rush is
  preserved by construction, not by luck.
- `xpToNext` is strictly increasing.
- The **ratio** `xpToNext(L+1) / xpToNext(L)` exceeds any fixed polynomial
  ratio for large `L` — i.e. the curve is genuinely superpolynomial. This
  is the property that fixes the bug; asserting a specific value at
  L=50 would just pin a constant that is expected to move.

**Pool invariants:**

- A gem is offered when the player has **zero** free sockets — the exact
  case that produced the bug.
- The pool never degrades to `[{ kind: 'heal' }]` while any gem exists
  (the regression test for the reported symptom).
- An extension is still **not** offered without a free socket — the
  asymmetry in §3 is deliberate and should be pinned so it isn't
  "cleaned up" later.
- Bundles are offered regardless of socket availability.

**Socketing:**

- `socketGem` still refuses an illegal or socket-less placement — the pool
  loosening must not loosen placement itself.
- Placing-mode state transitions: selecting a gem, placing it, cancelling.

---

## 8. Order of work

| # | Step | Checkpoint |
|---|---|---|
| 1 | `XP_GROWTH` + the curve, and its invariant tests | Suite green; a run visibly levels slower |
| 2 | Ungate gems/bundles in `cards.ts`; delete `gemHasLegalHome` | Pool tests green, including the zero-free-sockets case |
| 3 | Socket controls: sizing, border, `+`, hover | Sockets are obviously clickable before any new UI exists |
| 4 | The inventory panel: markup, CSS, render | Every owned gem visible without opening a picker |
| 5 | Placing mode: select → highlight → place → cancel | Both routes work; the old picker path still passes its tests |
| 6 | **Verify live in the browser** — level pacing at a high level, a full-sockets card draw, and a socket performed *only* via the new panel | Zero console errors; typecheck, tests, build clean |

**Step 6 matters more than usual here.** Two of the three items in this
batch are *"the player couldn't tell what was happening"* bugs, which by
definition cannot be verified by a passing test suite.

---

## 9. Open questions

**1. Should extensions bank like gems, or keep the free-socket gate?**
§3 keeps the gate, because an extension has nowhere to go and would
otherwise be a genuinely dead card — the exact thing the owner's rule is
trying to prevent, arriving from the other direction. Making extensions
bankable needs an extension inventory and a placement flow, which is 6B
work. **Flagged for a yes/no rather than assumed.**

**2. `XP_GROWTH = 1.08` is an unmeasured first draft.** The measurement
pass was offered and declined in favour of shipping now, which is a fine
call — but the number is a guess, and the table in §2 is arithmetic, not
evidence. Expect one retune after a playtest.

---

## 10. Risks

**1. The curve could overshoot into feeling grindy.** 43× at level 50 is
a large correction, and the failure mode on the other side (levels stop
arriving, the build stops developing) is less obviously wrong during a
playtest than the current one — it reads as "hard" rather than "broken."
Watch for it specifically; it is the reason `XP_GROWTH` is isolated.

**2. Ungating the pool trades one problem for a milder one.** The player
will now accumulate gems they cannot use. That is intentional (call 3 —
they become currency), but the currency sink is **Phase 7** and does not
exist yet, so between this batch and then, surplus gems are simply
surplus. Worth confirming that reads as "saving up" rather than "these
cards are junk."

**3. The inventory panel competes for space** on a screen that already
lists every weapon with stats, sockets and a `+`/`−`. On a small viewport
this could crowd. The panel should collapse or scroll rather than push
the weapon list off-screen.

**4. Two socketing routes could confuse rather than clarify.** Keeping the
old picker alongside the new panel is the conservative choice, but two
ways to do one thing is its own UX smell. If the panel proves clearly
better in live testing, retiring the picker is the follow-up — noted so
the duplication is a decision, not a leftover.

---

*Planned 2026-08-09. §9's two questions are open; nothing here is in
`docs/DECISIONS.md` yet — per the project's posture, these go in as
decisions when the batch ships.*
