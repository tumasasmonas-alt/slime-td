import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { nearestFrontierPoint } from '../systems/frontier';
import { emissionPlan, hasHomingGem, resolveOpts } from '../systems/resolveOpts';
import { weaponMods } from '../systems/weaponMods';
import { WEAPON_DEFS, frostCooldown, frostDamage, frostRadius } from '../tuning/weapons';
import { cooldownReady, runWeaponPipeline, type WeaponPipeline } from './pipeline';

const FREEZE_DURATION = 2.0;
const FX_LIFE = 0.4;
// Phase 5B-6: moved off render/novaFx.ts's old hardcoded constant, value
// unchanged.
const FX_COLOR = '#bfe9ff';
// Phase 6A-2: how far Homing offsets the pulse's centre toward the
// nearest threat, and how far Multishot's extra pulses land from that
// centre — both as a fraction of the pulse's own radius, so they scale
// with level/Expansion rather than needing their own tuning knob.
const HOMING_OFFSET_FRACTION = 0.3;
const MULTISHOT_OFFSET_FRACTION = 0.35;

// Untargeted — pulses outward from the tower on a cooldown, damaging and
// freezing growth in radius. The freeze mechanic itself (clearAt's
// freezeDuration, respected by applyAmbientGrowth) already landed in 2D;
// this is what actually fires it. Radius floors at the safe radius
// (Confirmed decision 16). Self-centered — no ACQUIRE stage; the target
// is always the tower.
export const frostPipeline: WeaponPipeline = {
  ready: cooldownReady('frost', frostCooldown),
  deliver: (state, lvl, _target, powerMult = 1) => {
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'frost');
    const radius = frostRadius(lvl, grid.perimeter) * mods.area;
    const opts = resolveOpts(state, 'frost');
    const plan = emissionPlan(state, 'frost');
    const coagulantMult = WEAPON_DEFS.frost?.coagulantMult ?? 1;

    // Homing: the whole pulse (or formation of pulses) centres itself
    // toward the nearest threat instead of sitting exactly on the tower.
    let originX = t.x;
    let originY = t.y;
    if (hasHomingGem(state, 'frost')) {
      const threat = nearestFrontierPoint(state);
      if (threat) {
        const a = Math.atan2(threat.y - t.y, threat.x - t.x);
        const offset = radius * HOMING_OFFSET_FRACTION;
        originX += Math.cos(a) * offset;
        originY += Math.sin(a) * offset;
      }
    }

    const perDmg = (frostDamage(lvl) * mods.damage * powerMult) / plan.count;
    const perRadius = plan.count > 1 ? radius / 1.6 : radius;
    for (let i = 0; i < plan.count; i++) {
      const angle = (i / plan.count) * Math.PI * 2;
      const spreadDist = plan.count > 1 ? radius * MULTISHOT_OFFSET_FRACTION : 0;
      const x = originX + Math.cos(angle) * spreadDist;
      const y = originY + Math.sin(angle) * spreadDist;
      clearAt(state, x, y, perDmg, {
        radiusPx: perRadius,
        freezeDuration: FREEZE_DURATION * mods.duration,
        coagulantMult,
        ...opts,
      });
      // Phase 5B-6: pushed onto a list now, not assigned to a single slot —
      // a second pulse weapon firing the same frame no longer overwrites
      // this one. See docs/plans/phase-5b-framework.md S6a.
      state.novaFx.push({ x, y, radius: perRadius, life: FX_LIFE, maxLife: FX_LIFE, color: FX_COLOR });
    }
  },
};

export function updateFrostWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.frost;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, frostPipeline, 'frost');
}
