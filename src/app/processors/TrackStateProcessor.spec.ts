import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { TrackStateProcessor } from './TrackStateProcessor';

const frame = (values: Record<string, unknown[]>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, current]) => [key, { value: current }])
  ) as unknown as Telemetry;

describe('TrackStateProcessor', () => {
  it('projects positional, pit, and warning state', () => {
    const processor = new TrackStateProcessor();
    processor.onFrame(
      frame({
        CamCarIdx: [2],
        CarIdxLapDistPct: [0.1004, 0.2005, 0.30049],
        CarIdxOnPitRoad: [0, 1, 0],
        CarIdxTrackSurface: [3, 2, 3],
        CarIdxClassPosition: [1, 2, 3],
        CarLeftRight: [2],
        IsOnTrack: [true],
        OnPitRoad: [true],
        Speed: [41.5],
        EngineWarnings: [16],
        SessionFlags: [32],
        SessionNum: [1],
      })
    );

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: 2,
      carIdxLapDistPct: [0.1, 0.201, 0.3],
      carIdxOnPitRoad: [false, true, false],
      carIdxTrackSurface: [3, 2, 3],
      carIdxClassPosition: [1, 2, 3],
      carLeftRight: 2,
      isOnTrack: true,
      onPitRoad: true,
      speed: 41.5,
      engineWarnings: 16,
      sessionFlags: 32,
      sessionNum: 1,
      version: 1,
    });
  });

  it('reuses buffers, publishes only changes, and resets on disconnect', () => {
    const processor = new TrackStateProcessor();
    const telemetry = frame({ CarIdxLapDistPct: [0.25], IsOnTrack: [true] });
    processor.onFrame(telemetry);
    const positions = processor.snapshot().carIdxLapDistPct;
    processor.onFrame(telemetry);
    expect(processor.snapshot().version).toBe(1);
    expect(processor.snapshot().carIdxLapDistPct).toBe(positions);

    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot()).toMatchObject({
      carIdxLapDistPct: [],
      isOnTrack: false,
      sessionNum: null,
      version: 2,
    });
  });

  it('ignores sub-millipercent position movement', () => {
    const processor = new TrackStateProcessor();
    processor.onFrame(frame({ CarIdxLapDistPct: [0.12341] }));
    processor.onFrame(frame({ CarIdxLapDistPct: [0.12344] }));

    expect(processor.snapshot()).toMatchObject({
      carIdxLapDistPct: [0.123],
      version: 1,
    });
  });
});
