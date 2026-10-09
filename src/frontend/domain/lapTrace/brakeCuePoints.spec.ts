import { describe, it, expect } from 'vitest';
import type { LapTraceView } from '@irdashies/types';
import { selectBrakeCuePoints } from './brakeCuePoints';
import { SampleBuffer } from './lapSamples';

const TRACK_LENGTH_M = 5000;
const SAMPLE_M = 1;

/** A firmly pressed corner brake, for zones whose pressure is not the point. */
const FIRM_BRAKE = 0.6;

interface ZoneSpec {
  /** Where the brake goes on, metres. */
  onM: number;
  /** Where it comes off, metres. */
  offM: number;
  /** Speed carried in, m/s. */
  entrySpeedMs: number;
  /** Lowest speed reached in the zone, m/s. */
  minSpeedMs: number;
  /** Highest brake pressure reached in the zone, 0..1. */
  peakBrake?: number;
}

/**
 * A lap at a flat cruising speed with the given braking zones cut into its
 * speed and brake traces, so the significance filter has something real to
 * measure on both criteria.
 */
const lapWith = (zones: ZoneSpec[], cruiseMs = 60): LapTraceView => {
  const buffer = new SampleBuffer(8192);
  for (let d = 0; d < TRACK_LENGTH_M; d += SAMPLE_M) {
    let speed = cruiseMs;
    let brake = 0;
    for (const zone of zones) {
      if (d >= zone.onM && d <= zone.offM) {
        // Entry speed holds for the first metre, then the zone's minimum.
        speed = d < zone.onM + SAMPLE_M ? zone.entrySpeedMs : zone.minSpeedMs;
        brake = zone.peakBrake ?? FIRM_BRAKE;
      }
    }
    buffer.push(d, d / cruiseMs, 1, brake, speed, 4, 0);
  }

  return {
    trackLengthM: TRACK_LENGTH_M,
    samples: buffer,
    events: {
      brakeOnM: new Float32Array(zones.map((z) => z.onM)),
      brakeOffM: new Float32Array(zones.map((z) => z.offM)),
      throttleOnM: new Float32Array(0),
    },
  } as unknown as LapTraceView;
};

