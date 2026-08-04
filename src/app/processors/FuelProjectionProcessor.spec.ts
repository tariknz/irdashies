import { describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { FuelProjectionProcessor } from './FuelProjectionProcessor';

const frame = (values: Record<string, number>): Telemetry =>
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
});
