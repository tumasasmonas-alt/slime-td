// Fixed play-area size in world units. Every player gets this exact arena
// regardless of window size or monitor — the camera (src/core/camera.ts)
// fits it to the viewport rather than the simulation adapting to the
// window. See docs/KNOWN_ISSUES.md "Resolved" section for why.
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;

export const CELL_SIZE = 13;

// The farthest a growth cell or node can meaningfully exist from the core,
// with a small margin past the corner. Purely a function of world size.
export const WORLD_MAX_RANGE = Math.hypot(WORLD_WIDTH / 2, WORLD_HEIGHT / 2) + 50;
