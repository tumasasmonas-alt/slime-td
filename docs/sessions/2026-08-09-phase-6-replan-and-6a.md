# Session record — 2026-08-09
## Phase 6 re-planned, then 6-0 and all of 6A built against the new plan

**Type:** review + planning + implementation. One review pass that
re-phased the whole of Phase 6, then two batches built back to back:
6-0 (the pre-run weapon select) and 6A (6A-1 + 6A-2, the first real
support gems).
**Participants:** project owner + Claude.
**Outcome:** Phase 6 is now nine batches instead of six. 6-0 and 6A are
shipped, committed and pushed. **Gems are real content for the first
time** — 20 of them, socketable, meaningful on every weapon — and the
Immolation Ring finally has a visual, closing the oldest open item on the
BACKLOG.

> **Why this file exists.** Two commits, three new decisions, a full
> re-phasing of the project's largest remaining phase, and one scope
> correction from the owner that reshaped the batch it landed in — the
> kind of day `docs/PROGRESS.md`'s own convention (Decision 37) says
> belongs in a dedicated record. As with the 2026-08-08 record, this is a
> **summary with pointers**, not a re-derivation: the plan docs and
> Decisions 73–75 carry the full reasoning, and duplicating it here would
> only create a second copy to keep in sync.

---

## Table of contents

