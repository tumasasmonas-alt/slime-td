// Fixed play-area size in world units. Every player gets this exact arena
// regardless of window size or monitor — the camera (src/core/camera.ts)
// fits it to the viewport rather than the simulation adapting to the
// window. See docs/BACKLOG.md "Resolved" section for why.
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;

export const CELL_SIZE = 13;

// The farthest a growth cell can meaningfully exist from the core, with a
// small margin past the corner. Purely a function of world size.
export const WORLD_MAX_RANGE = Math.hypot(WORLD_WIDTH / 2, WORLD_HEIGHT / 2) + 50;

// The breach threshold — cross it and the core starts taking contact
// damage. Used to shrink 100 -> 45 across five difficulty tiers; now
// fixed, since Decision 33 strips TIERS_LIST of mechanical weight and
// Decision 38 explicitly defers a replacement driver to Phase 8. Its job
// in the new model is much smaller than before: the line where breach
// splatter starts bleeding the core, not the primary difficulty lever.
export const PERIMETER = 90;
