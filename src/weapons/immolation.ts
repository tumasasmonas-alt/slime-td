import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { IMMOLATION_RING_COLOR } from '../render/immolationRing';
import { extensionLevel } from '../systems/extensions';
import { resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { IMMOLATION_TICK, WEAPON_DEFS, immolationDamage, immolationRadius } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

// Phase 6A-1: a brief brighter flash on top of the persistent ring
// (render/immolationRing.ts) each time it actually ticks — matching
// Frost Nova's novaFx pattern, the confirmation-on-fire half of the
// weapon's now-complete visual.
const FLASH_LIFE = 0.35;

// Phase 5A (Decision 70): promoted from systems/ward.ts's Ward Pulse,
// which was a weapon misfiled as a passive since the port — a cooldown
// and a tower-centered radius, exactly Frost Nova's and Blades' shape,
// gated behind state.passives.ward instead of state.weapons like every
// other thing with those properties. That misclassification is also why
// it never got a visual (Decision 11's "a weapon's signature visual is
// part of the weapon" never applied to something classed as a passive)
// and why its clearAt call never passed coagulantMult. Phase 6B-1 closed
// the last balance gap (immolationDamage now carries WEAPON_DAMAGE_SCALE
// — tuning/weapons.ts).

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S5): Immolation's
// four extensions. Second Ring is a second concentric ring OUTWARD at
// 1.4x radius (S1 — every tower-centred radius floors at `perimeter`, so
// an inward second ring would sweep the safe zone and hit nothing) rather
// than being folded into the main clearAt call, so its own power fraction
// stays independently tunable. Flare is a periodic bonus pulse, using
// Overcharge's own state.weaponShots counter (this weapon's own tick
// count, not a second one). Backdraft samples how much mass is currently
// crossing the ring before the main hit. Ash suppresses regrowth on
// whatever the ring just burned.
const SECOND_RING_MULT = 1.4;
const SECOND_RING_POWER: readonly [number, number, number] = [0.6, 0.75, 0.9];
const FLARE_EVERY = 4;
const FLARE_RADIUS_MULT = 1.8;
const FLARE_POWER: readonly [number, number, number] = [0.7, 0.85, 1.0];
const BACKDRAFT_SCALE: readonly [number, number, number] = [0.3, 0.45, 0.6];
const ASH_MULT: readonly [number, number, number] = [0.6, 0.45, 0.3];
const ASH_SECONDS = 2.0;

// Self-centered — no ACQUIRE stage, the target is always the tower.
// Phase 6A-1: now built on the shared cooldownReady() helper like every
// other cooldown weapon — see tuning/weapons.ts's IMMOLATION_TICK comment
// for why this closes 2 of the weapon's 3 open balance gaps.
//
// Phase 6A-2: RESOLVE options (Splash/Overflow/Kickback/Priming/Pierce)
// are wired — they only affect the damage math, not where or how large
// the ring is. Homing and Multishot/Formation are deliberately NOT wired
// here: both would move or multiply the ring's centre, which would
// desync render/immolationRing.ts's persistent visual (drawn once, at
// the tower, from state.weapons/state.grid directly) from where the
// damage actually lands — a correctness risk against a visual this
// session specifically shipped to fix a standing BACKLOG item. Left as a
// real, disclosed gap rather than risking that regression; revisit once
// the ring's render reads a shared origin instead of assuming the tower.
// Backdraft: a cheap proxy for "how much mass is currently crossing the
// ring" — average grid density sampled at points around the ring's own
// circumference, rather than a real flux measurement (which would need
// tracking cells crossing between ticks). Good enough to reward firing
// into a busy ring without adding a new per-cell tracked quantity.
const BACKDRAFT_SAMPLES = 8;
function sampleRingDensity(grid: NonNullable<GameState['grid']>, cx: number, cy: number, radius: number): number {
  let total = 0;
  for (let k = 0; k < BACKDRAFT_SAMPLES; k++) {
    const a = (k / BACKDRAFT_SAMPLES) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    const gx = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cellSize)));
    const gy = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellSize)));
    total += grid.growth[gy * grid.cols + gx] ?? 0;
  }
  return total / BACKDRAFT_SAMPLES;
}

export const immolationPipeline: WeaponPipeline = {
  ready: cooldownReady('immolation', () => IMMOLATION_TICK),
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'immolation');
    const radius = immolationRadius(lvl, grid.perimeter) * mods.area;
    const opts = resolveOpts(state, 'immolation');

    const backdraftLvl = extensionLevel(state, 'immolation', 'backdraft');
    const backdraftMult = backdraftLvl > 0 ? 1 + BACKDRAFT_SCALE[backdraftLvl - 1]! * sampleRingDensity(grid, t.x, t.y, radius) : 1;
    const ashLvl = extensionLevel(state, 'immolation', 'ash');

    clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * backdraftMult, {
      radiusPx: radius,
      coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
      suppressRegrowth: ashLvl > 0 ? { mult: ASH_MULT[ashLvl - 1]!, seconds: ASH_SECONDS } : undefined,
      ...opts,
    });
    state.novaFx.push({ x: t.x, y: t.y, radius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });

    // Second Ring: a second concentric ring OUTWARD at SECOND_RING_MULT —
    // see S1's outward-only rule; an inward ring sits inside the safe
    // zone and hits nothing.
    const secondRingLvl = extensionLevel(state, 'immolation', 'secondRing');
    if (secondRingLvl > 0) {
      const outerRadius = radius * SECOND_RING_MULT;
      clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * SECOND_RING_POWER[secondRingLvl - 1]!, {
        radiusPx: outerRadius,
        coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
        suppressRegrowth: ashLvl > 0 ? { mult: ASH_MULT[ashLvl - 1]!, seconds: ASH_SECONDS } : undefined,
        ...opts,
      });
      state.novaFx.push({ x: t.x, y: t.y, radius: outerRadius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });
    }

    // Flare: every FLARE_EVERY ticks, an extra outward pulse at
    // FLARE_RADIUS_MULT — this weapon's own emission counter, the same
    // Overcharge (Bolt) reads for its own every-5th-shot bonus, keyed by
    // weapon so the two never collide.
    const flareLvl = extensionLevel(state, 'immolation', 'flare');
    if (flareLvl > 0) {
      const ticks = (state.weaponShots.immolation ?? 0) + 1;
      state.weaponShots.immolation = ticks;
      if (ticks % FLARE_EVERY === 0) {
        const flareRadius = radius * FLARE_RADIUS_MULT;
        clearAt(state, t.x, t.y, immolationDamage(lvl) * mods.damage * powerMult * FLARE_POWER[flareLvl - 1]!, {
          radiusPx: flareRadius,
          coagulantMult: WEAPON_DEFS.immolation?.coagulantMult ?? 1,
          ...opts,
        });
        state.novaFx.push({ x: t.x, y: t.y, radius: flareRadius, life: FLASH_LIFE, maxLife: FLASH_LIFE, color: IMMOLATION_RING_COLOR });
      }
    }
  },
};

export function updateImmolationWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.immolation;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, immolationPipeline, 'immolation');
}
