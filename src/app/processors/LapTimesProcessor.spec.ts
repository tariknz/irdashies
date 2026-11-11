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

  it('caps each car history at 100 samples while keeping pace on ten', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(frame([90]));
    for (let lap = 1; lap <= 102; lap += 1) {
      processor.onFrame(frame([90 + lap / 10]));
    }
    expect(processor.snapshot().lapTimeHistory[0]).toHaveLength(100);
    expect(processor.snapshot().lapTimeHistory[0][0]).toBe(90.3);
    expect(processor.snapshot().lapTimes[0]).toBeCloseTo(99.75);
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
      lapTimes: [0],
      lapTimeHistory: [[]],
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

  const timedFrame = (
    time: number,
    completed: number,
    lastTime: number,
    pit = false
  ) =>
    ({
      ...frame([lastTime]),
      SessionTime: { value: [time] },
      CarIdxLapCompleted: { value: [completed] },
      CarIdxOnPitRoad: { value: [pit] },
    }) as unknown as Telemetry;

  it('waits for delayed official times and counts identical consecutive laps once', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(0, 0, -1));
    processor.onFrame(timedFrame(90, 1, -1));
    expect(processor.snapshot().lapTimeHistory).toEqual([[]]);
    processor.onFrame(timedFrame(92, 1, 90));
    processor.onFrame(timedFrame(180, 2, 90));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90]]);
    processor.onFrame(timedFrame(185, 2, 90));
    processor.onFrame(timedFrame(186, 2, 90));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90]]);
    processor.onFrame(timedFrame(270, 3, 90));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90, 90]]);
    expect(processor.snapshot().cleanLapTimeHistory).toEqual([[90]]);
  });

  it('does not reuse a stale time during a late counter correction from fuel-test', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(2344.617, 25, 79.4656));
    processor.onFrame(timedFrame(2423.233, 26, 79.4656));
    processor.onFrame(timedFrame(2424.917, 26, 79.8159));
    processor.onFrame(timedFrame(2503.367, 27, 79.8159));
    processor.onFrame(timedFrame(2508.367, 26, 79.8159));
    processor.onFrame(timedFrame(2509.417, 27, 80.1309));
    expect(processor.snapshot().lapTimeHistory).toEqual([[79.8159, 80.1309]]);
  });

  it('excludes both pit laps, even when the timing update arrives after pit exit', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(0, 0, -1));
    processor.onFrame(timedFrame(90, 1, 90)); // partial first lap
    processor.onFrame(timedFrame(180, 2, 89)); // full clean lap
    processor.onFrame(timedFrame(250, 2, 89, true)); // in-lap
    processor.onFrame(timedFrame(280, 3, 89, true));
    processor.onFrame(timedFrame(282, 3, -1, true)); // invalid official in-lap
    processor.onFrame(timedFrame(320, 3, -1)); // out of pits, still out-lap
    processor.onFrame(timedFrame(400, 4, -1));
    processor.onFrame(timedFrame(402, 4, 120));
    processor.onFrame(timedFrame(490, 5, 90));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90, 89, 120, 90]]);
    expect(processor.snapshot().cleanLapTimeHistory).toEqual([[89, 90]]);
  });

  it('remembers pit road between crossings even when the entire stop is within one lap', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(0, 0, -1));
    processor.onFrame(timedFrame(90, 1, 90));
    processor.onFrame(timedFrame(120, 1, 90, true));
    processor.onFrame(timedFrame(160, 1, 90));
    processor.onFrame(timedFrame(210, 2, 120));
    processor.onFrame(timedFrame(300, 3, 90));
    expect(processor.snapshot().cleanLapTimeHistory).toEqual([[90]]);
  });

  it('discards unfinished timing after a counter reset, a jump or a replay rewind', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(0, 0, -1));
    processor.onFrame(timedFrame(90, 1, 90));
    processor.onFrame(timedFrame(100, -1, -1));
    processor.onFrame(timedFrame(200, 3, 100));
    processor.onFrame(timedFrame(201, 3, 100));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90]]);
    processor.onFrame(timedFrame(210, -1, -1));
    processor.onFrame(timedFrame(220, 0, -1));
    processor.onFrame(timedFrame(310, 1, 91));
    expect(processor.snapshot().lapTimeHistory).toEqual([[90, 91]]);
    processor.onFrame(timedFrame(50, 0, -1));
    expect(processor.snapshot().lapTimeHistory).toEqual([[]]);
    expect(processor.snapshot().cleanLapTimeHistory).toEqual([[]]);
  });

  it('retains immutable snapshots and caps eligible history independently', () => {
    const processor = new LapTimesProcessor();
    processor.onFrame(timedFrame(0, 0, -1));
    processor.onFrame(timedFrame(90, 1, 90));
    const before = processor.snapshot();
    for (let lap = 2; lap <= 105; lap++) {
      processor.onFrame(timedFrame(lap * 100, lap, 90 + lap / 100));
    }
    expect(before.lapTimeHistory).toEqual([[90]]);
    expect(processor.snapshot().cleanLapTimeHistory?.[0]).toHaveLength(100);
    expect(processor.snapshot().lapTimeHistory[0]).toHaveLength(100);
  });
});
