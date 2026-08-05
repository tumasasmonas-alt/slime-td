import type { GameState } from '../state';
import { armorMult } from './passives';

const MAX_SHAKE = 14;
const SHAKE_PER_DAMAGE = 0.6;
const SHAKE_DECAY = 30;
const REGEN_PER_LEVEL = 0.3;

// Applies Armor Plating's reduction and clamps hp at 0 rather than ending
// the run directly — game-over is a run-lifecycle concern main.ts polls
// for (`state.tower.hp <= 0`), not something a systems/ module should
// reach into the DOM to trigger. See ui/overlays.ts.
export function damageTower(state: GameState, amount: number, skipShake = false): void {
  const t = state.tower;
  const dmg = amount * armorMult(state);
  t.hp = Math.max(0, t.hp - dmg);
  if (!skipShake) t.shake = Math.min(MAX_SHAKE, t.shake + dmg * SHAKE_PER_DAMAGE);
}

export function updateTowerTick(state: GameState, dt: number): void {
  const t = state.tower;
  const regenLvl = state.passives.regen ?? 0;
  if (regenLvl) {
    t.hp = Math.min(t.maxHp, t.hp + REGEN_PER_LEVEL * regenLvl * dt);
  }
  t.shake = Math.max(0, t.shake - dt * SHAKE_DECAY);
}
