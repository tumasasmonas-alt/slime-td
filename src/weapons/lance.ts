import type { GameState } from '../state';
import { clearAt } from '../grid/clear';
import { LANCE_COLOR } from '../render/beam';
import { extensionLevel } from '../systems/extensions';
import { scheduleEmission } from '../systems/emissions';
import { hasBounceGem, hasChainingGem, hasForkGem, hasRicochetGem, resolveOpts } from '../systems/resolveOpts';
import { bestCoagulant, highestMassPoint } from '../systems/targeting';
import { targetingAcquire } from '../systems/targetingGems';
import { weaponMods } from '../systems/weaponMods';
import { LANCE_LINGER, LANCE_LINGER_MULT, LANCE_RANGE, lanceBeamWidth, lanceChargeTime, lanceDamage } from '../tuning/weapons';
import type { ReadyFn, WeaponPipeline } from './pipeline';
import { runWeaponPipeline } from './pipeline';

const BEAM_FLASH_LIFE = 0.3;

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S6): Lance's four extensions.
const PIERCE_CAP: readonly [number, number, number] = [40, 60, 80];
const TWIN_POWER_SHARE: readonly [number, number, number] = [0.55, 0.7, 0.85];
const TWIN_ANGLE_OFFSET = 0.16; // radians
const AFTERGLOW_EXTRA: readonly [number, number, number] = [0.6, 1.1, 1.7];
const AFTERGLOW_REGROW_MULT = 0.4;
const AFTERGLOW_REGROW_SECONDS = 2.5;
const OVERCHARGE_TIME_MULT: readonly [number, number, number] = [0.45, 0.7, 1.0];
const OVERCHARGE_POWER_MULT: readonly [number, number, number] = [1.7, 2.1, 2.6];

// Phase 6D-3 (docs/plans/phase-6d3-gem-reality.md S4): Lance's beam
// reading for Fork/Chaining/Bounce/Ricochet.
// Fork reuses Twin Lance's own fireBeam helper — "splits into two
// diverging beams," at wider angles than Twin Lance's own offset so the
// two read as distinct if a build somehow carries both.
const FORK_ANGLE_OFFSET = 0.32;
const FORK_POWER_SHARE = 0.45;
// Chaining/Bounce both continue from the beam's own endpoint to a SECOND
// target, found the same way the aura-focus gems already pick a
// coagulant (systems/targeting.ts's bestCoagulant) — Chaining reads
// "continues... to a second target" as the next-biggest threat near the
// endpoint (extending the beam's own "hit what matters" identity);
// Bounce reads "reflects to a second target" as whatever's physically
// closest to where the beam stopped (a literal bounce off the nearest
// thing).
const CHAIN_SEARCH_RADIUS = 220;
const CHAIN_POWER_SHARE = 0.55;
const BOUNCE_SEARCH_RADIUS = 220;
const BOUNCE_POWER_SHARE = 0.55;
// Ricochet: "fires again along the same line at reduced power" is, on
// Lance specifically, textually identical to the beam's OWN native
// linger (S2.1, below) — which fires unconditionally, gem or not. Giving
// Ricochet the exact same behaviour would make it silently inert (the
// native linger already does it), so this grants a SECOND, independent
// extra pass along the same line instead — genuinely more total damage
// over the beam's lifetime when socketed, not a renamed freebie.
const RICOCHET_DELAY = 0.5;
const RICOCHET_POWER_MULT = 0.35;

// Phase 6C-2 (docs/plans/phase-6c2-lance.md S4.2, S5.2): NOT
// cooldownReady — Lance owns its own charge bookkeeping so the renderer
// can draw a live "who is it charging at" tell. Re-acquires its target
// EVERY tick while charging, not only at the moment it fires, so the
// target line jumps to a newly-formed bigger coagulant instead of lying
// about what's about to get hit.
//
// Phase 6D-1 (docs/plans/phase-6d1-targeting-gems.md S3): Lance's own
// targeting IS Threat Priority, built in — routed through the exact same
// targetingAcquire wrapper every other weapon uses, with highestMassPoint
// as its default, so socketing a different Targeting gem into Lance
// genuinely changes what it charges toward, and the two can never drift.
const lanceTargetAcquire = targetingAcquire('lance', () => LANCE_RANGE, (state) => highestMassPoint(state, LANCE_RANGE));

