import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { ReferenceLapProcessor } from './ReferenceLapProcessor';

const session = () =>
  ({
    WeekendInfo: { SeriesID: 7, TrackID: 9, TrackLength: '1 km' },
    DriverInfo: {
      PaceCarIdx: -1,
      Drivers: [{ CarIdx: 0, CarClassID: 12 }],
    },
  }) as Session;

const frame = (
  lapDistPct: number,
  sessionTime: number,
  sessionNum = 1,
  onPitRoad = false
) =>
  ({
    CarIdxLapDistPct: { value: [lapDistPct] },
    CarIdxOnPitRoad: { value: [onPitRoad] },
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

/** Drives a full clean lap for car 0 through the given frame factory. */
const runCleanLap = (
  processor: ReferenceLapProcessor,
  makeFrame: (lapDistPct: number, sessionTime: number) => Telemetry
) => {
  processor.onFrame(makeFrame(0.001, 0));
  processor.onFrame(makeFrame(0.001, 0.01));
  for (let point = 1; point < 100; point += 1) {
    processor.onFrame(makeFrame((point + 0.1) / 100, point * 0.6));
  }
  processor.onFrame(makeFrame(0.001, 60));
};

describe('ReferenceLapProcessor', () => {
  it('promotes and persists a complete clean lap', () => {
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({ load: () => null, save });
    processor.init(session());
    processor.onFrame(frame(0.001, 0));
    processor.onFrame(frame(0.001, 0.01));
    for (let point = 1; point < 100; point += 1) {
      processor.onFrame(frame((point + 0.1) / 100, point * 0.6));
    }
    processor.onFrame(frame(0.001, 60));

    const snapshot = processor.snapshot();
    expect(snapshot.bestLaps).toHaveLength(1);
    expect(snapshot.persistedLaps).toHaveLength(1);
    expect(snapshot.bestLaps[0][1].finishTime).toBe(60);
    expect(snapshot.bestLaps[0][1].tangents.every(Number.isFinite)).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it('promotes CarClassID 0 laps in memory but never persists them', () => {
    // iRacing reports CarClassID 0 in test sessions. Class-0 laps from
    // different cars would all collide on one seriesId_trackId_0 disk key, so
    // persistence is skipped — but the session best still has to be usable.
    const classlessSession = session();
    classlessSession.DriverInfo.Drivers[0].CarClassID = 0;
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({ load: () => null, save });
    processor.init(classlessSession);
    runCleanLap(processor, (pct, time) => frame(pct, time));

    expect(processor.snapshot().bestLaps).toHaveLength(1);
    expect(processor.snapshot().persistedLaps).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('records offline-session laps in memory without persisting them', () => {
    // Offline sessions — AI races, test sessions, hosted practice — report
    // SeriesID 0. That is a real session, not missing data, so laps must still
    // be collected; only the disk key (seriesId_trackId_classId) is meaningless
    // there, so persistence is what gets skipped.
    const offlineSession = session();
    offlineSession.WeekendInfo.SeriesID = 0;
    const save = vi.fn();
    const load = vi.fn(() => null);
    const processor = new ReferenceLapProcessor({ load, save });
    processor.init(offlineSession);
    runCleanLap(processor, (pct, time) => frame(pct, time));

    expect(processor.snapshot().bestLaps).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects a lap that enters pit road', () => {
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({ load: () => null, save });
    processor.init(session());
    processor.onFrame(frame(0.001, 0));
    processor.onFrame(frame(0.001, 0.01));
    for (let point = 1; point < 100; point += 1) {
      processor.onFrame(frame((point + 0.1) / 100, point, 1, point === 50));
    }
    processor.onFrame(frame(0.001, 100));
    expect(processor.snapshot().bestLaps).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a lap with unsampled tail buckets', () => {
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({ load: () => null, save });
    processor.init(session());
    processor.onFrame(frame(0.001, 0));
    processor.onFrame(frame(0.001, 0.01));
    for (let point = 1; point < 96; point += 1) {
      processor.onFrame(frame((point + 0.1) / 100, point * 0.6));
    }
    processor.onFrame(frame(0.001, 60));

    expect(processor.snapshot().bestLaps).toEqual([]);
    expect(processor.snapshot().persistedLaps).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('loads persisted class laps and resets session-derived bests', () => {
    const persisted = {
      startTime: 0,
      finishTime: 60,
      times: new Float32Array(2),
      pointPos: new Float32Array(2),
      tangents: new Float32Array(2),
      interval: 0.5,
      pointsCount: 2,
      lastTrackedPct: 0.99,
      isCleanLap: true,
    };
    const processor = new ReferenceLapProcessor({
      load: () => persisted,
      save: vi.fn(),
    });
    processor.init(session());
    expect(processor.snapshot().persistedLaps).toEqual([[12, persisted]]);
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toMatchObject({
      bestLaps: [],
      persistedLaps: [[12, persisted]],
    });
  });

  it('loads persisted laps for classes that join mid-session', () => {
    const persisted = {
      startTime: 0,
      finishTime: 60,
      times: new Float32Array(2),
      pointPos: new Float32Array(2),
      tangents: new Float32Array(2),
      interval: 0.5,
      pointsCount: 2,
      lastTrackedPct: 0.99,
      isCleanLap: true,
    };
    const load = vi.fn((_seriesId, _trackId, classId) =>
      classId === 13 ? persisted : null
    );
    const processor = new ReferenceLapProcessor({ load, save: vi.fn() });
    const updatedSession = session();
    processor.init(updatedSession);
    updatedSession.DriverInfo.Drivers.push({
      CarIdx: 1,
      CarClassID: 13,
    } as never);
    processor.init(updatedSession);

    expect(load).toHaveBeenCalledWith(7, 9, 13);
    expect(processor.snapshot().persistedLaps).toContainEqual([13, persisted]);
  });

  it('does not aggregate or persist replay-scrubbed telemetry', () => {
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({ load: () => null, save });
    processor.init(session());
    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame(0, 0));
    processor.onFrame(frame(0.99, 60));
    processor.onFrame(frame(0.01, 61));
    expect(processor.snapshot().bestLaps).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it('skips sparse driver entries without stopping telemetry processing', () => {
    const sparseSession = session();
    sparseSession.DriverInfo.Drivers = [
      undefined,
      { CarIdx: 1, CarClassID: 12 },
    ] as unknown as Session['DriverInfo']['Drivers'];
    const save = vi.fn();
    const processor = new ReferenceLapProcessor({
      load: () => null,
      save,
    });

    expect(() => processor.init(sparseSession)).not.toThrow();
    const sparseFrame = (pct: number, time: number) =>
      ({
        CarIdxLapDistPct: { value: [-1, pct] },
        CarIdxOnPitRoad: { value: [false, false] },
        SessionTime: { value: [time] },
        SessionNum: { value: [1] },
      }) as unknown as Telemetry;
    expect(() => processor.onFrame(sparseFrame(0.001, 0))).not.toThrow();
    processor.onFrame(sparseFrame(0.001, 0.01));
    for (let point = 1; point < 100; point += 1) {
      processor.onFrame(sparseFrame((point + 0.1) / 100, point * 0.6));
    }
    processor.onFrame(sparseFrame(0.001, 60));

    expect(processor.snapshot().bestLaps[0]?.[0]).toBe(1);
    expect(save).toHaveBeenCalledOnce();
  });

  it('reads telemetry arrays directly without mapping per frame', () => {
    const processor = new ReferenceLapProcessor({
      load: () => null,
      save: vi.fn(),
    });
    processor.init(session());
    const distances = [0.001];
    const pitRoad = [false];
    distances.map = vi.fn(() => {
      throw new Error('distance array copied');
    });
    pitRoad.map = vi.fn(() => {
      throw new Error('pit-road array copied');
    });

    expect(() =>
      processor.onFrame({
        CarIdxLapDistPct: { value: distances },
        CarIdxOnPitRoad: { value: pitRoad },
        SessionTime: { value: [0] },
        SessionNum: { value: [1] },
      } as unknown as Telemetry)
    ).not.toThrow();
    expect(distances.map).not.toHaveBeenCalled();
    expect(pitRoad.map).not.toHaveBeenCalled();
  });
});
