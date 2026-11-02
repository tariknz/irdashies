import { describe, expect, it } from 'vitest';
import { formatTrackLimits, trackLimitsTone } from './trackLimitsDisplay';

describe('formatTrackLimits', () => {
  it('writes it the way the sim does', () => {
    expect(formatTrackLimits(0.25, 3)).toBe('0.25 / 3.00');
  });

  it('shows a clean driver as 0.00, which is a reading', () => {
    expect(formatTrackLimits(0, 3)).toBe('0.00 / 3.00');
  });

  it('dashes an unstated ceiling rather than showing zero', () => {
    // "/ 0.00" would read as a penalty served at nothing.
    expect(formatTrackLimits(0.5, undefined)).toBe('0.50 / –');
    expect(formatTrackLimits(0.5, 0)).toBe('0.50 / –');
  });
});

describe('trackLimitsTone', () => {
  it('escalates as the ceiling approaches', () => {
    expect(trackLimitsTone(0.25, 3)).toBe('');
    expect(trackLimitsTone(2, 3)).toContain('amber');
    expect(trackLimitsTone(3, 3)).toContain('red');
    expect(trackLimitsTone(4, 3)).toContain('red');
  });

  it('stays plain when there is no ceiling to measure against', () => {
    expect(trackLimitsTone(2, undefined)).toBe('');
  });
});
