import * as yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { createRelativeGapsProbe } from './relative-gaps-probe';

const context = {
  sourceTick: 1,
  elapsedTicks: 0n,
  elapsedSeconds: 0,
};

describe('relative gaps replay probe', () => {
  it('returns stable snapshots when processor buffers are reused', () => {
    const probe = createRelativeGapsProbe();
    probe.onSessionInfo?.(
      yaml.dump({
        WeekendInfo: {
          SeriesID: 1,
          TrackID: 1,
          SubSessionID: 1,
          TrackLength: '1 km',
        },
        DriverInfo: {
          DriverCarIdx: 0,
          PaceCarIdx: -1,
          Drivers: [
            { CarIdx: 0, CarClassID: 1, CarClassEstLapTime: 100 },
            { CarIdx: 1, CarClassID: 1, CarClassEstLapTime: 100 },
          ],
        },
      }),
      context
    );
    const first = probe.onFrame(
      {
        CamCarIdx: 0,
        CarIdxEstTime: [20, 25],
        CarIdxLap: [4, 4],
        CarIdxLapDistPct: [0.2, 0.25],
        CarIdxOnPitRoad: [0, 0],
        SessionNum: 1,
        SessionTime: 1,
      },
      context
    );
    const firstDeltas = [...first.deltas];
    const second = probe.onFrame(
      {
        CamCarIdx: 1,
        CarIdxEstTime: [20, 25],
        CarIdxLap: [4, 4],
        CarIdxLapDistPct: [0.2, 0.25],
        CarIdxOnPitRoad: [0, 0],
        SessionNum: 1,
        SessionTime: 1,
      },
      context
    );

    expect(first.deltas).toEqual(firstDeltas);
    expect(first.deltas).not.toBe(second.deltas);
    expect(first.focusCarIdx).toBe(0);
    expect(second.focusCarIdx).toBe(1);
  });
});
