import { describe, expect, it } from 'vitest';
import type { LapHistorySnapshot, Session, Telemetry } from '@irdashies/types';
import {
  LAP_CROSSING_IN_PIT,
  LAP_CROSSING_LAPPED,
  LAP_CROSSING_OFF_TRACK,
  LAP_HISTORY_CAPACITY,
  TrackLocation,
} from '@irdashies/types';
import { LapHistoryProcessor } from './LapHistoryProcessor';

interface FrameFixture {
  sessionTime?: number;
  sessionNum?: number;
  laps: number[];
  classPositions?: number[];
  onPitRoad?: boolean[];
  trackSurface?: number[];
}

const frame = (fixture: FrameFixture): Telemetry =>
  ({
    SessionTime: { value: [fixture.sessionTime ?? 0] },
    SessionNum: { value: [fixture.sessionNum ?? 0] },
    CarIdxLap: { value: fixture.laps },
    CarIdxClassPosition: {
      value: fixture.classPositions ?? fixture.laps.map(() => 1),
    },
    CarIdxOnPitRoad: {
      value: fixture.onPitRoad ?? fixture.laps.map(() => false),
    },
    CarIdxTrackSurface: {
      value:
        fixture.trackSurface ?? fixture.laps.map(() => TrackLocation.OnTrack),
    },
  }) as unknown as Telemetry;

const session = (): Session => ({}) as unknown as Session;

interface Crossing {
  lap: number;
  sessionTime: number;
  classPosition: number;
  flags: number;
}

/** Reads a car's ring buffer back in oldest-to-newest order. */
const crossings = (
  snapshot: LapHistorySnapshot,
  carIdx: number
): Crossing[] => {
  const out: Crossing[] = [];
  for (let i = 0; i < snapshot.count[carIdx]; i += 1) {
    const offset = (snapshot.start[carIdx] + i) % snapshot.capacity;
    const slot = carIdx * snapshot.capacity + offset;
    out.push({
      lap: snapshot.lap[slot],
      sessionTime: snapshot.sessionTime[slot],
      classPosition: snapshot.classPosition[slot],
      flags: snapshot.flags[slot],
    });
  }
  return out;
};

const run = (frames: Telemetry[]): LapHistoryProcessor => {
  const processor = new LapHistoryProcessor();
  processor.init(session());
  frames.forEach((f) => processor.onFrame(f));
  return processor;
};

