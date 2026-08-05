// Global growth/simulation knobs. Keep these easy to find and change —
// they are not finalized (see Balance Notes in archive/PROTOTYPE_HANDOFF.md).
export const AMBIENT_BASE = 0.05;
export const CONTACT_SCALE = 15;
export const MAX_NODES = 5;

// Floor rate ambient growth creeps at inside the safe zone (damped
// further by proximity to the tower), and the floor the outside ramp
// itself never drops below near the line — see docs/DECISIONS.md #15. Chosen to roughly match the old front-line
// speed at the line itself; a balance-pass knob like AMBIENT_BASE.
export const CREEP_RAMP = 0.09;

// Fixed simulation timestep in seconds, decoupled from render framerate.
export const SIM_TICK = 0.18;
