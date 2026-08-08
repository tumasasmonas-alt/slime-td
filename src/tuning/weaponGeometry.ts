// Reach for weapons whose radius is centered on the (stationary) tower:
// Orbiting Blades, Frost Nova, Immolation Ring.
//
// Density is always lowest right around the tower — ambient growth
// creeps in there at a heavily damped rate (see docs/DECISIONS.md #15), so a tower-centered radius smaller than
// perimeter is aimed mostly at near-empty space. The prototype used
// flat constants and Orbiting Blades (64-78px) ended up smaller than
// even the tightest safe radius it ever reached under the *old*
// hard-gated model — the weapon could not touch ambient infection at any
// tier or level, in any run. This helper makes that class of bug
// unrepresentable.
//
// The anchor is a FLOOR, not a lock. Reach is the larger of:
//   - `perimeter + margin`  — guarantees the weapon always at least
//     reaches the infection boundary, at any tier, however the tier
//     table is later retuned;
//   - `base + perLevel * (lvl - 1)`  — lets levels (and, later, explicit
//     range-upgrade paths) push reach well past that boundary.
//
// Keeping both terms independently tunable is deliberate: collapsing to
// pure-anchored or pure-absolute behavior later is a one-line change, so
// this doesn't corner the upgrade design. See docs/DECISIONS.md.
//
// NOTE: `clearAt` scales its radius by `clamp(1.25 - density, 0.4, 1.25)`
// sampled at the hit center. Density right at the tower stays very low
// (proximity damping bottoms out at the tower's own radius), so
// tower-centered hits still land close to the automatic 1.25x — just
// not exactly, now that the tower's surroundings aren't guaranteed
// literally zero.
export interface TowerCenteredReach {
  readonly margin: number;
  readonly base: number;
  readonly perLevel: number;
}

export function towerCenteredRadius(spec: TowerCenteredReach, lvl: number, perimeter: number): number {
  return Math.max(spec.margin + perimeter, spec.base + spec.perLevel * (lvl - 1));
}
