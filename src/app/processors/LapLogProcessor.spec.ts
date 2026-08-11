import { describe, expect, it } from 'vitest';
import type { Telemetry } from '@irdashies/types';
import { LapLogProcessor } from './LapLogProcessor';

const frame = (values: Record<string, unknown[]>): Telemetry =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { value }])
  ) as Telemetry;

describe('LapLogProcessor', () => {
  it('projects lap log inputs without allocating a replacement history buffer', () => {
    const processor = new LapLogProcessor();
    processor.onFrame(
      frame({
        LapCompleted: [2],
        LapCurrentLapTime: [31.2],
        LapLastLapTime: [61.5],
        LapBestLapTime: [60.9],
        CarIdxBestLapTime: [60.9, 61.1],
        SessionNum: [1],
        SessionTime: [120.4],
        PlayerTrackSurface: [3],
        PlayerCarMyIncidentCount: [2],
        LapDistPct: [0.4],
        LapDeltaToSessionBestLap: [-0.2],
        LapDeltaToSessionBestLap_OK: [1],
      })
    );
    const snapshot = processor.snapshot();
    const bestLaps = snapshot.carIdxBestLapTime;
    expect(snapshot).toMatchObject({
      lapCompleted: 2,
      currentLapTime: 31.2,
      bestLapTime: 60.9,
      sessionNum: 1,
      incidentCount: 2,
      deltaToSessionBestLap: -0.2,
      deltaToSessionBestLapOk: true,
    });
    expect(bestLaps).toEqual([60.9, 61.1]);

    processor.onFrame(frame({ CarIdxBestLapTime: [59.8] }));
    expect(processor.snapshot().carIdxBestLapTime).toBe(bestLaps);
    expect(bestLaps).toEqual([59.8]);
  });

  it('resets session-derived state on lifecycle changes', () => {
    const processor = new LapLogProcessor();
    processor.onFrame(frame({ LapCompleted: [4], SessionNum: [2] }));
    processor.onLifecycle({ type: 'sessionNumChange' });
    expect(processor.snapshot()).toMatchObject({
      lapCompleted: 0,
      sessionNum: null,
    });
  });
});
