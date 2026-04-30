import { describe, expect, it } from 'vitest';
import {
  computeGhostSectorColor,
  getSectorDeltaThresholdFractions,
} from './sectorColorUtils';

describe('sectorColorUtils', () => {
  it('returns default thresholds when none are configured', () => {
    expect(getSectorDeltaThresholdFractions()).toEqual({
      green: 0.005,
      yellow: 0.01,
    });
  });

  it('returns purple when the ghost is matched or beaten', () => {
    expect(computeGhostSectorColor(9.9, 10)).toBe('purple');
    expect(computeGhostSectorColor(10, 10)).toBe('purple');
  });

  it('uses configured thresholds for ghost comparisons', () => {
    const thresholds = { green: 0.5, yellow: 1.0 };

    expect(computeGhostSectorColor(10.04, 10, thresholds)).toBe('green');
    expect(computeGhostSectorColor(10.08, 10, thresholds)).toBe('yellow');
    expect(computeGhostSectorColor(10.2, 10, thresholds)).toBe('red');
  });
});
