import { describe, expect, it } from 'vitest';
import { fitCamera, screenToWorld, worldToScreen } from './camera';
import { worldPoint } from './coords';

describe('fitCamera', () => {
  it('is 1:1 with no letterboxing at exactly the world resolution', () => {
    const cam = fitCamera(1920, 1080);
    expect(cam.scale).toBe(1);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('scales up uniformly on a 4K screen with no letterboxing', () => {
    const cam = fitCamera(3840, 2160);
    expect(cam.scale).toBe(2);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(0);
  });

  it('pillarboxes an ultrawide window instead of showing extra world', () => {
    const cam = fitCamera(2560, 1080);
    expect(cam.scale).toBe(1);
    expect(cam.offsetX).toBe(320);
    expect(cam.offsetY).toBe(0);
  });

  it('letterboxes a taller-than-16:9 window', () => {
    const cam = fitCamera(1920, 1200);
    expect(cam.scale).toBe(1);
    expect(cam.offsetX).toBe(0);
    expect(cam.offsetY).toBe(60);
  });
});

describe('worldToScreen / screenToWorld', () => {
  it('round-trips through a pillarboxed camera', () => {
    const cam = fitCamera(2560, 1080);
    const original = worldPoint(960, 540);
    const back = screenToWorld(cam, worldToScreen(cam, original));
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });

  it('places the world origin at the letterbox offset', () => {
    const cam = fitCamera(2560, 1080);
    const p = worldToScreen(cam, worldPoint(0, 0));
    expect(p.x).toBe(320);
    expect(p.y).toBe(0);
  });
});
