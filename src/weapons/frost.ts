import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { scheduleEmission } from '../systems/emissions';
import { extensionLevel } from '../systems/extensions';
import { nearestFrontierPoint } from '../systems/frontier';
import { emissionPlan, hasBounceGem, hasChainingGem, hasForkGem, hasHomingGem, hasRicochetGem, resolveOpts } from '../systems/resolveOpts';
import { auraTargetingReading } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { WEAPON_DEFS, frostCooldown, frostDamage, frostRadius } from '../tuning/weapons';
import { rand } from '../util/math';
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

// Phase 6B-2 (docs/plans/phase-6b2-extension-content.md S2-S4): Frost's
// four extensions. Chill Field extends the pulse's own freeze coverage
// with a longer standing duration at the nova's OWN radius (never a
// fraction of it — an inward reading would sit inside the perimeter
// floor and refreeze nothing, S1's outward-only rule); Shatter Core marks
// hit coagulants chilled and rewards it on any later hit; Rime suppresses
// regrowth after a freeze lapses; Freeze Duration (frostDuration) is pure
// `mods` and needs no code here.
const CHILL_FIELD_DURATION: readonly [number, number, number] = [0.4, 0.6, 0.8];
const SHATTER_CHILL_SECONDS = 2.5;
const SHATTER_DAMAGE_MULT: readonly [number, number, number] = [0.3, 0.45, 0.6];
const RIME_MULT: readonly [number, number, number] = [0.5, 0.35, 0.2];
const RIME_SECONDS = 3.0;

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Frost's pulse
// reading for Fork/Chaining/Bounce/Ricochet. Fork/Bounce fire immediately
// (no recursion risk — they never re-invoke deliver); Chaining reads
// `clearAt`'s own ClearResult (S3's whole reason for existing) to find
// the farthest coagulant the main pulse actually touched, rather than
// guessing a direction; Ricochet reuses the deferred-emission queue,
// guarded the same way Lance's own linger guards against re-scheduling
// itself.
const FORK_RADIUS_MULT = 0.45;
const FORK_POWER_SHARE = 0.5;
const CHAINING_RADIUS_MULT = 0.55;
const CHAINING_POWER_SHARE = 0.55;
const BOUNCE_OFFSET_FRACTION = 0.5;
const BOUNCE_RADIUS_MULT = 0.5;
const BOUNCE_POWER_SHARE = 0.5;
const RICOCHET_DELAY = 0.4;
const RICOCHET_POWER_MULT = 0.5;

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

    // Chill Field ADDS to the base freeze rather than taking a max with
    // it — the base is already 2.0s, well above any of Chill Field's own
    // 0.4-0.8s values, so a max() would make the extension a silent no-op
    // (caught while writing this weapon's own tests).
    const chillFieldLvl = extensionLevel(state, 'frost', 'chillField');
    const freezeDuration = FREEZE_DURATION * mods.duration + (chillFieldLvl > 0 ? CHILL_FIELD_DURATION[chillFieldLvl - 1]! : 0);
    const shatterLvl = extensionLevel(state, 'frost', 'shatterCore');
    const rimeLvl = extensionLevel(state, 'frost', 'rime');

    // Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Frost has no
    // ACQUIRE stage to replace, so a socketed Targeting gem reads instead
    // as either Vigilance's near-field cutout (an annulus shape) or a
    // focus-damage bonus on one coagulant within the pulse (Threat
    // Priority/Triage/Breach Priority/Fixation). Computed once against
    // the pulse's own origin (post-Homing-offset) and full radius, then
    // reused by every Multishot copy below — a shared focus target reads
    // as "all the pulses agree on what matters," not a per-copy re-roll.
    const auraReading = auraTargetingReading(state, 'frost', originX, originY, radius);

    // Phase 6D-3: Chaining reads every main pulse's own ClearResult to
    // find the farthest coagulant actually touched, rather than guessing
    // a direction — the whole reason clearAt's return grew a `touched`
    // list (S3).
    let farthest: { x: number; y: number } | null = null;
    let farthestDist = -1;

    for (let i = 0; i < plan.count; i++) {
      const angle = (i / plan.count) * Math.PI * 2;
      const spreadDist = plan.count > 1 ? radius * MULTISHOT_OFFSET_FRACTION : 0;
      const x = originX + Math.cos(angle) * spreadDist;
      const y = originY + Math.sin(angle) * spreadDist;
      const result = clearAt(state, x, y, perDmg, {
        radiusPx: perRadius,
        freezeDuration,
        coagulantMult,
        chill: shatterLvl > 0 ? SHATTER_CHILL_SECONDS : undefined,
        shatter: shatterLvl > 0 ? SHATTER_DAMAGE_MULT[shatterLvl - 1] : undefined,
        suppressRegrowth: rimeLvl > 0 ? { mult: RIME_MULT[rimeLvl - 1]!, seconds: RIME_SECONDS } : undefined,
        shape: auraReading.shape,
        focusTarget: auraReading.focusTarget,
        focusBonus: auraReading.focusBonus,
        ...opts,
      });
      for (const c of result.touched) {
        const d = Math.hypot(c.x - originX, c.y - originY);
        if (d > farthestDist) {
          farthestDist = d;
          farthest = { x: c.x, y: c.y };
        }
      }
      // Phase 5B-6: pushed onto a list now, not assigned to a single slot —
      // a second pulse weapon firing the same frame no longer overwrites
      // this one. See docs/plans/phase-5b-framework.md S6a.
      state.novaFx.push({ x, y, radius: perRadius, life: FX_LIFE, maxLife: FX_LIFE, color: FX_COLOR });
    }

    // Fork: a second, smaller pulse at the main pulse's own rim, a
    // random angle — "spawns a second smaller pulse at its rim."
    if (hasForkGem(state, 'frost')) {
      const forkAngle = rand(0, Math.PI * 2);
      const fx = originX + Math.cos(forkAngle) * radius;
      const fy = originY + Math.sin(forkAngle) * radius;
      clearAt(state, fx, fy, perDmg * FORK_POWER_SHARE, { radiusPx: perRadius * FORK_RADIUS_MULT, freezeDuration, coagulantMult, ...opts });
      state.novaFx.push({ x: fx, y: fy, radius: perRadius * FORK_RADIUS_MULT, life: FX_LIFE, maxLife: FX_LIFE, color: FX_COLOR });
    }

    // Chaining: a follow-up pulse centred on the farthest point the main
    // pulse(s) actually touched. No touch this cast — no follow-up; this
    // is a bonus on a connecting hit, not its own guaranteed emission.
    if (hasChainingGem(state, 'frost') && farthest) {
      clearAt(state, farthest.x, farthest.y, perDmg * CHAINING_POWER_SHARE, {
        radiusPx: perRadius * CHAINING_RADIUS_MULT,
        freezeDuration,
        coagulantMult,
        ...opts,
      });
      state.novaFx.push({ x: farthest.x, y: farthest.y, radius: perRadius * CHAINING_RADIUS_MULT, life: FX_LIFE, maxLife: FX_LIFE, color: FX_COLOR });
    }

    // Bounce: re-emits a smaller pulse offset from centre, toward the
    // nearest touched coagulant if one connected, otherwise a random
    // direction — distinct from Fork (always at the rim) and Chaining
    // (always the farthest hit).
    if (hasBounceGem(state, 'frost')) {
      let bounceAngle = rand(0, Math.PI * 2);
      if (farthest) bounceAngle = Math.atan2(farthest.y - originY, farthest.x - originX);
      const offset = radius * BOUNCE_OFFSET_FRACTION;
      const bx = originX + Math.cos(bounceAngle) * offset;
      const by = originY + Math.sin(bounceAngle) * offset;
      clearAt(state, bx, by, perDmg * BOUNCE_POWER_SHARE, { radiusPx: perRadius * BOUNCE_RADIUS_MULT, freezeDuration, coagulantMult, ...opts });
      state.novaFx.push({ x: bx, y: by, radius: perRadius * BOUNCE_RADIUS_MULT, life: FX_LIFE, maxLife: FX_LIFE, color: FX_COLOR });
    }

    // Ricochet: a delayed second pass at the same origin, reduced power —
    // reuses the deferred-emission queue, guarded by `powerMult === 1`
    // the same way Lance's own linger guards against re-scheduling
    // itself (a re-invoked deliver always carries powerMult != 1).
    if (powerMult === 1 && hasRicochetGem(state, 'frost')) {
      scheduleEmission(state, 'frost', RICOCHET_DELAY, lvl, null, RICOCHET_POWER_MULT);
    }
  },
};

export function updateFrostWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.frost;
  if (!lvl || !state.grid) return;
  runWeaponPipeline(state, dt, lvl, frostPipeline, 'frost');
}
