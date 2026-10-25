import { describe, expect, it } from 'vitest';
import {
  TRACK_WETNESS_DRY,
  TRACK_WETNESS_EXTREMELY_WET,
  lmuTrackWetness,
} from './trackWetness';

describe('lmuTrackWetness', () => {
  it('reports a dry track as Dry rather than unknown', () => {
    // 0 is what the frame carries all through a dry session, and the
    // consumers render level 0 as an empty string.
    expect(lmuTrackWetness(0)).toBe(TRACK_WETNESS_DRY);
  });

  it('saturates at Extremely Wet', () => {
    expect(lmuTrackWetness(1)).toBe(TRACK_WETNESS_EXTREMELY_WET);
  });

  it('never leaves the levels the consumers know', () => {
    for (let fraction = 0; fraction <= 1.0001; fraction += 0.001) {
      const level = lmuTrackWetness(fraction);
      expect(level).toBeGreaterThanOrEqual(TRACK_WETNESS_DRY);
      expect(level).toBeLessThanOrEqual(TRACK_WETNESS_EXTREMELY_WET);
      expect(Number.isInteger(level)).toBe(true);
    }
  });

  it('rises monotonically with wetness', () => {
    let previous = 0;
    for (let fraction = 0; fraction <= 1.0001; fraction += 0.001) {
      const level = lmuTrackWetness(fraction);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('uses every level, so the scale is not bunched into a few', () => {
    const seen = new Set<number>();
    for (let fraction = 0; fraction <= 1.0001; fraction += 0.001) {
      seen.add(lmuTrackWetness(fraction));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('separates a greasy track from a dry one', () => {
    // The point of bunching the low end: a tenth wet is a different line,
    // and even steps over 0..1 would have called this Dry.
    expect(lmuTrackWetness(0.1)).toBeGreaterThan(lmuTrackWetness(0));
  });

  it('treats a missing or broken reading as Dry', () => {
    expect(lmuTrackWetness(undefined)).toBe(TRACK_WETNESS_DRY);
    expect(lmuTrackWetness(NaN)).toBe(TRACK_WETNESS_DRY);
    expect(lmuTrackWetness(-1)).toBe(TRACK_WETNESS_DRY);
  });

  it('clamps a reading above the documented maximum', () => {
    expect(lmuTrackWetness(5)).toBe(TRACK_WETNESS_EXTREMELY_WET);
  });
});
