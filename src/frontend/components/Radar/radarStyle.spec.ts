import { describe, expect, it } from 'vitest';
import { formatDistance, speedIn, speedUnit } from './radarStyle';

describe('radarStyle units', () => {
  it('writes tenths under ten and whole numbers above', () => {
    expect(formatDistance(2.44, true)).toBe('2.4m');
    expect(formatDistance(10, true)).toBe('10m');
    expect(formatDistance(340.6, true)).toBe('341m');
  });

  it('writes feet for imperial', () => {
    expect(formatDistance(2, false)).toBe('6.6ft');
    expect(formatDistance(10, false)).toBe('33ft');
  });

  it('converts speeds from m/s', () => {
    expect(speedIn(25, true)).toBe(90);
    expect(speedIn(25, false)).toBe(56);
    expect(speedUnit(true)).toBe('km/h');
    expect(speedUnit(false)).toBe('mph');
  });
});
