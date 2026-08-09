import { describe, expect, it } from 'vitest';
import { freshState } from '../state';
import { maybeScheduleEchoBarrage, scheduleEmission } from './emissions';

describe('scheduleEmission', () => {
  it('pushes an entry due at state.time + delay', () => {
    const state = freshState();
    state.time = 10;
    scheduleEmission(state, 'bolt', 0.5, 3, null, 1);
    expect(state.pendingEmissions).toHaveLength(1);
    expect(state.pendingEmissions[0]!.at).toBeCloseTo(10.5, 5);
    expect(state.pendingEmissions[0]!.lvl).toBe(3);
  });

  it('caps outstanding queued emissions per weapon', () => {
    const state = freshState();
    for (let i = 0; i < 30; i++) scheduleEmission(state, 'bolt', 1, 1, null, 1);
    expect(state.pendingEmissions.length).toBeLessThan(30);
  });

  it('a cap on one weapon does not affect another', () => {
    const state = freshState();
    for (let i = 0; i < 30; i++) scheduleEmission(state, 'bolt', 1, 1, null, 1);
    const before = state.pendingEmissions.length;
    scheduleEmission(state, 'chain', 1, 1, null, 1);
    expect(state.pendingEmissions.length).toBe(before + 1);
  });
});

describe('maybeScheduleEchoBarrage', () => {
  it('schedules nothing with no gems socketed', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    maybeScheduleEchoBarrage(state, 'bolt', 1, null);
    expect(state.pendingEmissions).toHaveLength(0);
  });

  it('echo schedules exactly one follow-up', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'echo' }] };
    maybeScheduleEchoBarrage(state, 'bolt', 1, null);
    expect(state.pendingEmissions).toHaveLength(1);
    expect(state.pendingEmissions[0]!.powerMult).toBeLessThan(1); // reduced power
  });

  it('barrage schedules several follow-ups, each at a fraction of power', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'barrage' }] };
    maybeScheduleEchoBarrage(state, 'bolt', 1, null);
    expect(state.pendingEmissions.length).toBeGreaterThan(1);
    const totalPower = state.pendingEmissions.reduce((sum, e) => sum + e.powerMult, 0);
    // Barrage's whole point is redistributing one shot's power into many
    // small ones, not creating power from nothing.
    expect(totalPower).toBeCloseTo(1, 5);
  });

  it('echo and barrage both socketed schedules both', () => {
    const state = freshState();
    state.weapons.bolt = 5; // room for two sockets
    state.weaponSockets.bolt = {
      extensions: [],
      gems: [
        { id: 1, kind: 'echo' },
        { id: 2, kind: 'barrage' },
      ],
    };
    maybeScheduleEchoBarrage(state, 'bolt', 1, null);
    expect(state.pendingEmissions.length).toBeGreaterThan(1);
  });

  it('preserves the target point given at schedule time', () => {
    const state = freshState();
    state.weapons.bolt = 1;
    state.weaponSockets.bolt = { extensions: [], gems: [{ id: 1, kind: 'echo' }] };
    const target = { x: 123, y: 456, dist: 10 };
    maybeScheduleEchoBarrage(state, 'bolt', 1, target);
    expect(state.pendingEmissions[0]!.target).toEqual(target);
  });
});