describe('LapHistoryProcessor', () => {
  it('declares an event tick rate on the lap-history channel', () => {
    const processor = new LapHistoryProcessor();
    expect(processor.channel).toBe('lap-history.snapshot');
    expect(processor.tickRateHz).toBe('event');
  });

  it('records lap, session time and class position for a normal crossing', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4], classPositions: [3] }),
      frame({ sessionTime: 190.5, laps: [5], classPositions: [2] }),
    ]);

    expect(crossings(processor.snapshot(), 0)).toEqual([
      { lap: 4, sessionTime: 190.5, classPosition: 2, flags: 0 },
    ]);
  });

  it('does not record a crossing on the first frame a car is seen', () => {
    const processor = run([frame({ sessionTime: 100, laps: [4] })]);

    expect(processor.snapshot().count[0]).toBe(0);
  });

  it('flags a pit lap and keeps the real crossing time', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4] }),
      frame({
        sessionTime: 231.75,
        laps: [5],
        onPitRoad: [true],
        trackSurface: [TrackLocation.InPitStall],
      }),
    ]);

    const [crossing] = crossings(processor.snapshot(), 0);
    expect(crossing.flags & LAP_CROSSING_IN_PIT).toBe(LAP_CROSSING_IN_PIT);
    // The pit lap keeps its measured time. Nothing is defaulted or zeroed.
    expect(crossing.sessionTime).toBe(231.75);
    expect(crossing.lap).toBe(4);
  });

  it('flags an off-track crossing', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4] }),
      frame({
        sessionTime: 260,
        laps: [5],
        trackSurface: [TrackLocation.OffTrack],
      }),
    ]);

    const [crossing] = crossings(processor.snapshot(), 0);
    expect(crossing.flags & LAP_CROSSING_OFF_TRACK).toBe(
      LAP_CROSSING_OFF_TRACK
    );
    expect(crossing.flags & LAP_CROSSING_IN_PIT).toBe(0);
    expect(crossing.sessionTime).toBe(260);
  });

  it('flags a car that is laps down to the leader', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [20, 4] }),
      frame({ sessionTime: 190, laps: [20, 5] }),
    ]);

    const [crossing] = crossings(processor.snapshot(), 1);
    expect(crossing.flags & LAP_CROSSING_LAPPED).toBe(LAP_CROSSING_LAPPED);
  });

  it('does not flag the leader as a lap down on its own crossing', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [20, 4] }),
      frame({ sessionTime: 190, laps: [21, 4] }),
    ]);

    const [crossing] = crossings(processor.snapshot(), 0);
    expect(crossing.lap).toBe(20);
    expect(crossing.flags & LAP_CROSSING_LAPPED).toBe(0);
  });

  it('does not flag a car on the leader lap', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [20, 19] }),
      frame({ sessionTime: 190, laps: [20, 20] }),
    ]);

    const [crossing] = crossings(processor.snapshot(), 1);
    expect(crossing.flags & LAP_CROSSING_LAPPED).toBe(0);
  });

  it('re-baselines instead of recording when a lap counter goes backwards', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [8] }),
      // Tow or reset - the counter drops. No crossing, new baseline.
      frame({ sessionTime: 150, laps: [2] }),
      frame({ sessionTime: 240, laps: [3] }),
    ]);

    expect(crossings(processor.snapshot(), 0)).toEqual([
      expect.objectContaining({ lap: 2, sessionTime: 240 }),
    ]);
  });

  it('records nothing while the lap counter is unchanged', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4] }),
      frame({ sessionTime: 110, laps: [4] }),
      frame({ sessionTime: 120, laps: [4] }),
    ]);

    expect(processor.snapshot().count[0]).toBe(0);
  });

  it('resets recorded counts when the session number changes mid-record', () => {
    const processor = run([
      frame({ sessionNum: 0, sessionTime: 100, laps: [4] }),
      frame({ sessionNum: 0, sessionTime: 190, laps: [5] }),
      frame({ sessionNum: 0, sessionTime: 280, laps: [6] }),
    ]);
    expect(processor.snapshot().count[0]).toBe(2);

    processor.onFrame(frame({ sessionNum: 1, sessionTime: 10, laps: [1] }));

    expect(processor.snapshot().count[0]).toBe(0);
    expect(processor.snapshot().sessionNum).toBe(1);

    processor.onFrame(frame({ sessionNum: 1, sessionTime: 95, laps: [2] }));
    expect(crossings(processor.snapshot(), 0)).toEqual([
      expect.objectContaining({ lap: 1, sessionTime: 95 }),
    ]);
  });

  it('stops aggregating on a replay enter and resumes on a live enter', () => {
    const processor = new LapHistoryProcessor();
    processor.init(session());
    processor.onFrame(frame({ sessionTime: 100, laps: [4] }));
    processor.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(processor.snapshot().count[0]).toBe(1);

    processor.onLifecycle({ type: 'enter', replay: true });
    expect(processor.snapshot().count[0]).toBe(0);

    // Replay scrubbing rewinds lap counters; none of this may be recorded.
    processor.onFrame(frame({ sessionTime: 50, laps: [2] }));
    processor.onFrame(frame({ sessionTime: 140, laps: [3] }));
    processor.onFrame(frame({ sessionTime: 230, laps: [4] }));
    expect(processor.snapshot().count[0]).toBe(0);

    processor.onLifecycle({ type: 'enter', replay: false });
    processor.onFrame(frame({ sessionTime: 100, laps: [4] }));
    processor.onFrame(frame({ sessionTime: 190, laps: [5] }));
    expect(crossings(processor.snapshot(), 0)).toEqual([
      expect.objectContaining({ lap: 4, sessionTime: 190 }),
    ]);
  });

  it('clears recorded crossings on disconnect', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4] }),
      frame({ sessionTime: 190, laps: [5] }),
    ]);
    expect(processor.snapshot().count[0]).toBe(1);

    processor.onLifecycle({ type: 'disconnect' });

    expect(processor.snapshot().count[0]).toBe(0);
    expect(processor.snapshot().sessionNum).toBeNull();
  });

  it('drops the oldest crossing once the ring buffer is full', () => {
    const processor = new LapHistoryProcessor();
    processor.init(session());
    const overflow = 2;
    const total = LAP_HISTORY_CAPACITY + overflow;

    // Lap 0 only sets the baseline, so total + 1 frames give `total` crossings.
    for (let lap = 0; lap <= total; lap += 1) {
      processor.onFrame(frame({ sessionTime: lap * 90, laps: [lap] }));
    }

    const snapshot = processor.snapshot();
    expect(snapshot.count[0]).toBe(LAP_HISTORY_CAPACITY);
    expect(snapshot.start[0]).toBe(overflow);

    const retained = crossings(snapshot, 0);
    expect(retained).toHaveLength(LAP_HISTORY_CAPACITY);
    // The oldest crossings (laps 0 and 1) were the ones dropped.
    expect(retained[0].lap).toBe(overflow);
    expect(retained[0].sessionTime).toBe((overflow + 1) * 90);
    expect(retained[retained.length - 1].lap).toBe(total - 1);
    expect(retained[retained.length - 1].sessionTime).toBe(total * 90);
    expect(retained.map((c) => c.lap)).toEqual(
      Array.from({ length: LAP_HISTORY_CAPACITY }, (_, i) => i + overflow)
    );
  });

  it('keeps per-car buffers independent', () => {
    const processor = run([
      frame({ sessionTime: 100, laps: [4, 9, 1] }),
      frame({ sessionTime: 190, laps: [5, 9, 2], classPositions: [1, 2, 3] }),
    ]);

    const snapshot = processor.snapshot();
    expect(snapshot.count[0]).toBe(1);
    expect(snapshot.count[1]).toBe(0);
    expect(snapshot.count[2]).toBe(1);
    expect(crossings(snapshot, 0)[0].classPosition).toBe(1);
    expect(crossings(snapshot, 2)[0].classPosition).toBe(3);
  });

  it('reuses one snapshot object so a crossing allocates nothing', () => {
    const processor = new LapHistoryProcessor();
    processor.init(session());
    processor.onFrame(frame({ sessionTime: 100, laps: [4] }));

    const first = processor.snapshot();
    const buffers = {
      count: first.count,
      start: first.start,
      lap: first.lap,
      sessionTime: first.sessionTime,
      classPosition: first.classPosition,
      flags: first.flags,
    };
    const firstVersion = first.version;

    for (let lap = 5; lap < 15; lap += 1) {
      processor.onFrame(frame({ sessionTime: lap * 90, laps: [lap] }));
      // Same object, same backing buffers - only the version counter moves.
      expect(processor.snapshot()).toBe(first);
      expect(processor.snapshot().count).toBe(buffers.count);
      expect(processor.snapshot().start).toBe(buffers.start);
      expect(processor.snapshot().lap).toBe(buffers.lap);
      expect(processor.snapshot().sessionTime).toBe(buffers.sessionTime);
      expect(processor.snapshot().classPosition).toBe(buffers.classPosition);
      expect(processor.snapshot().flags).toBe(buffers.flags);
    }

    expect(processor.snapshot().version).toBe(firstVersion + 10);
  });
});
