import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import recordedSession from '../../../test-data/1747384033336/session.json';
import recordedOverlapFrame from '../../../test-data/1747384033336/telemetry.json';
import recordedClearFrame from '../../../test-data/1770713920383/telemetry.json';
import { BlindSpotProcessor } from './BlindSpotProcessor';

const frame = (carLeftRight: number, positions: number[], isOnTrack = true) =>
  ({
    CarLeftRight: { value: [carLeftRight] },
    CarIdxLapDistPct: { value: positions },
    IsOnTrack: { value: [isOnTrack] },
  }) as unknown as Telemetry;

describe('BlindSpotProcessor', () => {
  it('processes recorded telemetry through the complete lifecycle', () => {
    const processor = new BlindSpotProcessor();
    processor.init(recordedSession as unknown as Session);
    processor.onFrame(recordedOverlapFrame as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 2,
      carIdxLapDistPct: recordedOverlapFrame.CarIdxLapDistPct.value,
      isOnTrack: true,
      version: 1,
    });

    processor.onFrame(recordedClearFrame as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 1,
      carIdxLapDistPct: [],
      isOnTrack: true,
      version: 2,
    });
  });

  it('publishes overlap state and full-precision positions together', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(frame(2, [0.123456, 0.123789]));

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 2,
      carIdxLapDistPct: [0.123456, 0.123789],
      isOnTrack: true,
      version: 1,
    });
  });

  it('does not copy or publish moving positions while there is no overlap', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(frame(1, [0.1, 0.2]));
    const idleVersion = processor.snapshot().version;

    processor.onFrame(frame(1, [0.11, 0.21]));

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 1,
      carIdxLapDistPct: [],
      isOnTrack: true,
      version: idleVersion,
    });
  });

  it('stops publishing positions when an overlap clears', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(frame(2, [0.5, 0.5005]));
    processor.onFrame(frame(1, [0.51, 0.52]));

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 1,
      carIdxLapDistPct: [],
      isOnTrack: true,
      version: 2,
    });
  });

  it('clears safety state at lifecycle boundaries', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(frame(3, [0.5, 0.6]));
    processor.onLifecycle({ type: 'disconnect' });

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 0,
      carIdxLapDistPct: [],
      isOnTrack: false,
      version: 2,
    });
  });
});

describe('BlindSpotProcessor relative offsets', () => {
  /** A sim reporting true metres alongside, as the LMU mapper does. */
  const offsetFrame = (
    carLeftRight: number,
    left: number | null,
    right: number | null,
    positions: number[] = [0.5, 0.5004]
  ) =>
    ({
      CarLeftRight: { value: [carLeftRight] },
      CarIdxLapDistPct: { value: positions },
      IsOnTrack: { value: [true] },
      LmuBlindSpotLeftLongitudinal: { value: [left] },
      LmuBlindSpotRightLongitudinal: { value: [right] },
    }) as unknown as Telemetry;

  it('passes the offsets straight through', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(offsetFrame(2, 1.25, null));

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 2,
      leftLongitudinalM: 1.25,
      rightLongitudinalM: null,
    });
  });

  it('omits the lap-fraction array when offsets are supplied', () => {
    // The array is over a hundred elements and would cross the channel every
    // tick; a consumer given metres has no use for it.
    const processor = new BlindSpotProcessor();
    processor.onFrame(offsetFrame(2, 1.25, null));

    expect(processor.snapshot().carIdxLapDistPct).toEqual([]);
  });

  it('still carries the array for a sim that reports no offsets', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(frame(2, [0.5, 0.5004]));

    const snapshot = processor.snapshot();
    expect(snapshot.carIdxLapDistPct).toEqual([0.5, 0.5004]);
    expect(snapshot.leftLongitudinalM).toBeNull();
    expect(snapshot.rightLongitudinalM).toBeNull();
  });

  it('bumps the version when only an offset moves', () => {
    // Otherwise a consumer subscribed to the channel never sees the car move.
    const processor = new BlindSpotProcessor();
    processor.onFrame(offsetFrame(2, 1.25, null));
    const first = processor.snapshot().version;

    processor.onFrame(offsetFrame(2, 1.1, null));

    expect(processor.snapshot().version).toBeGreaterThan(first);
    expect(processor.snapshot().leftLongitudinalM).toBe(1.1);
  });

  it('clears the offsets when the car moves away', () => {
    const processor = new BlindSpotProcessor();
    processor.onFrame(offsetFrame(2, 1.25, null));
    processor.onFrame(offsetFrame(1, null, null));

    expect(processor.snapshot()).toMatchObject({
      carLeftRight: 1,
      leftLongitudinalM: null,
      rightLongitudinalM: null,
    });
  });
});
