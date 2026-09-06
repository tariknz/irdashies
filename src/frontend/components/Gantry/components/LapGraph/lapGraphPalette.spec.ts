import { describe, expect, it } from 'vitest';
import {
  IDENTITY_COLORS,
  identityForGridSlot,
  scaleDash,
  swatchDashArrayForGridSlot,
} from './lapGraphPalette';

describe('IDENTITY_COLORS', () => {
  it('has exactly ten colours, in ramp order', () => {
    expect(IDENTITY_COLORS).toEqual([
      '#199e70',
      '#9085e9',
      '#e66767',
      '#c026d3',
      '#008300',
      '#0891b2',
      '#c98500',
      '#d55181',
      '#3987e5',
      '#d95926',
    ]);
  });

  it('holds ten distinct colours', () => {
    expect(new Set(IDENTITY_COLORS).size).toBe(10);
  });
});

/**
 * The ramp values live in the assertion above and nowhere else. Everything
 * below indexes into it, so a re-step only has to touch one place.
 */
const FIRST = IDENTITY_COLORS[0];
const LAST = IDENTITY_COLORS[9];

describe('identityForGridSlot', () => {
  it('gives positions 1-10 solid lines in ramp order', () => {
    expect(identityForGridSlot(1)).toEqual({
      color: FIRST,
      dash: [],
    });
    expect(identityForGridSlot(10)).toEqual({
      color: LAST,
      dash: [],
    });
  });

  it('gives positions 11-20 the dashed pattern, colours repeating', () => {
    expect(identityForGridSlot(11)).toEqual({
      color: FIRST,
      dash: [7, 4],
    });
    expect(identityForGridSlot(20)).toEqual({
      color: LAST,
      dash: [7, 4],
    });
  });

  it('gives positions 21-30 the dotted pattern', () => {
    expect(identityForGridSlot(21)).toEqual({
      color: FIRST,
      dash: [2, 3],
    });
    expect(identityForGridSlot(30)).toEqual({
      color: LAST,
      dash: [2, 3],
    });
  });

  it('gives positions 31-40 the dash-dot pattern', () => {
    expect(identityForGridSlot(31)).toEqual({
      color: FIRST,
      dash: [7, 3, 2, 3],
    });
    expect(identityForGridSlot(40)).toEqual({
      color: LAST,
      dash: [7, 3, 2, 3],
    });
  });

  it('wraps every 40 slots, colliding slot 41 with slot 1', () => {
    expect(identityForGridSlot(41)).toEqual(identityForGridSlot(1));
    expect(identityForGridSlot(52)).toEqual(identityForGridSlot(12));
  });
});

describe('scaleDash', () => {
  it('leaves solid alone', () => {
    expect(scaleDash([], 3)).toEqual([]);
  });

  it('multiplies every entry by the line width', () => {
    expect(scaleDash([7, 4], 2)).toEqual([14, 8]);
    expect(scaleDash([2, 3], 3)).toEqual([6, 9]);
    expect(scaleDash([7, 3, 2, 3], 3)).toEqual([21, 9, 6, 9]);
  });

  it('does not mutate the source array', () => {
    const dash = [7, 4];
    scaleDash(dash, 5);
    expect(dash).toEqual([7, 4]);
  });
});

describe('swatchDashArrayForGridSlot', () => {
  it('omits the attribute for solid', () => {
    expect(swatchDashArrayForGridSlot(1)).toBeUndefined();
  });

  it('uses the swatch-tuned values for each pattern', () => {
    expect(swatchDashArrayForGridSlot(11)).toBe('4 2');
    expect(swatchDashArrayForGridSlot(21)).toBe('1.5 2');
    expect(swatchDashArrayForGridSlot(31)).toBe('4 1.5 1 1.5');
  });

  it('wraps in step with identityForGridSlot', () => {
    expect(swatchDashArrayForGridSlot(41)).toBe(swatchDashArrayForGridSlot(1));
  });
});
