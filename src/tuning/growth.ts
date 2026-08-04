// Global growth/simulation knobs. Keep these easy to find and change —
// they are not finalized (see Balance Notes in docs/PROTOTYPE_HANDOFF.md).
export const AMBIENT_BASE = 0.05;
export const CONTACT_SCALE = 15;
export const MAX_NODES = 5;

// Fixed simulation timestep in seconds, decoupled from render framerate.
export const SIM_TICK = 0.18;
