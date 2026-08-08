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
    expect(snapshot.bestLaps[0][1].tangents.some(Number.isFinite)).toBe(true);
    expect(save).toHaveBeenCalledOnce();
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
});
