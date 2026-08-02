import { describe, expect, it } from 'vitest';

import { formatTotalTime } from './formatTotalTime';

describe('formatTotalTime', () => {
  it('returns a dash for negative durations', () => {
    expect(formatTotalTime(-1, 'minimal', false, 'none')).toBe('-');
  });

  it('formats hh:mm compact totals, dropping minutes when they are zero', () => {
    expect(formatTotalTime(2 * 3600, 'hh:mm', true, 'none')).toBe('02');
    expect(formatTotalTime(2 * 3600 + 5 * 60, 'hh:mm', true, 'none')).toBe(
      '02:05'
    );
  });

  it('formats hh:mm non-compact totals with seconds', () => {
    expect(formatTotalTime(2 * 3600 + 5 * 60 + 9, 'hh:mm', false, 'none')).toBe(
      '02:05:09'
    );
  });

  it('formats minimal compact totals, trimming zero components', () => {
    expect(formatTotalTime(3600, 'minimal', true, 'none')).toBe('1');
    expect(formatTotalTime(3660, 'minimal', true, 'none')).toBe('1:01');
    expect(formatTotalTime(3661, 'minimal', true, 'none')).toBe('1:01:01');
    expect(formatTotalTime(65, 'minimal', true, 'none')).toBe('1:05');
    // hours=0 falls into the minutes:seconds branch even with 0 minutes
    expect(formatTotalTime(5, 'minimal', true, 'none')).toBe('0:05');
  });

  it('formats minimal elapsed/remaining totals, trimming leading zero components', () => {
    expect(formatTotalTime(3661, 'minimal', false, 'none')).toBe('1:01:01');
    expect(formatTotalTime(65, 'minimal', false, 'none')).toBe('1:05');
    expect(formatTotalTime(5, 'minimal', false, 'none')).toBe('5');
  });

  it('appends short and minimal unit labels based on the largest unit present', () => {
    expect(formatTotalTime(3661, 'minimal', false, 'short')).toBe(
      '1:01:01 hrs'
    );
    expect(formatTotalTime(65, 'minimal', false, 'short')).toBe('1:05 mins');
    expect(formatTotalTime(5, 'minimal', false, 'short')).toBe('5 secs');
    expect(formatTotalTime(65, 'minimal', false, 'minimal')).toBe('1:05 m');
  });
});
