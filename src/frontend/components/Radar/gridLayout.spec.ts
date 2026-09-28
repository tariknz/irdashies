import { describe, expect, it } from 'vitest';
import { SessionState } from '@irdashies/types';
import {
  gridSlotLateralM,
  isGridBeforeStart,
  parseGridLayout,
  type GridLayout,
} from './gridLayout';

/** The grid label iRacing actually ships, and the one shape we draw. */
const TWO_ABREAST_LEFT = '2x2 inline pole on left';

describe('parseGridLayout', () => {
  it('reads the two-abreast grid and puts the pole on the left', () => {
    const layout = parseGridLayout(TWO_ABREAST_LEFT);
    expect(layout).not.toBeNull();
    expect(layout?.columns).toBe(2);
    // Negative is the driver's left, and the pole car sits there.
    expect(layout?.poleLateralM).toBeLessThan(0);
  });

  it('mirrors the grid when the pole is on the right', () => {
    const layout = parseGridLayout('2x2 inline pole on right');
    expect(layout?.poleLateralM).toBeGreaterThan(0);
  });

  it('reports an unknown grid rather than guessing', () => {
    // A layout the radar does not draw must leave the cars on the
    // centreline projection, which is what null means.
    expect(parseGridLayout(undefined)).toBeNull();
    expect(parseGridLayout('')).toBeNull();
    expect(parseGridLayout('1x1 inline pole on left')).toBeNull();
    expect(parseGridLayout('3x3 inline pole on left')).toBeNull();
    expect(parseGridLayout('no numbers here')).toBeNull();
  });
});

describe('gridSlotLateralM', () => {
  // A layout the parser is known to accept, so the slot maths can be read
  // without a null check on every line.
  const layout = parseGridLayout(TWO_ABREAST_LEFT) as GridLayout;

  it('pairs the first two slots into one row, on opposite sides', () => {
    const pole = gridSlotLateralM(1, layout);
    const second = gridSlotLateralM(2, layout);
    expect(pole).toBe(layout.poleLateralM);
    expect(second).toBe(-layout.poleLateralM);
    expect(pole).not.toBe(second);
  });

  it('keeps the column pattern for the whole field', () => {
    // Slots 1/2 share row 0, 3/4 share row 1, and so on, so the sign of a
    // slot's offset only depends on whether the slot is odd or even.
    for (const slot of [1, 3, 5, 7]) {
      expect(gridSlotLateralM(slot, layout)).toBe(layout.poleLateralM);
    }
    for (const slot of [2, 4, 6, 8]) {
      expect(gridSlotLateralM(slot, layout)).toBe(-layout.poleLateralM);
    }
  });

  it('rejects a slot the sim has not ranked', () => {
    expect(gridSlotLateralM(0, layout)).toBeNull();
    expect(gridSlotLateralM(-1, layout)).toBeNull();
    expect(gridSlotLateralM(Number.NaN, layout)).toBeNull();
  });
});

describe('isGridBeforeStart', () => {
  it('holds only while the cars are still parked', () => {
    expect(isGridBeforeStart(SessionState.GetInCar)).toBe(true);
    expect(isGridBeforeStart(SessionState.Warmup)).toBe(true);
    expect(isGridBeforeStart(SessionState.ParadeLaps)).toBe(true);
  });

  it('is off once the session is running or over', () => {
    expect(isGridBeforeStart(SessionState.Racing)).toBe(false);
    expect(isGridBeforeStart(SessionState.Checkered)).toBe(false);
    expect(isGridBeforeStart(SessionState.CoolDown)).toBe(false);
  });

  it('is off when the sim has reported no state at all', () => {
    // 0 is Invalid, and it is also what a frame without the variable reads
    // as. The radar must not reconstruct a grid it knows nothing about.
    expect(isGridBeforeStart(SessionState.Invalid)).toBe(false);
    expect(isGridBeforeStart(Number.NaN)).toBe(false);
  });
});
