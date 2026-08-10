import type { GameState } from '../state';
import type { WeaponKey } from '../types';
import { bladesPipeline } from './blades';
import { boltPipeline } from './bolt';
import { chainPipeline } from './chain';
import { fissionPipeline } from './fission';
import { frostPipeline } from './frost';
import { immolationPipeline } from './immolation';
import { lancePipeline } from './lance';
import { missilePipeline } from './missile';
import { runWeaponPipeline, type WeaponPipeline } from './pipeline';
import { poisonPipeline } from './poison';
import { shockwavePipeline } from './shockwave';

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S4): a weapon
// invocable by key rather than by a hand-written call in main.ts. Forced
// into existence by deferred emissions (Echo/Barrage firing a weapon's
// own `deliver` again later than the tick that decided to fire), but it
// pays for itself twice more: main.ts collapses from seven manual calls
// to one loop (untenable at 18 weapons regardless), and it structurally
// prevents the "built but never wired into main.ts" failure this project
// already had once (docs/BACKLOG.md, Phase 6-0's unreachable-weapons
// finding) — a weapon missing from this map fails a test, not a
// silent no-op. It is also what Trigger (6I) needs to fire "the weapon
// socketed below it" by key.
export const WEAPON_PIPELINES: Readonly<Record<WeaponKey, WeaponPipeline>> = {
  bolt: boltPipeline,
  blades: bladesPipeline,
  chain: chainPipeline,
  frost: frostPipeline,
  poison: poisonPipeline,
  missile: missilePipeline,
  immolation: immolationPipeline,
  shockwave: shockwavePipeline,
  fission: fissionPipeline,
  lance: lancePipeline,
};

// main.ts's single call replacing seven hand-written updateXWeapon()
// calls. The per-weapon `!state.grid` check matches each weapon's own
// pre-6A-2 guard exactly (no behaviour change, only the dispatch is
// generic now) — checked per-weapon rather than once at the top so a
// missing grid still runs `cleanup`, exactly as it did before.
export function updateAllWeapons(state: GameState, dt: number): void {
  for (const key of Object.keys(WEAPON_PIPELINES) as WeaponKey[]) {
    const pipeline = WEAPON_PIPELINES[key];
    const lvl = state.weapons[key];
    if (!lvl || !state.grid) {
      pipeline.cleanup?.(state);
      continue;
    }
    runWeaponPipeline(state, dt, lvl, pipeline, key);
  }
}

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S4): drains
// state.pendingEmissions — Echo/Barrage's queued follow-up fires. Lives
// here rather than in systems/emissions.ts because it needs
// WEAPON_PIPELINES to invoke a weapon by key, and systems/emissions.ts
// importing that back would cycle through weapons/pipeline.ts (which
// already imports systems/emissions.ts to schedule these in the first
// place). Called once per frame from main.ts's update pass, never a
// draw call.
export function drainPendingEmissions(state: GameState): void {
  if (state.pendingEmissions.length === 0) return;
  const due: typeof state.pendingEmissions = [];
  const notYet: typeof state.pendingEmissions = [];
  for (const e of state.pendingEmissions) {
    (e.at <= state.time ? due : notYet).push(e);
  }
  state.pendingEmissions = notYet;
  for (const e of due) {
    if (!state.weapons[e.weapon]) continue; // can't currently happen mid-run (deck is fixed), kept as a safe no-op
    WEAPON_PIPELINES[e.weapon].deliver(state, e.lvl, e.target, e.powerMult);
  }
}
