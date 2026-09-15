import { describe, it, expect } from 'vitest';
import type { LapTraceView } from '@irdashies/types';
import { selectBrakeCuePoints } from './brakeCuePoints';
import { SampleBuffer } from './lapSamples';

const TRACK_LENGTH_M = 5000;
const SAMPLE_M = 1;

interface ZoneSpec {
  /** Where the brake goes on, metres. */
  onM: number;
  /** Where it comes off, metres. */
  offM: number;
  /** Speed carried in, m/s. */
  entrySpeedMs: number;
  /** Lowest speed reached in the zone, m/s. */
  minSpeedMs: number;
}

/**
 * A lap at a flat cruising speed with the given braking zones cut into its
 * speed trace, so the significance filter has something real to measure.
 */
const lapWith = (zones: ZoneSpec[], cruiseMs = 60): LapTraceView => {
  const buffer = new SampleBuffer(8192);
  for (let d = 0; d < TRACK_LENGTH_M; d += SAMPLE_M) {
    let speed = cruiseMs;
    for (const zone of zones) {
      if (d >= zone.onM && d <= zone.offM) {
        // Entry speed holds for the first metre, then the zone's minimum.
        speed = d < zone.onM + SAMPLE_M ? zone.entrySpeedMs : zone.minSpeedMs;
      }
    }
    buffer.push(d, d / cruiseMs, 1, 0, speed, 4, 0);
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

  it('drops a dab that barely scrubs any speed', () => {
    const lap = lapWith([
      // 2 m/s off — a stabilising brush in a fast kink, not a braking zone.
      { onM: 1000, offM: 1040, entrySpeedMs: 60, minSpeedMs: 58 },
    ]);

    expect(selectBrakeCuePoints(lap).length).toBe(0);
  });

  it('keeps a long light brake that still scrubs real speed', () => {
    const lap = lapWith([
      // Gentle, but 25 km/h comes off over a long trail-brake.
      { onM: 1000, offM: 1300, entrySpeedMs: 60, minSpeedMs: 53 },
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
    // Proximity is no longer the test, so speed has to carry it: a brush 15 m
    // after a release is a wobble inside the zone, not a second corner.
    const lap = lapWith([
      { onM: 1000, offM: 1080, entrySpeedMs: 60, minSpeedMs: 30 },
      { onM: 1095, offM: 1160, entrySpeedMs: 30, minSpeedMs: 28 },
    ]);

    expect(Array.from(selectBrakeCuePoints(lap))).toEqual([1000]);
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
