import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { SessionBarProcessor } from './SessionBarProcessor';

describe('SessionBarProcessor', () => {
  it('returns snapshots detached from reusable processor buffers', () => {
    const processor = new SessionBarProcessor();
    processor.init({
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [{ CarIdx: 0, CarID: 67, CarClassID: 1 }],
      },
    } as unknown as Session);
    processor.onFrame({
      SessionTime: { value: [1] },
      SessionNum: { value: [1] },
      CarIdxPosition: { value: [1] },
    } as unknown as Telemetry);
    const published = processor.snapshot();
    processor.onFrame({
      SessionTime: { value: [1.2] },
      SessionNum: { value: [1] },
      CarIdxPosition: { value: [2] },
    } as unknown as Telemetry);
    expect(published.competitorPositions).toEqual([1]);
    expect(processor.snapshot().competitorPositions).toEqual([2]);
  });

  it('projects the auxiliary session bar state and resets with lifecycle', () => {
    const processor = new SessionBarProcessor();
    processor.init({
      WeekendInfo: {
        TrackDisplayName: 'Okayama',
        WeekendOptions: { IncidentLimit: 17 },
      },
      DriverInfo: {
        DriverCarIdx: 0,
        Drivers: [{ CarIdx: 0, CarID: 67, CarClassID: 1 }],
      },
      SessionInfo: {
        Sessions: [{ SessionNum: 1, SessionName: 'Race', SessionType: 'Race' }],
      },
    } as unknown as Session);
    processor.onFrame({
      SessionTime: { value: [1] },
      SessionNum: { value: [1] },
      DisplayUnits: { value: [1] },
      FuelLevel: { value: [30] },
      PlayerCarTeamIncidentCount: { value: [2] },
      CarIdxPosition: { value: [1] },
      CarIdxClassPosition: { value: [1] },
      CarIdxBestLapTime: { value: [90] },
      Lap: { value: [2] },
      Speed: { value: [50] },
    } as unknown as Telemetry);
    expect(processor.snapshot()).toMatchObject({
      sessionName: 'Race',
      trackDisplayName: 'Okayama',
      fuelLevel: 30,
      incidents: 2,
      playerClassPosition: 1,
      playerClassSize: 1,
      sessionBestLap: 90,
    });
    processor.onFrame({
      SessionTime: { value: [1.05] },
      SessionNum: { value: [1] },
      Lap: { value: [2] },
      Speed: { value: [70] },
    } as unknown as Telemetry);
    processor.onFrame({
      SessionTime: { value: [1.2] },
      SessionNum: { value: [1] },
      Lap: { value: [3] },
      Speed: { value: [40] },
    } as unknown as Telemetry);
    expect(processor.snapshot()).toMatchObject({
      lastLapTopSpeed: 70,
      sessionBestTopSpeed: 70,
    });
    processor.onLifecycle({ type: 'disconnect' });
    expect(processor.snapshot()).toMatchObject({
      sessionNum: null,
      incidents: 0,
    });
  });
});
