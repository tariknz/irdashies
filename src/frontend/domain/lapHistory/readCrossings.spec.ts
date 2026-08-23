import { describe, expect, it } from 'vitest';
import type { LapHistorySnapshot } from '@irdashies/types';
import {
  LAP_CROSSING_IN_PIT,
  LAP_CROSSING_LAPPED,
  LAP_CROSSING_OFF_TRACK,
} from '@irdashies/types';
import { readCrossings } from './readCrossings';

const CAR_COUNT = 4;
const CAPACITY = 5;

type MutableSnapshot = LapHistorySnapshot & {
  count: number[];
  start: number[];
  lap: number[];
  sessionTime: number[];
  classPosition: number[];
  flags: number[];
};

const zeroes = (length: number) => new Array<number>(length).fill(0);

const createSnapshot = (): MutableSnapshot => ({
  carCount: CAR_COUNT,
  capacity: CAPACITY,
  count: zeroes(CAR_COUNT),
  start: zeroes(CAR_COUNT),
  lap: zeroes(CAR_COUNT * CAPACITY),
  sessionTime: zeroes(CAR_COUNT * CAPACITY),
  classPosition: zeroes(CAR_COUNT * CAPACITY),
  flags: zeroes(CAR_COUNT * CAPACITY),
  sessionNum: 1,
  version: 1,
});

const writeSlot = (
  snapshot: MutableSnapshot,
  carIdx: number,
  offset: number,
  crossing: {
    lap: number;
    sessionTime: number;
    classPosition?: number;
    flags?: number;
  }
) => {
  const slot = carIdx * snapshot.capacity + offset;
  snapshot.lap[slot] = crossing.lap;
  snapshot.sessionTime[slot] = crossing.sessionTime;
  snapshot.classPosition[slot] = crossing.classPosition ?? 0;
  snapshot.flags[slot] = crossing.flags ?? 0;
};

describe('readCrossings', () => {
  it('reads a buffer that has not wrapped in oldest-first order', () => {
    const snapshot = createSnapshot();
    snapshot.count[0] = 3;
    snapshot.start[0] = 0;
    writeSlot(snapshot, 0, 0, { lap: 1, sessionTime: 100, classPosition: 5 });
    writeSlot(snapshot, 0, 1, { lap: 2, sessionTime: 190, classPosition: 4 });
    writeSlot(snapshot, 0, 2, { lap: 3, sessionTime: 280, classPosition: 3 });

    const crossings = readCrossings(snapshot, 0);

    expect(crossings.map((c) => c.lap)).toEqual([1, 2, 3]);
    expect(crossings.map((c) => c.sessionTime)).toEqual([100, 190, 280]);
    expect(crossings.map((c) => c.classPosition)).toEqual([5, 4, 3]);
  });

  it('reads a wrapped buffer in oldest-first order', () => {
    const snapshot = createSnapshot();
    // Ring is full and the oldest entry sits at offset 3.
    snapshot.count[1] = CAPACITY;
    snapshot.start[1] = 3;
    const laps = [10, 11, 12, 13, 14];
    laps.forEach((lap, i) => {
      writeSlot(snapshot, 1, (3 + i) % CAPACITY, {
        lap,
        sessionTime: 1000 + i * 90,
      });
    });

    const crossings = readCrossings(snapshot, 1);

    expect(crossings.map((c) => c.lap)).toEqual([10, 11, 12, 13, 14]);
    expect(crossings.map((c) => c.sessionTime)).toEqual([
      1000, 1090, 1180, 1270, 1360,
    ]);
  });

  it('ignores slots beyond count in a partially filled wrapped buffer', () => {
    const snapshot = createSnapshot();
    snapshot.count[1] = 2;
    snapshot.start[1] = 4;
    writeSlot(snapshot, 1, 4, { lap: 20, sessionTime: 500 });
    writeSlot(snapshot, 1, 0, { lap: 21, sessionTime: 590 });
    // Stale data left in the slots the ring has not reached yet.
    writeSlot(snapshot, 1, 1, { lap: 99, sessionTime: 9999 });

    expect(readCrossings(snapshot, 1).map((c) => c.lap)).toEqual([20, 21]);
  });

  it('returns empty for a car with no crossings', () => {
    const snapshot = createSnapshot();

    expect(readCrossings(snapshot, 2)).toEqual([]);
  });

  it('returns empty for an out of range car index', () => {
    const snapshot = createSnapshot();
    snapshot.count[0] = 1;
    writeSlot(snapshot, 0, 0, { lap: 1, sessionTime: 100 });

    expect(readCrossings(snapshot, -1)).toEqual([]);
    expect(readCrossings(snapshot, CAR_COUNT)).toEqual([]);
    expect(readCrossings(snapshot, 1.5)).toEqual([]);
  });

  it('decodes the crossing flags', () => {
    const snapshot = createSnapshot();
    snapshot.count[0] = 3;
    writeSlot(snapshot, 0, 0, {
      lap: 1,
      sessionTime: 100,
      flags: LAP_CROSSING_IN_PIT,
    });
    writeSlot(snapshot, 0, 1, {
      lap: 2,
      sessionTime: 190,
      flags: LAP_CROSSING_OFF_TRACK | LAP_CROSSING_LAPPED,
    });
    writeSlot(snapshot, 0, 2, { lap: 3, sessionTime: 280, flags: 0 });

    const crossings = readCrossings(snapshot, 0);

    expect(crossings[0]).toMatchObject({
      inPit: true,
      offTrack: false,
      lapped: false,
    });
    expect(crossings[1]).toMatchObject({
      inPit: false,
      offTrack: true,
      lapped: true,
    });
    expect(crossings[2]).toMatchObject({
      inPit: false,
      offTrack: false,
      lapped: false,
    });
  });
});

describe('readCrossings with a count beyond capacity', () => {
  it('never returns more crossings than the ring can hold', () => {
    // A file written by a build with a larger capacity would otherwise wrap the
    // ring and repeat crossings into the lap times and gaps.
    const snapshot = {
      carCount: 1,
      capacity: 3,
      count: [10],
      start: [0],
      lap: [1, 2, 3],
      sessionTime: [10, 20, 30],
      classPosition: [1, 1, 1],
      flags: [0, 0, 0],
      sessionNum: 2,
      version: 1,
    };

    const crossings = readCrossings(snapshot, 0);

    expect(crossings).toHaveLength(3);
    expect(crossings.map((c) => c.lap)).toEqual([1, 2, 3]);
  });
});
