import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { LapTimesProcessor } from './LapTimesProcessor';

const frame = (lapTimes: readonly number[], sessionNum = 1) =>
  ({
    CarIdxLastLapTime: { value: [...lapTimes] },
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

describe('LapTimesProcessor', () => {
  it('uses the first frame as a baseline and records only changed valid laps', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90.5, 91.2]));
    expect(processor.snapshot()).toMatchObject({
      lapTimes: [0, 0],
      lapTimeHistory: [[], []],
      sessionNum: 1,
    });

    processor.onFrame(frame([89.8, 0]));
    expect(processor.snapshot()).toMatchObject({
      lapTimes: [89.8, 0],
      lapTimeHistory: [[89.8], []],
    });
  });

  it('preserves the renderer median and standard-deviation outlier behavior', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90.5, 91.2]));
    for (const values of [
      [89.8, 120],
      [90.2, 91],
      [89.9, 91.1],
      [90.1, 91.3],
    ]) {
      processor.onFrame(frame(values));
    }

    expect(processor.snapshot().lapTimes[0]).toBeCloseTo(90, 3);
    expect(processor.snapshot().lapTimes[1]).toBeCloseTo(91.1, 3);
  });

  it('caps each car history at ten samples', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90]));
    for (let lap = 1; lap <= 12; lap += 1) {
      processor.onFrame(frame([90 + lap / 10]));
    }
    expect(processor.snapshot().lapTimeHistory[0]).toHaveLength(10);
    expect(processor.snapshot().lapTimeHistory[0][0]).toBe(90.3);
  });

  it('resets on session transitions before accepting a new baseline', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90], 1));
    processor.onFrame(frame([89], 1));
    processor.onLifecycle({ type: 'sessionNumChange' });
    processor.onFrame(frame([89], 2));

    expect(processor.snapshot()).toMatchObject({
      lapTimes: [0],
      lapTimeHistory: [[]],
      sessionNum: 2,
    });
  });

  it('resets when SessionNum changes between frames', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90], 1));
    processor.onFrame(frame([89], 1));
    processor.onFrame(frame([88], 2));

    expect(processor.snapshot()).toMatchObject({
      lapTimes: [],
      lapTimeHistory: [],
      sessionNum: 2,
    });
  });

  it('stops aggregating after a disconnect', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90]));
    processor.onLifecycle({ type: 'disconnect' });
    processor.onFrame(frame([89]));

    expect(processor.snapshot()).toMatchObject({
      lapTimes: [],
      lapTimeHistory: [],
      sessionNum: null,
    });
  });

  it('does not aggregate replay scrubbing but can resume for live data', () => {
    const processor = new LapTimesProcessor();
    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame([90]));
    expect(processor.snapshot().lapTimeHistory).toEqual([]);

    processor.onLifecycle({ type: 'enter', replay: false });
    processor.onFrame(frame([90]));
    processor.onFrame(frame([89]));
    expect(processor.snapshot().lapTimeHistory).toEqual([[89]]);
  });

  it('preserves existing histories when the driver array grows', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90]));
    processor.onFrame(frame([89]));
    processor.onFrame(frame([89, 92]));
    expect(processor.snapshot()).toMatchObject({
      lapTimes: [89, 0],
      lapTimeHistory: [[89], []],
    });
  });
});
