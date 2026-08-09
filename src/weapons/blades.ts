import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { gIdx, isRevealedIdx, worldToCell } from '../grid/grid';
import { findCoagulantHit } from '../systems/coagulants';
import { nearestFrontierPoint } from '../systems/frontier';
import { emissionPlan, hasHomingGem, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { WEAPON_DEFS, bladeCount, bladeDamage, bladeRadius } from '../tuning/weapons';
import { runWeaponPipeline, type WeaponPipeline } from './pipeline';

const SPIN_SPEED = 2.4;
const HIT_RADIUS = 16;
const HIT_COOLDOWN = 0.22;
const VISUAL_RADIUS = 10;
// Phase 5B-6: moved off render/orbitals.ts's old hardcoded constants,
// values unchanged (docs/DECISIONS.md #17 — ninja-star, not a plain dot).
const BLADE_COLOR = '#cfe8ff';
const BLADE_GLOW_COLOR = '#6df0ff';

// No targeting at all — blades circle the tower and damage whatever
// revealed tissue they sweep through, each on its own per-slot cooldown
// (state.bladeNextHit) so a blade can't hit the same patch every single
// frame. orbitRadius comes from bladeRadius(), which floors at the safe
// radius (docs/DECISIONS.md #16) so blades can never
// end up smaller than the zone they're meant to defend — see
// "documented prototype bugs" #5.
//
// Continuous rather than cooldown-gated — READY is always true when
// equipped; the per-slot hit cooldown that would elsewhere live in READY
// or ACQUIRE is intrinsic to DELIVER here, since it's per-blade, not
// per-weapon. Self-centered — no ACQUIRE stage.
export const bladesPipeline: WeaponPipeline = {
  ready: () => true,
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'blades');
    const opts = resolveOpts(state, 'blades');
    const plan = emissionPlan(state, 'blades');
    // Multishot's "+2 blades" reading — emissionPlan()'s count (1, or
    // 1+MULTISHOT_BONUS per Multishot/Formation gem socketed) minus its
    // own baseline of 1 gives how many *extra* blades to add on top of
    // bladeCount(lvl), rather than treating the whole ring as N separate
    // "shots."
    const extra = plan.count - 1;
    const count = bladeCount(lvl) + extra;
    const dmg = (bladeDamage(lvl) * mods.damage * powerMult) / (extra > 0 ? plan.count : 1);
    // Rate and Velocity read differently here than on every other
    // archetype (docs/plans/phase-6a1-gem-foundation.md's Overclock note):
    // orbital has no cooldown, so Overclock shrinks the per-blade re-hit
    // gate (attack frequency) instead, while Velocity — travel speed on
    // every other archetype — is genuinely the blade's own orbital speed.
    // Two gems both meaning "spin faster" would be a duplicate; keeping
    // them on separate axes is what avoids that.
    const spin = state.time * SPIN_SPEED * mods.velocity;
    const radius = bladeRadius(lvl, grid.perimeter) * mods.area;
    // Pierce: no per-blade hit cooldown — never stopped by what it cuts.
    // Reusing ignoreResistance as the signal (only Pierce ever sets it)
    // rather than adding a dedicated field just for this one archetype.
    const hitCooldown = opts.ignoreResistance ? 0 : HIT_COOLDOWN / mods.rate;

    // Homing: blades bias toward the threatened side of the arena.
    // Formation: instead of spreading evenly around the full circle,
    // blades lock into a narrow arc — centred on the threat if Homing is
    // also socketed, otherwise a fixed forward arc.
    let baseAngle = 0;
    if (hasHomingGem(state, 'blades') || plan.formation) {
      const threat = nearestFrontierPoint(state);
      if (threat) baseAngle = Math.atan2(threat.y - t.y, threat.x - t.x);
    }
    const arcSpan = plan.formation ? Math.PI * 0.6 : Math.PI * 2;
    const arcStart = plan.formation ? baseAngle - arcSpan / 2 : baseAngle;
    // Homing without Formation nudges the evenly-spread ring's phase
    // toward the threat rather than narrowing it into an arc — a lighter
    // touch than Formation's hard lock, matching the card's own
    // "biases toward" language rather than "locks to."
    const homingPhase = !plan.formation && hasHomingGem(state, 'blades') ? baseAngle : 0;

    state.orbitals = [];
    for (let i = 0; i < count; i++) {
      const a = plan.formation
        ? arcStart + (count <= 1 ? arcSpan / 2 : (i / (count - 1)) * arcSpan) + spin * 0.15
        : spin + homingPhase + (i / count) * Math.PI * 2;
      const bx = t.x + Math.cos(a) * radius;
      const by = t.y + Math.sin(a) * radius;
      state.orbitals.push({
        x: bx,
        y: by,
        radius: VISUAL_RADIUS,
        shape: 'shuriken',
        color: BLADE_COLOR,
        glowColor: BLADE_GLOW_COLOR,
      });

      const { cx, cy } = worldToCell(grid, bx, by);
      const ci = gIdx(grid, cx, cy);
      const nextAllowed = state.bladeNextHit[i] ?? 0;
      // Coagulants are entities, not grid cells — a blade sweeping
      // through already-cleared space still needs to connect with a
      // blob sitting there, which isRevealedIdx alone can't see.
      const onTarget = isRevealedIdx(grid, ci) || findCoagulantHit(state, bx, by, HIT_RADIUS) !== null;
      if (onTarget && state.time >= nextAllowed) {
        clearAt(state, bx, by, dmg, { radiusPx: HIT_RADIUS, coagulantMult: WEAPON_DEFS.blades?.coagulantMult ?? 1, ...opts });
        state.bladeNextHit[i] = state.time + hitCooldown;
      }
    }
  },
  // Phase 6A-2: declared on the pipeline itself so
  // weapons/registry.ts's generic updateAllWeapons() loop preserves this
  // without needing to know Blades is special.
  cleanup: (state) => {
    state.orbitals = [];
  },
};

// Takes `_dt` only to match the (state, dt) signature every other
// weapon update function uses — blades have no cooldown timer of their
// own, driven purely by state.time and the per-slot hit cooldown.
export function updateBladesWeapon(state: GameState, _dt: number): void {
  const lvl = state.weapons.blades;
  if (!lvl || !state.grid) {
    bladesPipeline.cleanup?.(state);
    return;
  }
  runWeaponPipeline(state, _dt, lvl, bladesPipeline, 'blades');
}
