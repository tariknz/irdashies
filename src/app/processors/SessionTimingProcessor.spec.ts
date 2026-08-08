import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import { SessionTimingProcessor } from './SessionTimingProcessor';

const session = {
  DriverInfo: {
    DriverCarIdx: 1,
    Drivers: [{ CarIdx: 0, CarClassEstLapTime: 60 }, { CarIdx: 1 }],
  },
  SessionInfo: {
    Sessions: [{ SessionNum: 0, SessionType: 'Race', SessionLaps: 10 }],
  },
} as unknown as Session;

const frame = (overrides: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries({
      SessionTime: 20,
      SessionNum: 0,
      SessionState: SessionState.Racing,
      SessionTimeTotal: 600,
      SessionTimeRemain: 604800,
      CamCarIdx: 1,
      LapDistPct: 0.25,
      CarIdxLap: [2, 2],
      CarIdxPosition: [1, 2],
      CarIdxLapDistPct: [0.5, 0.25],
      CarIdxBestLapTime: [60, 61],
      CarIdxLapCompleted: [1, 1],
      CarIdxLastLapTime: [60, 61],
      ...overrides,
    }).map(([key, value]) => [
      key,
      { value: Array.isArray(value) ? value : [value] },
    ])
  ) as unknown as Telemetry;

describe('SessionTimingProcessor', () => {
  it('projects fixed-lap timing for the focused car', () => {
    const processor = new SessionTimingProcessor(() => [60, 61]);
    processor.init(session);
    processor.onFrame(frame());
    expect(processor.snapshot()).toMatchObject({
      sessionType: 'Race',
      state: SessionState.Racing,
      currentLap: 2,
      totalLaps: 10,
      isFixedLapRace: true,
      totalRaceLaps: 10,
      totalRaceTime: 600,
      adjustedRaceTime: 600,
      sessionNum: 0,
    });
  });

  it('captures the green transition and freezes the lap at checkered', () => {
    const processor = new SessionTimingProcessor();
    processor.init(session);
    processor.onFrame(
      frame({ SessionTime: 10, SessionState: SessionState.Warmup })
    );
    processor.onFrame(
      frame({ SessionTime: 11, SessionState: SessionState.Racing })
    );
    expect(processor.snapshot().greenFlagTimestamp).toBe(11);
    processor.onFrame(
      frame({
        SessionTime: 12,
        SessionState: SessionState.Checkered,
        CarIdxLap: [3, 3],
      })
    );
    processor.onFrame(
      frame({
        SessionTime: 13,
        SessionState: SessionState.Checkered,
        CarIdxLap: [4, 4],
      })
    );
    expect(processor.snapshot().currentLap).toBe(3);
    expect(processor.snapshot().totalRaceLaps).toBe(3);
  });

  it('resets on session changes and ignores replay scrubbing', () => {
    const processor = new SessionTimingProcessor();
    processor.init(session);
    processor.onFrame(frame());
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toMatchObject({
      sessionNum: null,
      currentLap: 0,
    });
    processor.onLifecycle({ type: 'enter', replay: true });
    processor.onFrame(frame({ SessionTime: 30 }));
    expect(processor.snapshot().currentLap).toBe(0);
  });
});