describe('selectBrakeCuePoints', () => {
  it('keeps a real braking zone', () => {
    const lap = lapWith([
      { onM: 1000, offM: 1120, entrySpeedMs: 60, minSpeedMs: 30 },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000]);
  });

  it('drops a light brush inside a fast corner', () => {
    const lap = lapWith([
      // Mugello's Poggiosecco/Savelli/Arrabbiata: the pedal is touched to settle
      // the car mid-corner. Measured at 1-8% on a real 992 Cup lap. Nothing to
      // count down to, and it must never claim the corner's brake-point delta.
      {
        onM: 1000,
        offM: 1040,
        entrySpeedMs: 60,
        minSpeedMs: 56,
        peakBrake: 0.08,
      },
    ]);

    expect(selectBrakeCuePoints(lap).length).toBe(0);
  });

  it('drops a hard stab that does not actually slow the car', () => {
    const lap = lapWith([
      // Pressure alone would cue this. Imola at 4151 m: 18.8% peak for 1.3 m/s,
      // serving no corner. The speed floor is here for exactly this case.
      { onM: 1000, offM: 1015, entrySpeedMs: 60, minSpeedMs: 58.7 },
    ]);

    expect(selectBrakeCuePoints(lap).length).toBe(0);
  });

  it('keeps a corner brake point that only scrubs a few m/s', () => {
    const lap = lapWith([
      // Okayama's Revolver: 16% peak over 34 m for 2.8 m/s. A genuine corner
      // brake point that the old 5.5 m/s speed bar silently threw away, taking
      // the countdown and the brake-distance delta with it.
      {
        onM: 2129,
        offM: 2163,
        entrySpeedMs: 40,
        minSpeedMs: 37.2,
        peakBrake: 0.16,
      },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([2129]);
  });

  it('keeps a long light brake that still scrubs real speed', () => {
    const lap = lapWith([
      // Gentle, but 25 km/h comes off over a long trail-brake.
      {
        onM: 1000,
        offM: 1300,
        entrySpeedMs: 60,
        minSpeedMs: 53,
        peakBrake: 0.2,
      },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000]);
  });

  it('keeps both halves of a chicane, close together as they are', () => {
    // Imola's Variante Villeneuve: hard for the entry, back on the brake 15 m
    // after the release for the second apex. They are two corners with a brake
    // point each. Merging the second into the first used to leave that corner
    // with nothing to mark, nothing to count down to and nothing to compare.
    const lap = lapWith([
      { onM: 1000, offM: 1080, entrySpeedMs: 60, minSpeedMs: 30 },
      { onM: 1095, offM: 1160, entrySpeedMs: 32, minSpeedMs: 22 },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000, 1095]);
  });

  it('still drops a close re-application that scrubs nothing', () => {
    // Proximity is no longer the test, so speed has to carry it: a re-press 15 m
    // after a release that takes nothing off is a wobble inside the zone, not a
    // second corner. Pressed firmly, so only the speed floor can reject it.
    const lap = lapWith([
      { onM: 1000, offM: 1080, entrySpeedMs: 60, minSpeedMs: 30 },
      { onM: 1095, offM: 1160, entrySpeedMs: 30, minSpeedMs: 29.4 },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000]);
  });

  it('honours the caller-supplied minimum pressure', () => {
    // Both consumers of this list pass the user's setting. The threshold has to
    // actually move the answer, or the setting is decoration.
    const lap = lapWith([
      {
        onM: 1000,
        offM: 1060,
        entrySpeedMs: 60,
        minSpeedMs: 52,
        peakBrake: 0.1,
      },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap, { minPeak: 0.05 }))).toEqual([
      1000,
    ]);
    expect(selectBrakeCuePoints(lap, { minPeak: 0.25 }).length).toBe(0);
    // Absent or nonsensical options fall back to the default, which rejects it.
    expect(selectBrakeCuePoints(lap).length).toBe(0);
    expect(selectBrakeCuePoints(lap, {}).length).toBe(0);
    expect(selectBrakeCuePoints(lap, { minPeak: Number.NaN }).length).toBe(0);
  });

  it('keeps two genuinely separate corners', () => {
    const lap = lapWith([
      { onM: 1000, offM: 1120, entrySpeedMs: 60, minSpeedMs: 30 },
      { onM: 2500, offM: 2600, entrySpeedMs: 60, minSpeedMs: 25 },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000, 2500]);
  });

  it('preserves sub-metre precision', () => {
    const lap = lapWith([
      { onM: 1002.4, offM: 1120, entrySpeedMs: 60, minSpeedMs: 30 },
    ]);

    expect(selectBrakeCuePoints(lap)[0]).toBeCloseTo(1002.4, 3);
  });

  it('measures a zone that runs across the start/finish line', () => {
    const lap = lapWith([
      { onM: 4950, offM: 4999, entrySpeedMs: 60, minSpeedMs: 30 },
    ]);
    // The zone's release is at the last sample; the scan must not fall off
    // the end of the lap and lose the speed drop.
    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([4950]);
  });

  it('returns nothing for a lap with no recorded events', () => {
    const lap = lapWith([
      { onM: 1000, offM: 1120, entrySpeedMs: 60, minSpeedMs: 30 },
    ]);
    const noEvents = { ...lap, events: undefined } as unknown as LapTraceView;

    expect(selectBrakeCuePoints(noEvents).length).toBe(0);
  });

  it('returns nothing when the lap has no usable geometry', () => {
    const lap = lapWith([
      { onM: 1000, offM: 1120, entrySpeedMs: 60, minSpeedMs: 30 },
    ]);

    expect(
      selectBrakeCuePoints({ ...lap, trackLengthM: 0 } as LapTraceView).length
    ).toBe(0);
    expect(
      selectBrakeCuePoints({
        ...lap,
        samples: new SampleBuffer(2),
      } as LapTraceView).length
    ).toBe(0);
  });

  it('returns points in ascending order', () => {
    const lap = lapWith([
      { onM: 500, offM: 600, entrySpeedMs: 60, minSpeedMs: 25 },
      { onM: 1800, offM: 1900, entrySpeedMs: 60, minSpeedMs: 25 },
      { onM: 3900, offM: 4000, entrySpeedMs: 60, minSpeedMs: 25 },
    ]);

    const points = Array.from(selectBrakeCuePoints(lap));
    expect(points).toEqual([...points].sort((a, b) => a - b));
    expect(points).toHaveLength(3);
  });
});
