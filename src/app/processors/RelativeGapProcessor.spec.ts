import { describe, expect, it } from 'vitest';
import type {
  ReferenceLapsSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { RelativeGapProcessor } from './RelativeGapProcessor';

const emptyReferences = (): ReferenceLapsSnapshot => ({
  bestLaps: [],
  persistedLaps: [],
  sessionNum: 1,
  version: 0,
});

const session = () =>
  ({
    DriverInfo: {
      DriverCarIdx: 0,
      Drivers: [
        { CarIdx: 0, CarClassID: 10, CarClassEstLapTime: 100 },
        { CarIdx: 1, CarClassID: 10, CarClassEstLapTime: 100 },
        { CarIdx: 2, CarClassID: 20, CarClassEstLapTime: 120 },
      ],
    },
  }) as Session;

const frame = ({
  pcts = [0.2, 0.25, 0.15],
  estimatedTimes = [20, 25, 18],
  laps = [4, 4, 4],
  pitRoad = [false, false, false],
  sessionTime = 1,
  sessionNum = 1,
  cameraCarIdx = 0,
}: Partial<{
  pcts: number[];
  estimatedTimes: number[];
  laps: number[];
  pitRoad: boolean[];
  sessionTime: number;
  sessionNum: number;
  cameraCarIdx: number;
}> = {}) =>
  ({
    CarIdxLapDistPct: { value: pcts },
    CarIdxEstTime: { value: estimatedTimes },
    CarIdxLap: { value: laps },
    CarIdxOnPitRoad: { value: pitRoad },
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [sessionNum] },
    CamCarIdx: { value: [cameraCarIdx] },
  }) as unknown as Telemetry;

describe('RelativeGapProcessor', () => {
  it('publishes signed relative distances and estimated-time deltas at 5 Hz', () => {
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(session());
    processor.onFrame(frame());

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: 0,
      deltas: [0, 5, -6],
      sessionNum: 1,
    });
    expect(processor.snapshot().relativePcts[1]).toBeCloseTo(0.05);
    expect(processor.snapshot().relativePcts[2]).toBeCloseTo(-0.05);
    const version = processor.snapshot().version;
    processor.onFrame(frame({ sessionTime: 1.1, pcts: [0.2, 0.3, 0.1] }));
    expect(processor.snapshot().version).toBe(version);
    processor.onFrame(frame({ sessionTime: 1.2, pcts: [0.2, 0.3, 0.1] }));
    expect(processor.snapshot().version).toBe(version + 1);
  });

  it('updates immediately when the camera focus changes while time is paused', () => {
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(session());
    processor.onFrame(frame({ sessionTime: 1, cameraCarIdx: 0 }));
    const version = processor.snapshot().version;

    processor.onFrame(frame({ sessionTime: 1, cameraCarIdx: 1 }));

    expect(processor.snapshot().focusCarIdx).toBe(1);
    expect(processor.snapshot().version).toBe(version + 1);
    expect(processor.snapshot().relativePcts[1]).toBe(0);
  });

  it('uses the behind car reference lap after its first three laps', () => {
    const referenceLap = {
      startTime: 0,
      finishTime: 100,
      times: new Float32Array([0, 25, 50, 75]),
      pointPos: new Float32Array([0, 0.25, 0.5, 0.75]),
      tangents: new Float32Array([100, 100, 100, 100]),
      interval: 0.25,
      pointsCount: 4,
      lastTrackedPct: 0.99,
      isCleanLap: true,
    };
    const references: ReferenceLapsSnapshot = {
      bestLaps: [[0, referenceLap]],
      persistedLaps: [],
      sessionNum: 1,
      version: 1,
    };
    const processor = new RelativeGapProcessor({
      snapshot: () => references,
    });
    processor.init(session());
    processor.onFrame(frame({ estimatedTimes: [5, 80, 18], laps: [4, 4, 4] }));

    expect(processor.snapshot().deltas[1]).toBeCloseTo(5);
  });

  it('falls back when class estimated lap times are invalid', () => {
    const invalidSession = session();
    invalidSession.DriverInfo.Drivers[0].CarClassEstLapTime = 0;
    invalidSession.DriverInfo.Drivers[1].CarClassEstLapTime = Number.NaN;
    invalidSession.DriverInfo.Drivers[2].CarClassEstLapTime = Infinity;
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(invalidSession);

    processor.onFrame(frame());

    expect(processor.snapshot().deltas).toEqual([0, 5, -2]);
    expect(
      processor.snapshot().deltas.every((delta) => Number.isFinite(delta))
    ).toBe(true);
  });

  it('follows the camera car and wraps track distance', () => {
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(session());
    processor.onFrame(
      frame({
        cameraCarIdx: 1,
        pcts: [0.98, 0.02, 0.4],
        estimatedTimes: [98, 2, 48],
      })
    );

    expect(processor.snapshot().focusCarIdx).toBe(1);
    expect(processor.snapshot().relativePcts[0]).toBeCloseTo(-0.04);
  });

  it('reuses its output buffers across processor ticks', () => {
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(session());
    processor.onFrame(frame());
    const first = processor.snapshot();
    processor.onFrame(frame({ sessionTime: 1.2, pcts: [0.2, 0.3, 0.1] }));
    const second = processor.snapshot();
    expect(second.relativePcts).toBe(first.relativePcts);
    expect(second.deltas).toBe(first.deltas);
  });

  it('handles sparse driver arrays and in-frame session changes', () => {
    const sparseSession = session();
    sparseSession.DriverInfo.Drivers = [
      { CarIdx: 0, CarClassID: 10, CarClassEstLapTime: 100 },
      undefined,
      { CarIdx: 2, CarClassID: 20, CarClassEstLapTime: 120 },
    ] as unknown as Session['DriverInfo']['Drivers'];
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(sparseSession);
    expect(() => processor.onFrame(frame())).not.toThrow();
    processor.onFrame(frame({ sessionTime: 2, sessionNum: 2 }));
    expect(processor.snapshot()).toMatchObject({ sessionNum: 2 });
    expect(processor.snapshot().deltas[1]).toBeNull();
  });

  it('clears on disconnect and suppresses replay scrubbing', () => {
    const processor = new RelativeGapProcessor({ snapshot: emptyReferences });
    processor.init(session());
    processor.onFrame(frame());
    processor.onLifecycle({ type: 'disconnect' });
    processor.onFrame(frame({ sessionTime: 2 }));
    expect(processor.snapshot().deltas).toEqual([]);
    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame({ sessionTime: 3 }));
    expect(processor.snapshot().deltas).toEqual([]);
    processor.onLifecycle({ type: 'enter', replay: false });
    processor.onFrame(frame({ sessionTime: 4 }));
    expect(processor.snapshot().deltas).toEqual([0, 5, -6]);
  });
});
