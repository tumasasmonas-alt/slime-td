import { describe, expect, it } from 'vitest';
import { socketCount } from './sockets';

describe('socketCount', () => {
  it('matches the five named breakpoints exactly', () => {
    expect(socketCount(0)).toBe(1);
    expect(socketCount(3)).toBe(2);
    expect(socketCount(8)).toBe(3);
    expect(socketCount(15)).toBe(4);
    expect(socketCount(24)).toBe(5);
  });

  it('holds one below each breakpoint', () => {
    expect(socketCount(2)).toBe(1);
    expect(socketCount(7)).toBe(2);
    expect(socketCount(14)).toBe(3);
    expect(socketCount(23)).toBe(4);
  });

  it('never decreases as points invested rises', () => {
    let previous = 0;
    for (let points = 0; points <= 40; points++) {
      const count = socketCount(points);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('never drops below 1, at any input including negative', () => {
    expect(socketCount(0)).toBeGreaterThanOrEqual(1);
    expect(socketCount(-5)).toBeGreaterThanOrEqual(1);
  });

  it('holds past the top breakpoint — no cap on points invested (Decision 40: no cap)', () => {
    expect(socketCount(100)).toBe(5);
  });
});
