import { clamp } from '../util/math';

// Deliberately close to linear so the ~8-tier weapon progression paces out
// across most of a run instead of front- or back-loading. See Balance
// Notes in archive/PROTOTYPE_HANDOFF.md.
export function xpToNext(level: number): number {
  return Math.round(12 + level * 6.5);
}

// Gems drop when a single hit clears enough density; value scales with how
// much was actually removed.
export function gemValueFromRemoved(removed: number): number {
  return clamp(Math.round(removed * 1.3), 0, 10);
}
