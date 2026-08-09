import type { GameState } from '../state';
import { isBehaviourGem } from '../tuning/gems';
import type { WeaponKey } from '../types';
import type { FrontierPoint } from './frontier';

// Phase 6A-2 (docs/plans/phase-6a2-behaviour-gems.md S4): Echo and
// Barrage both need a weapon's `deliver` to run later than the tick that
// decided to fire — nothing in the pre-6A-2 codebase could do that.
// state.pendingEmissions is the queue; weapons/registry.ts drains it
// (it already holds WEAPON_PIPELINES, needed to invoke a weapon by key,
// and importing that here would cycle back through weapons/pipeline.ts).

const ECHO_DELAY = 0.25;
const ECHO_POWER_MULT = 0.5;
const BARRAGE_COUNT = 4;
const BARRAGE_SPACING = 0.08;
const BARRAGE_POWER_SHARE = 1 / BARRAGE_COUNT;

// Guards the Multishot x Barrage x Echo combinatorial stack — the 3C
// gate already lost a playtest to an unbounded-cost interaction once
// (Decisions 58-59). A per-weapon cap on outstanding queued emissions,
// not a global one, so a Barrage-heavy build doesn't starve every other
// weapon's Echo. First-draft number, expected to move once someone
// actually stacks Multishot on a 0.16s-cooldown Bolt and watches frame
// time — see docs/plans/phase-6a2-behaviour-gems.md S5.
const MAX_QUEUED_PER_WEAPON = 16;

export function scheduleEmission(
  state: GameState,
  weapon: WeaponKey,
  delay: number,
  lvl: number,
  target: FrontierPoint | null,
  powerMult: number,
): void {
  const queuedForThisWeapon = state.pendingEmissions.reduce((n, e) => n + (e.weapon === weapon ? 1 : 0), 0);
  if (queuedForThisWeapon >= MAX_QUEUED_PER_WEAPON) return;
  state.pendingEmissions.push({ weapon, at: state.time + delay, lvl, target, powerMult });
}

// Called once from weapons/pipeline.ts's runWeaponPipeline, immediately
// after a normal fire succeeds. Echo and Barrage both read as "this
// fire also queues more fire," which is why they're decided together
// here rather than each getting their own call site.
export function maybeScheduleEchoBarrage(state: GameState, weapon: WeaponKey, lvl: number, target: FrontierPoint | null): void {
  const sockets = state.weaponSockets[weapon];
  if (!sockets || sockets.gems.length === 0) return;

  for (const gem of sockets.gems) {
    if (!isBehaviourGem(gem.kind)) continue;
    if (gem.kind === 'echo') {
      scheduleEmission(state, weapon, ECHO_DELAY, lvl, target, ECHO_POWER_MULT);
    } else if (gem.kind === 'barrage') {
      for (let i = 1; i <= BARRAGE_COUNT; i++) {
        scheduleEmission(state, weapon, BARRAGE_SPACING * i, lvl, target, BARRAGE_POWER_SHARE);
      }
    }
  }
}
