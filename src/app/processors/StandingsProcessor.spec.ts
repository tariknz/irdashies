import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import { StandingsProcessor } from './StandingsProcessor';

const session = {
  DriverInfo: { DriverCarIdx: 1 },
} as Session;

const frame = (
  sessionTime: number,
  overrides: Partial<Record<keyof Telemetry, unknown>> = {}
): Telemetry =>
  ({
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [2] },
    SessionState: { value: [4] },
    CamCarIdx: { value: [1] },
    CarIdxF2Time: { value: [0, 1.25] },
    CarIdxEstTime: { value: [10, 11] },
    CarIdxOnPitRoad: { value: [false, false] },
    CarIdxLap: { value: [3, 3] },
    CarIdxLapDistPct: { value: [0.5, 0.4] },
    CarIdxTrackSurface: { value: [3, 3] },
    CarIdxTireCompound: { value: [1, 2] },
    CarIdxSessionFlags: { value: [0, 8] },
    ...overrides,
  }) as Telemetry;

describe('StandingsProcessor', () => {
  it('projects only the driver state consumed by standings', () => {
    const processor = new StandingsProcessor();
    processor.init(session);
    processor.onFrame(frame(10));

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: 1,
      sessionNum: 2,
      carIdxF2Time: [0, 1.25],
      carIdxLapDistPct: [0.5, 0.4],
      carIdxSessionFlags: [0, 8],
      version: 1,
    });
  });

  it('publishes no faster than five hertz unless focus changes', () => {
    const processor = new StandingsProcessor();
    processor.init(session);
    processor.onFrame(frame(10));
    const first = processor.snapshot();
    processor.onFrame(frame(10.1));
    expect(processor.snapshot()).toBe(first);

    processor.onFrame(frame(10.1, { CamCarIdx: { value: [0] } }));
    expect(processor.snapshot().focusCarIdx).toBe(0);
    expect(processor.snapshot().version).toBe(2);
  });

  it('reuses projection buffers between accepted frames', () => {
    const processor = new StandingsProcessor();
    processor.init(session);
    processor.onFrame(frame(10));
    const first = processor.snapshot();
    const firstLapBuffer = first.carIdxLap;
    const firstPitBuffer = first.carIdxOnPitRoad;
    const firstHistoryBuffer = first.lastPitLap;

    processor.onFrame(frame(10.2));

    expect(processor.snapshot()).toBe(first);
    expect(processor.snapshot().carIdxLap).toBe(firstLapBuffer);
    expect(processor.snapshot().carIdxOnPitRoad).toBe(firstPitBuffer);
    expect(processor.snapshot().lastPitLap).toBe(firstHistoryBuffer);
  });

  it('tracks pit laps and previous track surfaces', () => {
    const processor = new StandingsProcessor();
    processor.init(session);
    processor.onFrame(frame(10));
    processor.onFrame(
      frame(10.2, {
        CarIdxOnPitRoad: { value: [false, true] },
        CarIdxLap: { value: [3, 4] },
        CarIdxTrackSurface: { value: [3, 1] },
      })
    );

    expect(processor.snapshot().lastPitLap).toEqual([undefined, 4]);
    expect(processor.snapshot().previousCarTrackSurface).toEqual([
      undefined,
      3,
    ]);
  });

  it('projects live positions within each class for race sessions', () => {
    const processor = new StandingsProcessor();
    processor.init({
      DriverInfo: { DriverCarIdx: 1, PaceCarIdx: 0 },
      SessionInfo: {
        Sessions: [
          {
            SessionNum: 2,
            SessionType: 'Race',
            ResultsPositions: [
              { CarIdx: 1, ClassPosition: 1, LapsComplete: 2 },
              { CarIdx: 2, ClassPosition: 0, LapsComplete: 2 },
              { CarIdx: 3, ClassPosition: 0, LapsComplete: 1 },
            ],
          },
        ],
      },
    } as Session);
    processor.onFrame(
      frame(10, {
        CarIdxLapCompleted: { value: [0, 2, 2, 1] },
        CarIdxLapDistPct: { value: [0, 0.4, 0.7, 0.9] },
        CarIdxClass: { value: [-1, 10, 10, 20] },
      })
    );

    expect(processor.snapshot().liveClassPosition).toEqual([
      undefined,
      2,
      1,
      1,
    ]);
  });

  it('keeps unfinished cars ordered by live progress under checkered', () => {
    const processor = new StandingsProcessor();
    processor.init({
      DriverInfo: { DriverCarIdx: 1, PaceCarIdx: 0 },
      SessionInfo: {
        Sessions: [
          {
            SessionNum: 2,
            SessionType: 'Race',
            ResultsPositions: [
              {
                Position: 1,
                CarIdx: 1,
                ClassPosition: 0,
                LapsComplete: 2,
              },
              {
                Position: 2,
                CarIdx: 2,
                ClassPosition: 1,
                LapsComplete: 2,
              },
            ],
          },
        ],
      },
    } as Session);

    processor.onFrame(
      frame(10, {
        SessionState: { value: [SessionState.Checkered] },
        CarIdxLapCompleted: { value: [0, 2, 2] },
        CarIdxLapDistPct: { value: [0, 0.7, 0.9] },
        CarIdxClass: { value: [-1, 10, 10] },
      })
    );

    expect(processor.snapshot().liveClassPosition).toEqual([undefined, 2, 1]);
  });

  it('resets accumulated state on session changes and disconnect', () => {
    const processor = new StandingsProcessor();
    processor.init(session);
    processor.onFrame(
      frame(10, {
        CarIdxOnPitRoad: { value: [false, true] },
      })
    );
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot().lastPitLap).toEqual([]);
    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: null,
      sessionNum: null,
      carIdxLap: [],
    });
  });
});
