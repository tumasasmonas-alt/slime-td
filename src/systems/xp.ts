import type { GameState } from '../state';
import { xpToNext } from '../tuning/xp';
import { xpMult } from './passives';

// Loops through however many levels a single XP grant crosses, but only
// *counts* them in pendingLevelUps — the UI layer (ui/upgradeCards.ts)
// consumes one card per pending level-up. The prototype instead rebuilt
// the upgrade overlay inline on every crossing, so a grant crossing two
// thresholds at once silently overwrote the first card with the second.
// Fixed at port time — see docs/BACKLOG.md.
export function grantXp(state: GameState, amount: number): void {
  const tower = state.tower;
  tower.xp += amount * xpMult(state);
  while (tower.xp >= tower.xpToNext) {
    tower.xp -= tower.xpToNext;
    tower.level += 1;
    tower.xpToNext = xpToNext(tower.level);
    state.pendingLevelUps += 1;
    // Phase 5B (docs/plans/phase-5b-framework.md S3): one point per
    // level, banked rather than auto-spent until 5C's +/- control ships.
    // Decision 40's "one point every level, not every other."
    state.enhancementPool += 1;
  }
}
