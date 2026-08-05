import { describe, expect, it } from 'vitest';
import type { Grid } from '../state';
import { freshState } from '../state';
import { gIdx, worldToCell } from '../grid/grid';
import { tickContactDamage } from './contact';

function makeTestGrid(overrides: Partial<Grid> = {}): Grid {
  const size = 3600;
  return {
    cols: 60,
    rows: 60,
    size,
    cellSize: 10,
    vein: new Float32Array(size),
    threshold: new Float32Array(size),
    growth: new Float32Array(size),
    frozen: new Float32Array(size),
    bucket: new Int8Array(size),
    maxRange: 300,
    safeRadius: 20,
    ...overrides,
  };
}

// Places revealed, high-density growth all the way around the sample
// ring (safeRadius + 1.5 cells) so tickContactDamage always finds
// something regardless of which of the 24 angular samples land where.
function revealContactRing(grid: Grid, towerX: number, towerY: number): void {
  const ringR = grid.safeRadius + grid.cellSize * 1.5;
  for (let s = 0; s < 24; s++) {
    const a = (s / 24) * Math.PI * 2;
    const x = towerX + Math.cos(a) * ringR;
    const y = towerY + Math.sin(a) * ringR;
    const { cx, cy } = worldToCell(grid, x, y);
    const i = gIdx(grid, cx, cy);
    grid.threshold[i] = 0.1;
    grid.growth[i] = 0.9;
  }
}

describe('tickContactDamage', () => {
  it('does no damage when nothing at the ring is revealed', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBe(0);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('damages the core when revealed density sits at the safe-zone ring', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    revealContactRing(state.grid, state.tower.x, state.tower.y);

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBeGreaterThan(0);
    expect(state.tower.hp).toBeLessThan(state.tower.maxHp);
  });

  it('never samples closer than the safe-zone ring, even with dense growth right at the tower', () => {
    // Regression guard for the documented prototype bug: sampling any
    // closer than safeRadius+1.5 cells means the wall can never
    // physically reach the sample point (ambient growth is hard-gated to
    // zero inside the safe radius), so the core would be structurally
    // unkillable. See docs/PROTOTYPE_HANDOFF.md "Known bugs".
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    // Reveal density immediately at the tower (well inside the safe
    // radius) but nowhere near the actual sample ring.
    const { cx, cy } = worldToCell(state.grid, state.tower.x, state.tower.y);
    const i = gIdx(state.grid, cx, cy);
    state.grid.threshold[i] = 0.1;
    state.grid.growth[i] = 1;

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBe(0);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('gates on revealed density, never raw density below its threshold', () => {
    // Regression guard for the other documented bug: raw density can
    // cross the damage floor before a cell individually crosses its own
    // reveal threshold, which drained hp with no visible slime on screen.
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    const ringR = state.grid.safeRadius + state.grid.cellSize * 1.5;
    const { cx, cy } = worldToCell(state.grid, state.tower.x + ringR, state.tower.y);
    const i = gIdx(state.grid, cx, cy);
    state.grid.threshold[i] = 0.9; // high threshold — not revealed yet
    state.grid.growth[i] = 0.5; // well above the 0.05 contact floor, but still unrevealed

    tickContactDamage(state, 1);

    expect(state.contactPressure).toBe(0);
    expect(state.tower.hp).toBe(state.tower.maxHp);
  });

  it('scales damage with the current tier\'s contactMult', () => {
    const state = freshState();
    state.grid = makeTestGrid();
    state.tower.x = 300;
    state.tower.y = 300;
    revealContactRing(state.grid, state.tower.x, state.tower.y);
    state.tierIndex = 4; // Apocalypse, contactMult 2.1 vs tier 0's 1.0

    tickContactDamage(state, 1);
    const apocalypseDamage = state.tower.maxHp - state.tower.hp;

    const baseline = freshState();
    baseline.grid = makeTestGrid();
    baseline.tower.x = 300;
    baseline.tower.y = 300;
    revealContactRing(baseline.grid, baseline.tower.x, baseline.tower.y);

    tickContactDamage(baseline, 1);
    const baselineDamage = baseline.tower.maxHp - baseline.tower.hp;

    expect(apocalypseDamage).toBeGreaterThan(baselineDamage);
  });
});
