import type { GameState } from '../state';
import { TIERS_LIST } from '../tuning/tiers';
import { WEAPON_DEFS } from '../tuning/weapons';
import type { WeaponKey } from '../types';
import { clamp, fmtTime } from '../util/math';
import { armorMult, atkSpeedMult, damageMult, pickupMult, xpMult } from '../systems/passives';

const ANNOUNCE_DURATION = 2.6;

export interface HudRefs {
  hpFill: HTMLElement;
  xpFill: HTMLElement;
  levelBadge: HTMLElement;
  statTime: HTMLElement;
  statKills: HTMLElement;
  statWave: HTMLElement;
  difficultyName: HTMLElement;
  diffBarFill: HTMLElement;
  weaponTray: HTMLElement;
  announce: HTMLElement;
  modifiers: HTMLElement;
}

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

export function initHud(): HudRefs {
  return {
    hpFill: requireEl('hp-fill'),
    xpFill: requireEl('xp-fill'),
    levelBadge: requireEl('level-badge'),
    statTime: requireEl('stat-time'),
    statKills: requireEl('stat-kills'),
    statWave: requireEl('stat-wave'),
    difficultyName: requireEl('difficulty-name'),
    diffBarFill: requireEl('diff-bar-fill'),
    weaponTray: requireEl('weapon-tray'),
    announce: requireEl('announce'),
    modifiers: requireEl('modifiers'),
  };
}

export function updateHud(refs: HudRefs, state: GameState): void {
  const t = state.tower;
  refs.hpFill.style.width = `${clamp((t.hp / t.maxHp) * 100, 0, 100)}%`;
  refs.xpFill.style.width = `${clamp((t.xp / t.xpToNext) * 100, 0, 100)}%`;
  refs.levelBadge.textContent = String(t.level);
  refs.statTime.textContent = fmtTime(state.time);
  refs.statKills.textContent = String(state.nodesPurged);
  refs.statWave.textContent = String(state.tierIndex + 1);
  updateDifficultyHud(refs, state);
  updateWeaponTray(refs, state);
  updateModifiers(refs, state);

  // Only pop the next queued announcement once the current one has fully
  // displayed — popping unconditionally would let a same-tick collision
  // (e.g. a tier escalation and a node spawn) flash through both within a
  // single frame instead of each getting its full ANNOUNCE_DURATION.
  if (state.announceTimer <= 0 && state.pendingAnnouncements.length > 0) {
    announce(refs, state, state.pendingAnnouncements.shift()!);
  }
}

function updateDifficultyHud(refs: HudRefs, state: GameState): void {
  const tier = TIERS_LIST[state.tierIndex];
  if (!tier) return;
  refs.difficultyName.textContent = tier.name.toUpperCase();
  refs.difficultyName.style.color = tier.color;
  refs.diffBarFill.style.background = tier.color;
  const next = TIERS_LIST[state.tierIndex + 1];
  refs.diffBarFill.style.width = next
    ? `${clamp(((state.time - tier.t) / (next.t - tier.t)) * 100, 0, 100)}%`
    : '100%';
}

function updateWeaponTray(refs: HudRefs, state: GameState): void {
  refs.weaponTray.innerHTML = '';
  for (const key of Object.keys(state.weapons) as WeaponKey[]) {
    const lvl = state.weapons[key];
    if (!lvl) continue;
    const def = WEAPON_DEFS[key];
    if (!def) continue;
    const chip = document.createElement('div');
    chip.className = 'weapon-chip';
    chip.innerHTML = `${def.icon}<span class="lvl">${lvl}</span>`;
    refs.weaponTray.appendChild(chip);
  }
}

// Always-visible readout of the four multiplier passives plus armor, so a
// pick's effect is confirmable the instant it's made rather than only
// inferable from play — see docs/KNOWN_ISSUES.md "Upgrade cards give no
// visible confirmation of what they changed".
function updateModifiers(refs: HudRefs, state: GameState): void {
  const dmg = damageMult(state);
  const spd = atkSpeedMult(state);
  const pick = pickupMult(state);
  const xp = xpMult(state);
  const armorPct = Math.round((1 - armorMult(state)) * 100);
  refs.modifiers.textContent =
    `DMG ${dmg.toFixed(2)}x   SPD ${spd.toFixed(2)}x   ARMOR ${armorPct}%   ` +
    `PICKUP ${pick.toFixed(2)}x   XP ${xp.toFixed(2)}x`;
}

function announce(refs: HudRefs, state: GameState, msg: string): void {
  refs.announce.textContent = msg;
  refs.announce.classList.add('show');
  state.announceTimer = ANNOUNCE_DURATION;
}

export function updateAnnounceFade(refs: HudRefs, state: GameState, dt: number): void {
  if (state.announceTimer > 0) {
    state.announceTimer -= dt;
    if (state.announceTimer <= 0) refs.announce.classList.remove('show');
  }
}
