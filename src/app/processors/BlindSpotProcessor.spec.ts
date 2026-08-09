import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { BlindSpotProcessor } from './BlindSpotProcessor';

const frame = (carLeftRight: number, positions: number[], isOnTrack = true) =>
  ({
    CarLeftRight: { value: [carLeftRight] },
    CarIdxLapDistPct: { value: positions },
    IsOnTrack: { value: [isOnTrack] },
  }) as unknown as Telemetry;

describe('BlindSpotProcessor', () => {
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
