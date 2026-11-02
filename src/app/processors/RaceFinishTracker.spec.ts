import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import { StandingsProcessor } from './StandingsProcessor';

const session = (official = false): Session =>
  ({
    DriverInfo: { DriverCarIdx: 21, PaceCarIdx: 64 },
    SessionInfo: {
      Sessions: [
        {
          SessionNum: 2,
          SessionType: 'Race',
          ResultsOfficial: official ? 1 : 0,
          ResultsPositions: [
            {
              CarIdx: 2,
              Position: 1,
              ClassPosition: 0,
              LapsComplete: 29,
              Time: 0,
            },
            {
              CarIdx: 21,
              Position: 16,
              ClassPosition: 11,
              LapsComplete: 27,
              Time: 223.6197,
            },
          ],
        },
      ],
    },
  }) as Session;

const frame = (
  time: number,
  state: SessionState,
  leaderLap: number,
  leaderPct: number,
  playerLap: number,
  playerPct: number
): Telemetry => {
  const laps = Array<number>(22).fill(-1);
  const pct = Array<number>(22).fill(-1);
  const positions = Array<number>(22).fill(0);
  const surfaces = Array<number>(22).fill(-1);
  laps[2] = leaderLap;
  laps[21] = playerLap;
  pct[2] = leaderPct;
  pct[21] = playerPct;
  positions[2] = 1;
  positions[21] = 16;
  surfaces[2] = surfaces[21] = 3;
  return {
    SessionTime: { value: [time] },
    SessionNum: { value: [2] },
    SessionUniqueID: { value: [3] },
    SessionState: { value: [state] },
    CarIdxLapCompleted: { value: laps },
    CarIdxLapDistPct: { value: pct },
    CarIdxPosition: { value: positions },
    CarIdxTrackSurface: { value: surfaces },
  } as unknown as Telemetry;
};

const runFinish = (processor: StandingsProcessor) => {
  processor.init(session());
  processor.onFrame(frame(100, SessionState.Racing, 28, 0.9, 26, 0.8));
  processor.onFrame(frame(100.2, SessionState.Checkered, 28, 0.95, 27, 0.01));
  processor.onFrame(frame(100.4, SessionState.Checkered, 29, 0.01, 27, 0.1));
  processor.onFrame(frame(110, SessionState.Checkered, 29, 0.7, 27, 0.99));
  processor.onFrame(frame(110.2, SessionState.Checkered, 29, 0.71, 28, 0.01));
};

describe('retained race finishes in StandingsProcessor', () => {
  it('waits for the leader crossing, then retains each car once', () => {
    const processor = new StandingsProcessor();
    processor.init(session());
    processor.onFrame(frame(100, SessionState.Racing, 28, 0.9, 26, 0.8));
    processor.onFrame(frame(100.2, SessionState.Checkered, 28, 0.95, 27, 0.01));
    // Recorded fuel-test edge: car 21 crosses at 2423.4, before leader 2 at 2426.4.
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
    processor.onFrame(frame(100.4, SessionState.Checkered, 29, 0.01, 27, 0.1));
    expect(processor.snapshot().finalRaceTiming?.[2]?.crossingTime).toBeCloseTo(
      100.366667
    );
    expect(processor.snapshot().finalRaceTiming?.[21]).toBeUndefined();
    processor.onFrame(frame(110, SessionState.Checkered, 29, 0.7, 27, 0.99));
    processor.onFrame(frame(110.2, SessionState.Checkered, 29, 0.71, 28, 0.01));
    expect(processor.snapshot().finalRaceTiming?.[21]?.lapsComplete).toBe(28);
    expect(
      processor.snapshot().finalRaceTiming?.[21]?.crossingTime
    ).toBeCloseTo(110.1);
    const retained = structuredClone(processor.snapshot().finalRaceTiming);
    processor.onFrame(frame(190, SessionState.Checkered, 29, 0.99, 28, 0.99));
    processor.onFrame(frame(190.2, SessionState.CoolDown, 30, 0.01, 29, 0.01));
    expect(processor.snapshot().finalRaceTiming).toEqual(retained);
  });

  it('compares interpolated crossings within the same delivered frame', () => {
    const processor = new StandingsProcessor();
    processor.init(session());
    processor.onFrame(frame(100, SessionState.Racing, 28, 0.99, 26, 0.98));
    processor.onFrame(frame(100.2, SessionState.Checkered, 29, 0.03, 27, 0.02));
    expect(processor.snapshot().finalRaceTiming?.[2]?.crossingTime).toBeCloseTo(
      100.05
    );
    expect(
      processor.snapshot().finalRaceTiming?.[21]?.crossingTime
    ).toBeCloseTo(100.1);
  });

  it('uses official result timing for late joins without inventing crossings', () => {
    const processor = new StandingsProcessor();
    processor.init(session(true));
    processor.onFrame(frame(2500, SessionState.CoolDown, -1, -1, -1, -1));
    expect(processor.snapshot().finalRaceTiming?.[2]).toEqual({
      lapsComplete: 29,
      crossingTime: undefined,
      resultTime: 0,
    });
    expect(processor.snapshot().finalRaceTiming?.[21]?.resultTime).toBe(
      223.6197
    );
  });

  it('ignores provisional result deltas and missing crossings', () => {
    const processor = new StandingsProcessor();
    processor.init(session());
    processor.onFrame(frame(2500, SessionState.Checkered, 29, 0.99, 27, 0.99));
    processor.onFrame(
      frame(2500.2, SessionState.Checkered, 30, 0.01, 28, 0.01)
    );
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
  });

  it('rejects apparent crossings over missing telemetry or long delivery gaps', () => {
    const processor = new StandingsProcessor();
    processor.init(session());
    processor.onFrame(frame(100, SessionState.Racing, 28, 0.99, 26, 0.99));
    processor.onFrame(frame(102, SessionState.Checkered, 29, 0.01, 27, 0.01));
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
    processor.onFrame(frame(103, SessionState.Checkered, -1, -1, -1, -1));
    processor.onFrame(frame(103.2, SessionState.Checkered, 30, 0.01, 28, 0.01));
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
  });

  it.each(['rewind', 'restart', 'identity', 'session', 'disconnect'] as const)(
    'clears retained timing on %s',
    (kind) => {
      const processor = new StandingsProcessor();
      runFinish(processor);
      expect(processor.snapshot().finalRaceTiming?.[2]).toBeDefined();
      if (kind === 'disconnect' || kind === 'session')
        processor.onLifecycle({
          type: kind === 'disconnect' ? 'disconnect' : 'sessionNumChange',
        });
      else if (kind === 'rewind')
        processor.onFrame(frame(90, SessionState.Checkered, 28, 0.1, 26, 0.1));
      else if (kind === 'restart')
        processor.onFrame(frame(111, SessionState.Racing, 28, 0.1, 26, 0.1));
      else
        processor.onFrame({
          ...frame(111, SessionState.Checkered, 28, 0.1, 26, 0.1),
          SessionUniqueID: { value: [4] },
        });
      expect(processor.snapshot().finalRaceTiming).toBeUndefined();
    }
  );

  it('does not apply official results in practice or before the checkered flag', () => {
    const processor = new StandingsProcessor();
    processor.init(session(true));
    processor.onFrame(frame(100, SessionState.Racing, 28, 0.9, 26, 0.8));
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
    const practice = session(true);
    practice.SessionInfo.Sessions[0].SessionType = 'Practice';
    processor.init(practice);
    processor.onFrame(frame(101, SessionState.CoolDown, -1, -1, -1, -1));
    expect(processor.snapshot().finalRaceTiming).toBeUndefined();
  });
});
