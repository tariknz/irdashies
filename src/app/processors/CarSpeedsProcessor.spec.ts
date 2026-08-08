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
  it('derives smoothed km/h speeds at 10 Hz', () => {
    const processor = new CarSpeedsProcessor();
    processor.init(session());
    processor.onFrame(frame([0.1], 1));
    processor.onFrame(frame([0.11], 1.05));
    expect(processor.snapshot().carSpeeds).toEqual([0]);
    processor.onFrame(frame([0.11], 1.1));
    expect(processor.snapshot().carSpeeds[0]).toBe(360);
    processor.onFrame(frame([0.125], 1.2));
    expect(processor.snapshot().carSpeeds[0]).toBe(450);
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
});
