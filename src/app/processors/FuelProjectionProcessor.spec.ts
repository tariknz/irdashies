import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { FuelProjectionProcessor } from './FuelProjectionProcessor';

const frame = (values: Record<string, number | boolean>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, entry]) => [key, { value: [entry] }])
  ) as unknown as Telemetry;

describe('FuelProjectionProcessor', () => {
  it('projects live usage and records a completed green lap', () => {
    const lapCompleted = vi.fn();
    const processor = new FuelProjectionProcessor({
      persistence: { lapCompleted, saveLap: vi.fn() },
    });
    processor.init({} as Session);

    processor.onFrame(
      frame({
        FuelLevel: 40,
        Lap: 1,
        LapDistPct: 0.01,
        OnPitRoad: 0,
        PlayerCarTowTime: 0,
        SessionFlags: 4,
        SessionNum: 0,
        SessionTime: 10,
      })
    );
    processor.onFrame(
      frame({
        FuelLevel: 38,
        Lap: 1,
        LapDistPct: 0.75,
        OnPitRoad: 0,
        PlayerCarTowTime: 0,
        SessionFlags: 4,
        SessionNum: 0,
        SessionTime: 70,
      })
    );

    expect(processor.snapshot().currentLapUsage).toBe(2);
    expect(processor.snapshot().projectedLapUsage).toBeGreaterThan(0);

    processor.onFrame(
      frame({
        FuelLevel: 37,
        Lap: 2,
        LapDistPct: 0.01,
        OnPitRoad: 0,
        PlayerCarTowTime: 0,
        SessionFlags: 4,
        SessionNum: 0,
        SessionTime: 100,
      })
    );

    expect(processor.snapshot().lastLapUsage).toBe(3);
    expect(processor.snapshot().completedLaps).toHaveLength(1);
    expect(lapCompleted).toHaveBeenCalledOnce();
  });

  it('resets volatile state on disconnect', () => {
    const processor = new FuelProjectionProcessor();
    processor.onFrame(
      frame({ FuelLevel: 20, Lap: 3, LapDistPct: 0.5, SessionTime: 30 })
    );

    processor.onLifecycle({ type: 'disconnect' });

    expect(processor.snapshot()).toMatchObject({
      fuelLevel: 0,
      currentLap: 0,
      completedLaps: [],
    });
  });

  it('preserves boolean track and pit state in the snapshot', () => {
    const processor = new FuelProjectionProcessor();

    processor.onFrame(
      frame({ FuelLevel: 20, IsOnTrack: true, OnPitRoad: true })
    );

    expect(processor.snapshot().isOnTrack).toBe(true);
    expect(processor.snapshot().engine.wasOnPitRoad).toBe(true);
  });

  it('projects timed-race distance using class pace', () => {
    const processor = new FuelProjectionProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [{ CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 90 }],
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 0, SessionType: 'Race', SessionLaps: 'unlimited' },
        ],
      },
    } as unknown as Session);

    const timedRaceFrame = {
      FuelLevel: { value: [45.39] },
      Lap: { value: [2] },
      LapDistPct: { value: [0.1] },
      SessionNum: { value: [0] },
      SessionState: { value: [4] },
      SessionLapsRemain: { value: [32767] },
      SessionTimeRemain: { value: [1620] },
      SessionTimeTotal: { value: [1800] },
      CamCarIdx: { value: [0] },
      CarIdxLap: { value: [2] },
      CarIdxLapDistPct: { value: [0.1] },
      CarIdxPosition: { value: [1] },
      CarIdxClassPosition: { value: [1] },
      CarIdxLastLapTime: { value: [1] },
      CarIdxBestLapTime: { value: [1] },
    } as unknown as Telemetry;
    processor.onFrame(timedRaceFrame);

    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 20,
      estimatedLapsRemaining: 18.9,
      hasValidRaceEstimate: true,
      isFixedLapRace: false,
    });

    processor.onFrame({
      ...timedRaceFrame,
      CarIdxLastLapTime: { value: [100] },
    } as unknown as Telemetry);
    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 18,
      estimatedLapsRemaining: 16.9,
    });

    processor.onFrame({
      ...timedRaceFrame,
      CarIdxLastLapTime: { value: [110] },
    } as unknown as Telemetry);
    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 18,
      estimatedLapsRemaining: 16.9,
    });
  });

  it('uses fractional distance when correcting a timed race for lapping', () => {
    const processor = new FuelProjectionProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 1,
        Drivers: [
          { CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 100 },
          { CarIdx: 1, CarClassID: 1, CarClassEstLapTime: 100 },
        ],
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 0, SessionType: 'Race', SessionLaps: 'unlimited' },
        ],
      },
    } as unknown as Session);

    processor.onFrame({
      SessionNum: { value: [0] },
      SessionState: { value: [4] },
      SessionTimeRemain: { value: [900] },
      CamCarIdx: { value: [1] },
      CarIdxLap: { value: [10, 8] },
      CarIdxLapDistPct: { value: [0.1, 0.8] },
      CarIdxPosition: { value: [1, 10] },
      CarIdxClassPosition: { value: [1, 2] },
      CarIdxBestLapTime: { value: [100, 100] },
    } as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 18,
      estimatedLapsRemaining: 10.2,
      hasValidRaceEstimate: true,
    });
  });

  it('uses player-class pace for remaining distance in multiclass races', () => {
    const processor = new FuelProjectionProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 1,
        Drivers: [
          { CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 55 },
          { CarIdx: 1, CarClassID: 2, CarClassEstLapTime: 80 },
        ],
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 0, SessionType: 'Race', SessionLaps: 'unlimited' },
        ],
      },
    } as unknown as Session);

    processor.onFrame({
      SessionNum: { value: [0] },
      SessionState: { value: [4] },
      SessionTimeRemain: { value: [900] },
      CamCarIdx: { value: [1] },
      CarIdxLap: { value: [10, 8] },
      CarIdxLapDistPct: { value: [0.1, 0.8] },
      CarIdxPosition: { value: [1, 10] },
      CarIdxClassPosition: { value: [1, 1] },
      CarIdxLastLapTime: { value: [60, 90] },
      CarIdxBestLapTime: { value: [55, 80] },
    } as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 19,
      estimatedLapsRemaining: 11.2,
      hasValidRaceEstimate: true,
    });
  });

  it('uses player distance when no overall leader position is available', () => {
    const processor = new FuelProjectionProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 1,
        Drivers: [{ CarIdx: 1, CarClassID: 1, CarClassEstLapTime: 100 }],
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 0, SessionType: 'Race', SessionLaps: 'unlimited' },
        ],
      },
    } as unknown as Session);

    processor.onFrame({
      SessionNum: { value: [0] },
      SessionState: { value: [4] },
      SessionTimeRemain: { value: [810] },
      CamCarIdx: { value: [1] },
      CarIdxLap: { value: [0, 8] },
      CarIdxLapDistPct: { value: [0, 0.8] },
      CarIdxPosition: { value: [0, 2] },
      CarIdxBestLapTime: { value: [0, 100] },
    } as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 16,
      estimatedLapsRemaining: 8.2,
      hasValidRaceEstimate: true,
    });
  });

  it('rejects transient timed-race lap times', () => {
    const processor = new FuelProjectionProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [{ CarIdx: 0, CarClassEstLapTime: 1 }],
      },
      SessionInfo: {
        Sessions: [
          { SessionNum: 0, SessionType: 'Race', SessionLaps: 'unlimited' },
        ],
      },
    } as unknown as Session);

    processor.onFrame({
      SessionNum: { value: [0] },
      SessionTimeRemain: { value: [1500] },
      CarIdxLap: { value: [1] },
      CarIdxLapDistPct: { value: [0] },
      CarIdxPosition: { value: [1] },
      CarIdxBestLapTime: { value: [1] },
    } as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      calculatedTotalRaceLaps: 0,
      estimatedLapsRemaining: 0,
      hasValidRaceEstimate: false,
    });
  });

  it('preserves completed laps while resetting crossing state on session change', () => {
    const processor = new FuelProjectionProcessor();
    processor.onFrame(
      frame({
        FuelLevel: 20,
        Lap: 1,
        LapDistPct: 0.01,
        SessionFlags: 4,
        SessionTime: 10,
      })
    );
    processor.onFrame(
      frame({
        FuelLevel: 18,
        Lap: 2,
        LapDistPct: 0.01,
        SessionFlags: 4,
        SessionTime: 80,
      })
    );
    expect(processor.snapshot().completedLaps).toHaveLength(1);

    processor.onLifecycle({ type: 'sessionNumChange' });

    expect(processor.snapshot().completedLaps).toHaveLength(1);
    expect(processor.snapshot().engine.lastLap).toBe(0);

    processor.onFrame(
      frame({
        FuelLevel: 30,
        Lap: 1,
        LapDistPct: 0.01,
        SessionFlags: 4,
        SessionNum: 1,
        SessionTime: 100,
      })
    );

    expect(processor.snapshot().completedLaps).toHaveLength(1);
    expect(processor.snapshot().projectedLapUsage).toBeGreaterThan(2);
    expect(processor.snapshot().projectedLapUsage).toBeLessThan(2.2);
  });

  it('does not aggregate replay frames and resumes from clean state live', () => {
    const processor = new FuelProjectionProcessor();
    processor.onLifecycle({ type: 'enter', replay: true });

    processor.onFrame(
      frame({ FuelLevel: 20, Lap: 5, LapDistPct: 0.9, SessionTime: 100 })
    );
    expect(processor.snapshot()).toMatchObject({ fuelLevel: 0, currentLap: 0 });

    processor.onLifecycle({ type: 'enter', replay: false });
    processor.onFrame(
      frame({ FuelLevel: 19, Lap: 1, LapDistPct: 0.1, SessionTime: 10 })
    );
    expect(processor.snapshot()).toMatchObject({
      fuelLevel: 19,
      currentLap: 1,
    });
  });
});
