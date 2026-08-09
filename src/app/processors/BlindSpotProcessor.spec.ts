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