const lanceReady: ReadyFn = (state, dt, lvl) => {
  const grid = state.grid;
  if (!grid) return false;
  const mods = weaponMods(state, 'lance');
  const overchargeLvl = extensionLevel(state, 'lance', 'lanceOvercharge');
  const chargeTimeMult = overchargeLvl > 0 ? 1 + OVERCHARGE_TIME_MULT[overchargeLvl - 1]! : 1;
  const chargeTime = (lanceChargeTime(lvl) * chargeTimeMult) / mods.rate;
  const target = lanceTargetAcquire(state);
  const progress = (state.lanceCharge?.progress ?? 0) + dt;
  state.lanceCharge = { progress, chargeTime, target };
  if (progress < chargeTime) return false;
  state.lanceCharge.progress = 0;
  return true;
};

export const lancePipeline: WeaponPipeline = {
  ready: lanceReady,
  acquire: (state) => state.lanceCharge?.target ?? null,
  deliver: (state, lvl, target, powerMult = 1) => {
    if (!target) return;
    const grid = state.grid;
    if (!grid) return;
    const t = state.tower;
    const mods = weaponMods(state, 'lance');
    const opts = resolveOpts(state, 'lance');
    const beamWidth = lanceBeamWidth(lvl) * mods.area;

    const overchargeLvl = extensionLevel(state, 'lance', 'lanceOvercharge');
    const overchargePowerMult = overchargeLvl > 0 ? OVERCHARGE_POWER_MULT[overchargeLvl - 1]! : 1;
    const dmg = lanceDamage(lvl) * mods.damage * powerMult * overchargePowerMult;

    const pierceLvl = extensionLevel(state, 'lance', 'piercingCore');
    const armorIgnoreCap = pierceLvl > 0 ? PIERCE_CAP[pierceLvl - 1] : undefined;

    const afterglowLvl = extensionLevel(state, 'lance', 'afterglow');
    const suppressRegrowth = afterglowLvl > 0 ? { mult: AFTERGLOW_REGROW_MULT, seconds: AFTERGLOW_REGROW_SECONDS } : undefined;

    // Extends from the tower THROUGH the target and onward to max range —
    // "through," not "to," is what makes this a beam that pierces the
    // line rather than a large Bolt (phase-6c2-lance.md S4, S9's
    // defining test).
    const fireBeam = (angleOffset: number, power: number): void => {
      const angle = Math.atan2(target.y - t.y, target.x - t.x) + angleOffset;
      const toX = t.x + Math.cos(angle) * LANCE_RANGE;
      const toY = t.y + Math.sin(angle) * LANCE_RANGE;
      clearAt(state, t.x, t.y, power, {
        shape: { kind: 'capsule', toX, toY },
        radiusPx: beamWidth,
        armorIgnoreCap,
        suppressRegrowth,
        ...opts,
      });
      state.beamFx.push({ x: t.x, y: t.y, toX, toY, life: BEAM_FLASH_LIFE, maxLife: BEAM_FLASH_LIFE, color: LANCE_COLOR });
    };

    fireBeam(0, dmg);

    const twinLvl = extensionLevel(state, 'lance', 'twinLance');
    if (twinLvl > 0) fireBeam(TWIN_ANGLE_OFFSET, dmg * TWIN_POWER_SHARE[twinLvl - 1]!);

    // Fork: two diverging beams past the target, at FORK_ANGLE_OFFSET —
    // wider than Twin Lance's own offset so the two read as distinct.
    if (hasForkGem(state, 'lance')) {
      fireBeam(FORK_ANGLE_OFFSET, dmg * FORK_POWER_SHARE);
      fireBeam(-FORK_ANGLE_OFFSET, dmg * FORK_POWER_SHARE);
    }

    // Chaining/Bounce: a second beam from the endpoint to a target found
    // near it — see this file's own const comments above for the exact
    // selection criterion each uses.
    const endX = t.x + Math.cos(Math.atan2(target.y - t.y, target.x - t.x)) * LANCE_RANGE;
    const endY = t.y + Math.sin(Math.atan2(target.y - t.y, target.x - t.x)) * LANCE_RANGE;
    if (hasChainingGem(state, 'lance')) {
      const next = bestCoagulant(state, endX, endY, CHAIN_SEARCH_RADIUS, (a, b) => a.mass > b.mass);
      if (next) {
        const angle = Math.atan2(next.y - endX, next.x - endX);
        const toX = endX + Math.cos(angle) * LANCE_RANGE;
        const toY = endY + Math.sin(angle) * LANCE_RANGE;
        clearAt(state, endX, endY, dmg * CHAIN_POWER_SHARE, { shape: { kind: 'capsule', toX, toY }, radiusPx: beamWidth, armorIgnoreCap, ...opts });
        state.beamFx.push({ x: endX, y: endY, toX, toY, life: BEAM_FLASH_LIFE, maxLife: BEAM_FLASH_LIFE, color: LANCE_COLOR });
      }
    }
    if (hasBounceGem(state, 'lance')) {
      const nearest = bestCoagulant(state, endX, endY, BOUNCE_SEARCH_RADIUS, (a, b) => {
        const da = Math.hypot(a.x - endX, a.y - endY);
        const db = Math.hypot(b.x - endX, b.y - endY);
        return da < db;
      });
      if (nearest) {
        const angle = Math.atan2(nearest.y - endY, nearest.x - endX);
        const toX = endX + Math.cos(angle) * LANCE_RANGE;
        const toY = endY + Math.sin(angle) * LANCE_RANGE;
        clearAt(state, endX, endY, dmg * BOUNCE_POWER_SHARE, { shape: { kind: 'capsule', toX, toY }, radiusPx: beamWidth, armorIgnoreCap, ...opts });
        state.beamFx.push({ x: endX, y: endY, toX, toY, life: BEAM_FLASH_LIFE, maxLife: BEAM_FLASH_LIFE, color: LANCE_COLOR });
      }
    }

    // The beam's own base linger (S2.1) — resolves a second time at
    // reduced power after LANCE_LINGER seconds, independent of Afterglow
    // (which only makes the window longer). `powerMult === 1` guards
    // against the linger's own re-fire scheduling ANOTHER linger: this
    // deliver runs again later via scheduleEmission below, at
    // powerMult = LANCE_LINGER_MULT != 1, so it fails this check and
    // schedules nothing — the recursion terminates by construction, the
    // same discipline Chain Fission's fissionGen uses (phase-6c1 S9 risk
    // 2), applied here to a different mechanism.
    if (powerMult === 1) {
      const lingerDuration = (LANCE_LINGER + (afterglowLvl > 0 ? AFTERGLOW_EXTRA[afterglowLvl - 1]! : 0)) * mods.duration;
      scheduleEmission(state, 'lance', lingerDuration, lvl, target, LANCE_LINGER_MULT);

      // Ricochet: a SECOND, independent extra pass along the same line —
      // see this file's own comment above for why this can't just be the
      // native linger renamed. Same powerMult===1 guard, same reason.
      if (hasRicochetGem(state, 'lance')) {
        scheduleEmission(state, 'lance', RICOCHET_DELAY, lvl, target, RICOCHET_POWER_MULT);
      }
    }
  },
  // Phase 6A-2's cleanup hook — the one piece of "not equipped" state a
  // weapon needs reset, the same pattern Blades uses for its orbitals.
  // Without this, switching Lance out mid-run would leave a stale charge
  // bar/target line drawn for a weapon no longer in the deck.
  cleanup: (state) => {
    state.lanceCharge = null;
  },
};

export function updateLanceWeapon(state: GameState, dt: number): void {
  const lvl = state.weapons.lance;
  if (!lvl || !state.grid) {
    lancePipeline.cleanup?.(state);
    return;
  }
  runWeaponPipeline(state, dt, lvl, lancePipeline, 'lance');
}
