import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { CarSpeedsProcessor } from './CarSpeedsProcessor';

const session = (trackLength = '1 km') =>
  ({ WeekendInfo: { TrackLength: trackLength } }) as Session;

const frame = (lapDistPct: number[], sessionTime: number, sessionNum = 1) =>
  ({
    CarIdxLapDistPct: { value: lapDistPct },
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

describe('CarSpeedsProcessor', () => {
  // The 10 Hz rate is the processor host's job (tickRateHz); the processor
  // derives speed from whatever interval separates the frames it is given.
  it('derives smoothed km/h speeds from the frames it is given', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    expect(processor.snapshot().carSpeeds).toEqual([0]);
    processor.onFrame(frame([0.11], 1.1));
    expect(processor.snapshot().carSpeeds[0]).toBe(360);
    processor.onFrame(frame([0.125], 1.2));
    expect(processor.snapshot().carSpeeds[0]).toBe(450);
  });

  it('ignores frames on a frozen or nearly frozen clock', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    processor.onFrame(frame([0.11], 1.1));
    const { version } = processor.snapshot();
    processor.onFrame(frame([0.11], 1.1));
    processor.onFrame(frame([0.111], 1.12));
    expect(processor.snapshot().version).toBe(version);
    expect(processor.snapshot().carSpeeds[0]).toBe(360);
  });

  it('handles start-finish wrap-around', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.99], 1));
    processor.onFrame(frame([0.01], 1.2));
    expect(processor.snapshot().carSpeeds[0]).toBe(360);
  });

  it('keeps speeds aligned when the driver array grows', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    processor.onFrame(frame([0.11], 1.1));
    processor.onFrame(frame([0.12, 0.5], 1.2));
    expect(processor.snapshot().carSpeeds).toEqual([360, 0]);
  });

  it('resets on an in-frame session change', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    processor.onFrame(frame([0.11], 1.1));
    processor.onFrame(frame([0.2], 2, 2));
    expect(processor.snapshot()).toMatchObject({
      carSpeeds: [0],
      sessionNum: 2,
    });
  });

  it('clears on disconnect and suppresses replay scrubbing', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    processor.onLifecycle({ type: 'disconnect' });
    processor.onFrame(frame([0.2], 2));
    expect(processor.snapshot().carSpeeds).toEqual([]);

    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame([0.3], 3));
    expect(processor.snapshot().carSpeeds).toEqual([]);
  });

  it('emits zero speeds until session track length is available', () => {
    const processor = new CarSpeedsProcessor();
    processor.onFrame(frame([0.1, 0.2], 1));
    expect(processor.snapshot().carSpeeds).toEqual([0, 0]);
  });

  it('gives an iRacing frame, with no measured speed, the speeds it always has', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session('3.59 km'));
    const sequence: [number[], number][] = [
      [[0.1, 0.5, -1, 0.95], 1],
      [[0.11, 0.502, -1, 0.97], 1.1],
      [[0.125, 0.5, -1, 0.995], 1.25],
      [[0.13, 0.51, -1, 0.005], 1.3],
      [[0.13, 0.51, -1, 0.006], 1.32],
      [[0.15, 0.52, -1, 0.02], 1.45],
      [[0.16, 0.53, -1, 0.03], 1.5],
      [[0.17, 0.53, -1, 0.04], 1.6],
      [[0.18, 0.531, -1, 0.05], 1.7],
    ];
    const speeds = sequence.map(([lapDistPct, sessionTime]) => {
      const iracingFrame = frame(lapDistPct, sessionTime);
      expect(iracingFrame.LmuCarIdxSpeed).toBeUndefined();
      processor.onFrame(iracingFrame);
      return processor.snapshot().carSpeeds;
    });
    expect(speeds).toEqual([
      [0, 0, 0, 0],
      [1292, 258, 0, 2585],
      [1292, 43, 0, 2369],
      [1292, 890, 0, 2441],
      [1292, 890, 0, 2441],
      [1400, 883, 0, 2154],
      [1637, 1223, 0, 2240],
      [1637, 1172, 0, 1982],
      [1637, 1232, 0, 1809],
    ]);
  });
});

describe('CarSpeedsProcessor with LMU measured speeds', () => {
  const lmuFrame = (
    lapDistPct: number[],
    speedsMs: number[],
    sessionTime: number
  ) =>
    ({
      ...frame(lapDistPct, sessionTime),
      LmuCarIdxSpeed: { value: speedsMs },
    }) as unknown as Telemetry;

  it('averages the measured speed instead of differentiating position', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0.1, 0.2], [50, 10], 1));
    expect(processor.snapshot().carSpeeds).toEqual([180, 36]);
    processor.onFrame(lmuFrame([0.1, 0.2], [50, 10], 1.1));
    expect(processor.snapshot().carSpeeds).toEqual([180, 36]);
    processor.onFrame(lmuFrame([0.1, 0.2], [55, 0], 1.2));
    expect(processor.snapshot().carSpeeds).toEqual([186, 24]);
  });

  it('uses the measured speed of a car that joins the field', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0.1], [50], 1));
    processor.onFrame(lmuFrame([0.1, 0.5], [50, 40], 1.1));
    expect(processor.snapshot().carSpeeds).toEqual([180, 144]);
  });

  it('keeps a moving car moving while its lap position is held', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0], [52], 1));
    for (let tick = 1; tick <= 10; tick += 1) {
      processor.onFrame(lmuFrame([0], [52], 1 + tick * 0.1));
    }
    expect(processor.snapshot().carSpeeds).toEqual([187]);
  });

  it('falls back to position for a car without a measured speed', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0.1, 0.2], [-1, 50], 1));
    processor.onFrame(lmuFrame([0.11, 0.2], [-1, 50], 1.1));
    expect(processor.snapshot().carSpeeds).toEqual([360, 180]);
  });

  it('falls back to position for a car whose measured speed is not a finite number', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0.1, 0.2, 0.3], [NaN, Infinity, 0], 1));
    processor.onFrame(lmuFrame([0.11, 0.21, 0.31], [NaN, Infinity, 0], 1.1));
    expect(processor.snapshot().carSpeeds).toEqual([360, 360, 0]);
  });

  it('falls back to position for a slot the measured array does not reach', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(lmuFrame([0.1, 0.2], [50], 1));
    processor.onFrame(lmuFrame([0.1, 0.21], [50], 1.1));
    expect(processor.snapshot().carSpeeds).toEqual([180, 360]);
  });
});
