import { describe, it, expect } from 'vitest';
import type { LapTraceSamples } from '@irdashies/types';
import {
  MAX_PLAUSIBLE_CORNER_DELTA_SEC,
  MIN_CORNER_LENGTH_M,
  compareCorner,
  cornerLapMetrics,
  cornerRange,
} from './cornerComparison';
import { SampleBuffer } from './lapSamples';

const TRACK_LENGTH_M = 5000;

/**
 * A lap sampled every `spacingM` with speed given by `speedAt(d)`, its time
 * integrated from the speed by trapezoid — the same identity the corner timing
 * rests on, so a constant-speed stretch has an exactly known duration.
 */
const lapOf = (
  speedAt: (d: number) => number,
  spacingM = 1,
  untilM = TRACK_LENGTH_M
): LapTraceSamples => {
  const buffer = new SampleBuffer(8192);
  let t = 0;
  let prev = speedAt(0);
  for (let d = 0; d < untilM; d += spacingM) {
    const v = speedAt(d);
    if (d > 0) t += spacingM / ((prev + v) / 2);
    prev = v;
    buffer.push(d, t, 1, 0, v, 4, 0);
  }
  return buffer;
};

const constant = (speedMs: number) => () => speedMs;

describe('cornerRange', () => {
  it('maps lap fractions onto metres', () => {
    expect(cornerRange(0.125, 0.375, 1000)).toEqual({
      startM: 125,
      endM: 375,
    });
  });

  it('rejects a corner straddling the start/finish line', () => {
    // The live lap is reset at the line, so it can never hold both halves.
    expect(cornerRange(0.97, 0.03, 1000)).toBeNull();
  });

  it('rejects a range too short to be a corner', () => {
    expect(cornerRange(0.1, 0.1, 1000)).toBeNull();
    expect(
      cornerRange(0.1, 0.1 + (MIN_CORNER_LENGTH_M - 1) / 1000, 1000)
    ).toBeNull();
  });

  it('rejects a range so wide it must be bad data', () => {
    expect(cornerRange(0.1, 0.8, 1000)).toBeNull();
  });

  it('rejects nonsensical input rather than guessing', () => {
    expect(cornerRange(0.1, 0.15, 0)).toBeNull();
    expect(cornerRange(NaN, 0.15, 1000)).toBeNull();
    expect(cornerRange(0.1, NaN, 1000)).toBeNull();
  });
});

describe('cornerLapMetrics', () => {
  it('recovers corner time from the per-sample clock', () => {
    // 250 m at 20 m/s = 12.5 s.
    const metrics = cornerLapMetrics(lapOf(constant(20)), 500, 750);
    expect(metrics?.timeSec).toBeCloseTo(12.5, 4);
    expect(metrics?.minSpeedMs).toBe(20);
  });

  it('interpolates the clock at boundaries that fall between samples', () => {
    // Samples every 10 m, corner from 505 m to 745 m: 240 m at 20 m/s = 12 s.
    const metrics = cornerLapMetrics(lapOf(constant(20), 10), 505, 745);
    expect(metrics?.timeSec).toBeCloseTo(12, 4);
  });

  it('reports the slowest point as the apex', () => {
    const lap = lapOf((d) => (d >= 600 && d < 610 ? 25 : 40));
    const metrics = cornerLapMetrics(lap, 500, 750);
    expect(metrics?.minSpeedMs).toBe(25);
    expect(metrics?.timeSec).toBeGreaterThan(250 / 40);
  });

  it('rejects the whole corner when part of it was never driven', () => {
    // The lap has a hole from 600 m to 700 m.
    const buffer = new SampleBuffer(1024);
    let t = 0;
    for (let d = 0; d < 1000; d += 1) {
      if (d >= 600 && d < 700) continue;
      buffer.push(d, t, 1, 0, 20, 4, 0);
      t += 0.05;
    }
    // Never a partial sum: interpolating across the hole would fake a time.
    expect(cornerLapMetrics(buffer, 500, 750)).toBeNull();
    // A corner entirely before the hole is fine.
    expect(cornerLapMetrics(buffer, 100, 300)).not.toBeNull();
  });

  it('rejects a corner the lap did not reach', () => {
    const lap = lapOf(constant(20), 1, 600);
    expect(cornerLapMetrics(lap, 500, 750)).toBeNull();
  });

  it('rejects speeds too low to be driving', () => {
    for (const bad of [0, 0.5, -1, NaN]) {
      const lap = lapOf((d) => (d === 600 ? bad : 20));
      expect(cornerLapMetrics(lap, 500, 750)).toBeNull();
    }
  });
});