1. [The Phase 6 re-plan, and the bug it found](#1-the-phase-6-re-plan-and-the-bug-it-found)
2. [Phase 6-0: the pre-run weapon select](#2-phase-6-0-the-pre-run-weapon-select)
3. [Planning 6A, and the split](#3-planning-6a-and-the-split)
4. [The owner's scope correction — "don't just not give the player gems"](#4-the-owners-scope-correction--dont-just-not-give-the-player-gems)
5. [Phase 6A-1: the gem foundation](#5-phase-6a-1-the-gem-foundation)
6. [Phase 6A-2: the Behaviour class](#6-phase-6a-2-the-behaviour-class)
7. [Two real bugs, both caught by tests](#7-two-real-bugs-both-caught-by-tests)
8. [What was deliberately not built](#8-what-was-deliberately-not-built)
9. [Verification, and the environment constraint](#9-verification-and-the-environment-constraint)
10. [What shipped](#10-what-shipped)
11. [Ideas considered and rejected](#11-ideas-considered-and-rejected)
12. [What's next](#12-whats-next)

---

## 1. The Phase 6 re-plan, and the bug it found

The owner opened with a review brief: *"review, rethink the phase 6, plan
its stages and come back with a plan for 6-0. We need a comprehensive
plan as phase 6 is pretty big."*

The existing phasing table (`phase-5-6-arsenal.md` §13) had been written
on 2026-08-07, **before Phase 5 existed as code**. Reviewing it against
shipped code rather than the design it was authored against produced five
findings, of which three mattered:

**Finding 1 — four built weapons were unreachable in any run.** Blades,
Frost, Missile and Immolation Ring could not be equipped by any path.
`startRun()` always filled the deck exactly (3 of 3 slots) and the
`newWeapon` card's only gate was a free slot that could therefore never
exist. Both halves were individually correct; the interaction was not,
and neither the 380 nor the 389 tests then in the suite caught it —
because the deck-full case is precisely what the gating test asserts
should offer nothing. A passing test suite asserting the wrong thing.

**Finding 2 — extensions were scheduled nowhere.** The §13 table had only
"Gems:" and "Weapons:" batches. The seven *existing* weapons appeared in
no batch at all, so their 21 extensions — half of what a socket can hold,
per arsenal plan §5 — had no home under any phasing.

**Finding 3 — three batches were too large to playtest independently.**
Old 6D carried two new subsystems; old 6F carried all six of the
catalogue's expensive-to-render transformative gems.

**Two of the proposals moved calls the owner had already settled** (the
gate's position, and where extensions live), so per `CLAUDE.md`'s
ground-truth override protocol they were raised and waited for a yes
rather than being written down as superseded. Both got one.

Full account: **`docs/plans/phase-6-roadmap.md`**.

---

## 2. Phase 6-0: the pre-run weapon select

**The owner's answer to one question set the whole surrounding design.**
Asked whether a pre-run deck must fill every slot:

> *"All of the slots equipped, as you will be able to buy more slots with
> currency, there is no way to change weapons mid-run. And the player
> should not be offered any weapons in the pool — only weapon-specific
> extensions, support gems and core gems."*

This **reclassified finding 1 from a bug to missing UI**. A full deck from
frame one was always the intended design; what was missing was the screen
that chooses it. It also **supersedes** one clause of arsenal plan §5
(*"an unlocked slot is optional to use"*) — recorded as a deliberate,
disclosed supersession rather than a silent one.

**Shipped**: a `Choose Weapons` / `Change Loadout` overlay reachable from
the start and game-over screens, built on `ui/weaponRow.ts`'s `'select'`
mode (scaffolded in 5C for exactly this), enforcing an exact-count deck
with a visible capacity refusal once full; a deck line of weapon icons on
both screens; `Try Again` keeping the deck in-memory (session
persistence, not `localStorage` — the owner's ask). The `newWeapon`
`CardChoice` kind was **deleted outright** rather than disabled — with the
owner's rule in place it was dead code by definition.

Full account: **Decision 73**, `docs/plans/phase-6-0-weapon-select.md`.
Committed as `feb01b9`.

---

## 3. Planning 6A, and the split

The owner reaffirmed the standing workflow at this point, and it held for
the rest of the day:

> *"as per rhythm of previous sessions, before doing any developmental
> work plan, ask me questions and then ask for greenlight if everything
> is clear."*

Planning 6A found it **larger than 4C had been when 4C was split**. Only
2 of the 14 Behaviour gems are the "one function on stage 3" the arsenal
plan's §4 table assumes; the other 12 need machinery that did not exist.
The owner called the split: *"No, plan 6A-2, then I will greenlight you
for full 6A with full autonomy."*

The seam is deliberate. **6A-1 makes gems exist, be granted, be socketed,
and change a number** — playtestable on its own as *"sockets work and my
numbers move,"* which is most of what the Phase 5 gate needs from the gem
side. **6A-2 makes them change what a weapon does.**

Two design questions were settled during planning, both by the owner
beating the options offered:

- **Deck memory on `Try Again`**: *"Try again button remembers the
  loadout, but below it should be another button that would open a
  loadout window with a button to start the run."*
- **The HUD's `DMG`/`SPD` readout**, asked how it should represent a
  multi-weapon multi-gem build: *"recreate this into a single readout of
  overall dps the core is doing."* Better than all three options offered,
  and what shipped.

---

## 4. The owner's scope correction — "don't just not give the player gems"

**The sharpest moment of the day, and it reshaped the batch.** Mid-plan,
the owner interrupted:

> *"Wait a moment, i want to ask will the weapon visual be included? and
> when are we implementing the rest of the arsenal? Also lets revisit the
> pierce bounce and ricochet gems and think what they could do if slotted
> in not projective weapon. **You have to be creative and not just not
> give the player gems.**"*

The draft matrix being reviewed had refused Pierce/Bounce/Ricochet on
non-projectile weapons as "doesn't apply" — a lazy answer dressed as a
principled one, and the owner named it. Every refusal is a gem the player
picks up and cannot use, which is the *"cards appear to do nothing"*
failure (2026-08-05) wearing a different hat.

**The resolving insight**: every archetype has its own real analogue of
*"what stops a hit from doing more."* For projectiles it's the projectile
terminating. For orbitals and rings it's the per-target hit-cooldown
window. For pulses and clouds it's the density-resistance curve itself.
Pierce/Fork/Chain/Bounce/Ricochet reinterpret against **that**, per
archetype — not whitelisted per weapon, and not shipped as inert
placeholders.

The archetype matrix (`phase-6a2-behaviour-gems.md` §6) was reworked to
eliminate every refusal before the batch was greenlit.

The same message produced the day's one scope addition. Asked about
weapon visuals, the owner folded a long-open fix into the batch:

> *"Immolation ring has no visual make a bright green circle where
> imolation ring sits around the core. Fold this fix into 6A. And I
> greenlight full 6A with full autonomy for you. You got it, make it
> good."*

---

## 5. Phase 6A-1: the gem foundation

**`DeliveryKind` is the enabling abstraction.** Five archetypes —
`projectile | orbital | pulse | cloud | ring` — sort the seven weapons by
*how they deliver damage*, not by name. A gem is authored once per
archetype instead of once per weapon.

This corrected a cost estimate in the plan's own source material, and the
correction is worth keeping: reinterpretation had been priced at "18 × 20
authored meanings — exactly the N × M cost the pipeline exists to avoid."
That assumed reinterpretation happens **per weapon**. Reading the seven
shipped weapons back, it doesn't — it happens **per archetype**, which is
a small fixed set. The expensive version of call 2 was never the version
being proposed.

**Shipped**: `weaponMods(state, key)`, computing a per-weapon
damage/rate/area/duration/velocity multiplier struct from socketed
Amplifier gems, replacing the deleted global `damageMult()`/
`atkSpeedMult()`; six Amplifier gems, sized against the *old maxed
passives* rather than at face value, per the owner's call 3; gem sockets
and inventory (`systems/gemSockets.ts`); a `'gem'` `CardChoice` kind that
opens the socket picker immediately on pick — the same *"just got it,
want to spend it now"* moment 5C built Manage Loadout for; and
`systems/dps.ts`, exponentially smoothing `clearAt`'s own removal total
(`DPS_TIME_CONSTANT = 1.5`) rather than showing a spiky instantaneous
number.

The legacy `damage`/`atkSpeed` passives are **deleted**, as the roadmap
required — leaving them would have meant two systems doing the same job,
one of them invisible.

Full account: **Decision 74**, `docs/plans/phase-6a1-gem-foundation.md`.

---

## 6. Phase 6A-2: the Behaviour class

Four mechanisms, each deliberately deferred in 5A on the grounds that
*"no gem yet needs a uniform hook there"* — now built, each with real
gems to prove it against, which was the condition 5A set:

| # | Mechanism | Carries |
|---|---|---|
| 1 | **RESOLVE**, as new `ClearOptions` fields | Splash, Overflow, Kickback, Priming |
| 2 | **Projectile behaviour flags**, generalizing Chain's native hop machinery via a shared `advanceHop()` | Pierce, Fork, Chaining, Bounce, Homing, Ricochet |
| 3 | **A weapon registry + deferred emissions** | Echo, Barrage |
| 4 | **Emission multiplication** via `emissionAngles()` | Multishot, Formation |

**Mechanism 3 is load-bearing far beyond this batch.** A registry that can
invoke any weapon's `deliver` by key is exactly what **Trigger** needs in
6I — *"this weapon deals no damage itself; on impact it fires the weapon
socketed below it"* — which the arsenal plan calls the single most
build-generating mechanic in the catalogue. Building it here for Echo
makes Trigger close to free later. It also replaced `main.ts`'s seven
hand-written weapon update calls with one `updateAllWeapons(state, dt)`
loop.

All 14 Behaviour gems shipped on top, plus the **bundle card**
(`tuning/bundles.ts`) — every `BUNDLE_INTERVAL = 5` levels the normal draw
is replaced by three themed packages, each granting every gem it holds in
one pick. This was deferred out of 5B *and* 6A-1 on the same reasoning
both times: six Amplifier gems can't form a package worth offering
("Amplifier + Overclock" teaches nothing a single card doesn't). Twenty
gems can.

**Immolation Ring's visual** shipped in the same batch:
`render/immolationRing.ts`, a persistent `#39ff6a` stroke at
`immolationRadius(lvl, perimeter) * mods.area`. Open since the Phase 2
port, when the weapon was still Ward Pulse — a weapon misfiled as a
passive, so Decision 11's *"a weapon's signature visual is part of the
weapon"* never applied to it. Decision 70 fixed the classification in 5A;
this fixed the consequence.

Full account: **Decision 75**, `docs/plans/phase-6a2-behaviour-gems.md`.
Committed as `7164375`.

---

## 7. Two real bugs, both caught by tests

**A break from the pattern worth noting.** Every phase since 4A has found
its real bugs only by *running the game*. This batch found both of its
bugs in the **test suite**, before either reached the browser — which is
the outcome Decision 20's "guard bugs with tests, prefer the invariant
over the mechanism" convention exists to produce, finally paying off on a
batch large enough to matter.

**1. `WeaponDef.stats()` was gem-blind.** It was pure `(lvl) => string`
with no gem awareness, so once gems existed to socket, the inventory
screen's live stat line silently ignored every one of them — a genuine
gap in 6A-1's own module list, not just an implementation slip. It passed
its existing tests because nothing had tested it *with a gem socketed*.
Fixed by widening the signature to `(lvl, mods = IDENTITY_MODS)` and
threading `weaponMods(state, key)` through `ui/weaponRow.ts`. Verified
live: Bolt Turret's line moved from "15 pwr" to "22 pwr" after one
Amplifier gem (15 × 1.45 = 21.75 → 22).

**2. `spawnForks()` discarded every projectile it created.** It pushed
forked children directly onto `state.projectiles` while
`updateProjectiles` was still mid-iteration over that same array via
`for...of`; since the function ends by reassigning
`state.projectiles = remaining`, every child was dropped the instant it
was made. The Fork gem would have socketed, described itself correctly,
and done exactly nothing — the *"cards appear to do nothing"* failure
mode again, and invisible without a test asserting the child survives the
tick. Fixed by returning children (`spawnForks(p): Projectile[]`) for the
caller to `remaining.push(...)` instead of mutating the live array.

This is also the third entry in the project's running list of
**array-mutation-during-iteration** and **mutate-during-draw** bugs
(DECISIONS #4, #7). Same family, new location.

---

## 8. What was deliberately not built

Both recorded in `docs/BACKLOG.md` and in the plan docs rather than left
as unstated gaps — the distinction between a *disclosed* scope limit and
a silent one is the whole point:

**Fork/Chaining/Bounce/Ricochet are real only on the `projectile`
archetype.** Their primary effect reinterprets everywhere, but the deeper
"produces a genuine second hit event" behaviour only exists where
`updateProjectiles` already has per-target impact resolution to hook
into. Extending it further needs `clearAt` to report per-target hit/kill
events *back* to its caller — giving RESOLVE a return channel, not just
options going in. That is a real architectural change, out of scope for
"make the existing gems mean something," and not attempted.

**Homing and Multishot/Formation are not wired for Immolation Ring.**
Both assume a discrete per-shot origin; the ring is drawn once at a fixed
radius around the core. Wiring either would desync the visual from the
hit logic — the ring would have to either follow a moving "shot"
(contradicting what it visually is) or accept the gem while silently
ignoring its stated effect (dishonest). Left unwired and documented in
`weapons/immolation.ts`.

**Immolation Ring's third balance gap stays open.** Two of its three
(no Overclock response, no Amplifier response) closed *for free* once
`weaponMods` applied uniformly to every weapon — no Immolation-specific
code was needed. The third, Phase 4C-1's missing `WEAPON_DAMAGE_SCALE`
(+50%) pass, is a balance call for the owner and belongs with 6B, where
the weapon gets its real extensions. Its dead `maxLevel: 6` field goes at
the same time.

---

## 9. Verification, and the environment constraint

**The Browser pane was not compositing frames this session.**
`document.visibilityState` returned `'hidden'` — confirmed directly, not
inferred — which throttles `requestAnimationFrame` to near zero and makes
screenshot capture time out. An environment constraint on this machine's
setup, not a code bug and not a regression.

Rather than either fabricating results or stopping, this used the
project's own established technique: **Decision 59's deterministic debug
harness**, the same precedent set during the 3C lag investigation. A
temporary `window.__debugTick(n, dt)` / `window.__debugState()` bridge
was added to `main.ts`, used to drive roughly 700 manual ticks and
confirm the full gem pipeline end to end — socketing, `weaponMods`,
RESOLVE options, projectile flags, deferred emissions, and the Immolation
ring visual — then removed completely.

**The removal was verified, not assumed**: typecheck, the full test pass
and the production build were all re-run afterward, and the bundle hash
(`dist/assets/index-7VxPFNzO.js`) came out **byte-identical to before the
bridge existed**. A final fresh-tab smoke test confirmed zero console
errors and `window.__debugTick === undefined`.

One separate tooling problem was hit and is worth distinguishing from the
project's documented Vite self-reload quirk: after many sequential file
edits, the browser reported `SyntaxError: does not provide an export
named 'bladesPipeline'` while both the source and `npm run build` were
demonstrably correct. This was **browser-level ES module caching**, not a
source bug — cleared by stopping the server, removing `node_modules/.vite`,
restarting, and opening a genuinely new tab rather than reusing the old
one.

---

## 10. What shipped

| Area | 6-0 | 6A-1 | 6A-2 |
|---|---|---|---|
| New files | `ui/weaponSelect.ts` | `tuning/gems.ts`, `systems/weaponMods.ts`, `systems/gemSockets.ts`, `systems/dps.ts`, `render/immolationRing.ts` | `weapons/registry.ts`, `systems/resolveOpts.ts`, `systems/emissions.ts`, `tuning/bundles.ts` |
| `types.ts` | — | `DeliveryKind`, `AmplifierGemKey`, `BehaviourGemKey`, `GemKey`; `PassiveKey` −`damage`/`atkSpeed` | — |
| `state.ts` | — | `dpsAccum`, `dps` | `ProjectileBase` behaviour flags + RESOLVE fields, `Coagulant.lastHitAt`, `pendingEmissions` |
| Removed | `newWeapon` card kind | `damageMult()`, `atkSpeedMult()`, the `passive` card kind | — |
| Tests | 393 (from 389) | — | 495 (from 393) |

**Final state**: 495 tests across 45 files, typecheck clean, build clean,
production bundle 64.72 kB (22.80 kB gzip). Two commits: `feb01b9` (6-0 +
the re-plan) and `7164375` (all of 6A). Both pushed.

One pre-existing flake was observed and correctly identified rather than
chased: `veinField.test.ts`'s unseeded-RNG variance case, already on the
BACKLOG, failed once and passed on rerun.

---

## 11. Ideas considered and rejected

| Idea | Why rejected |
|---|---|
| **Refusing Pierce/Bounce/Ricochet on non-projectile weapons** | The owner named this directly: *"you have to be creative and not just not give the player gems."* Every refusal is a pickup the player can't use. Replaced with per-archetype reinterpretation against each archetype's own "what stops a hit" analogue. |
| **Gems switching behaviour on `WeaponKey`** | The N × M authoring cost the pipeline (Decision 70) exists to prevent. `DeliveryKind` keeps it at five archetypes. The discipline is explicit: the moment a gem needs to know it's looking at Bolt *specifically*, that cost has arrived and should be raised rather than written. |
| **Treating "four weapons unreachable" as a bug to patch** | The owner's answer showed a full deck was always correct and the *screen* was missing. Patching the card gate would have shipped a mechanic the design doesn't want. |
| **Shipping the bundle card in 6A-1** | Same reasoning that deferred it out of 5B: six Amplifier gems can't form a package worth offering. Waited for twenty gems. |
| **Auto-socketing a gem on card pick** | Removes the decision the socket system exists to create. Instead the card *opens the picker* — the pick is never invisible, but the placement is still the player's. |
| **Extending Fork/Chain/Bounce/Ricochet to all archetypes now** | Needs `clearAt` to gain a return channel for per-target hit events — a real architectural change. Disclosed as a scope limit instead of faked with placeholder mechanics. |
| **Wiring Homing/Multishot for Immolation Ring** | Would desync its fixed-radius persistent visual from its hit logic. Accepting the socket while ignoring the effect would have been the dishonest version. |
| **Fixing Immolation's `WEAPON_DAMAGE_SCALE` gap in this batch** | It's a balance call, not a bug, and belongs with 6B where the weapon gets its real content pass — the same reasoning that preserved it through 5A. |

---

## 12. What's next

**Phase 6B**: real extensions for the seven incumbent weapons, plus
Immolation Ring's remaining `WEAPON_DAMAGE_SCALE` gap and its dead
`maxLevel` field. This is the batch the re-plan *added* — it had no home
under any previous phasing (finding 2 above).

**Then the Phase 5 gate.** It has now moved twice, both times for the same
structural reason: it cannot judge *"is enhancement a decision or a
slider?"* until **both** things a socket can hold are real content. After
6A one of them is (gems); after 6B both will be. Moving it from after 5C
to after 6A, then to after 6B, was in each case avoiding a known-
meaningless result that could later be mistaken for a real finding.

**No blockers.** The 18-weapon / 65-gem catalogue is untouched by any of
this — the re-plan only re-sequenced batches and filled the extension
scheduling hole. Full phasing: `docs/plans/phase-6-roadmap.md` §3.