describe('compareCorner', () => {
  const baseParams = {
    startPct: 0.1,
    endPct: 0.15,
    trackLengthM: TRACK_LENGTH_M,
  };

  it('reports a slower corner with less apex speed', () => {
    const result = compareCorner({
      ...baseParams,
      driverSamples: lapOf(constant(18)),
      referenceSamples: lapOf(constant(20)),
    });

    expect(result?.timeDeltaSec).toBeGreaterThan(0);
    expect(result?.apexSpeedDeltaMs).toBeCloseTo(-2, 5);
  });

  it('reports a faster corner with more apex speed', () => {
    const result = compareCorner({
      ...baseParams,
      driverSamples: lapOf(constant(22)),
      referenceSamples: lapOf(constant(20)),
    });

    expect(result?.timeDeltaSec).toBeLessThan(0);
    expect(result?.apexSpeedDeltaMs).toBeCloseTo(2, 5);
  });

  it('reports exactly zero for an identical corner', () => {
    const lap = lapOf(constant(20));
    const result = compareCorner({
      ...baseParams,
      driverSamples: lap,
      referenceSamples: lap,
    });

    expect(result?.timeDeltaSec).toBe(0);
    expect(result?.apexSpeedDeltaMs).toBe(0);
  });

  it('is symmetric across sample spacing: the delta is what the panel shows', () => {
    // The same drive sampled at 25 Hz and at 60 Hz must agree on the corner
    // time to well under the 10 ms the panel displays.
    const coarse = compareCorner({
      ...baseParams,
      driverSamples: lapOf(constant(18), 2.5),
      referenceSamples: lapOf(constant(20), 1),
    });
    const fine = compareCorner({
      ...baseParams,
      driverSamples: lapOf(constant(18), 1),
      referenceSamples: lapOf(constant(20), 1),
    });
    expect(
      Math.abs((coarse?.timeDeltaSec ?? 0) - (fine?.timeDeltaSec ?? 0))
    ).toBeLessThan(0.001);
  });

  it('returns null when the driver has not driven the whole corner', () => {
    const result = compareCorner({
      ...baseParams,
      driverSamples: lapOf(constant(20), 1, 600),
      referenceSamples: lapOf(constant(20)),
    });

    expect(result).toBeNull();
  });

  it('blanks rather than reporting an implausible delta', () => {
    const result = compareCorner({
      ...baseParams,
      // Crawling through a corner the reference took at 30 m/s.
      driverSamples: lapOf(constant(2)),
      referenceSamples: lapOf(constant(30)),
    });

    expect(result).toBeNull();
    // Sanity: 250 m at 2 m/s vs 30 m/s is far past the plausibility cap.
    expect(250 / 2 - 250 / 30).toBeGreaterThan(MAX_PLAUSIBLE_CORNER_DELTA_SEC);
  });

  it('returns null for a corner across the start/finish line', () => {
    const result = compareCorner({
      ...baseParams,
      startPct: 0.98,
      endPct: 0.02,
      driverSamples: lapOf(constant(20)),
      referenceSamples: lapOf(constant(20)),
    });

    expect(result).toBeNull();
  });
});
