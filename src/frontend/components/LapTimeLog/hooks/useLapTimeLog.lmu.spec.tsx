import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackLocation } from '@irdashies/types';
import type { LapLogSnapshot } from '@irdashies/types';

let snapshot: LapLogSnapshot;
let drivers: { CarIdx: number; CarPath: string; CarModel?: string }[];
const getPersonalBest = vi.fn<(track: string, car: string) => undefined>();

vi.mock('@irdashies/context', () => ({
  useLapLogSnapshot: () => snapshot,
  useDriverCarIdx: () => 0,
  useSessionStore: (selector: (state: unknown) => unknown) =>
    selector({
      session: {
        WeekendInfo: { TrackID: 1 },
        DriverInfo: { Drivers: drivers },
      },
    }),
  usePersonalBestStore: (selector: (state: unknown) => unknown) =>
    selector({ getPersonalBest, setPersonalBest: () => undefined }),
  useGeneralSettings: () => undefined,
}));

vi.mock('./useLapTimeLogSettings', () => ({
  useLapTimeLogSettings: () => undefined,
}));

import { useLapTimeLog } from './useLapTimeLog';

const emptySnapshot: LapLogSnapshot = {
  lapCompleted: 0,
  currentLapTime: 30,
  lastLapTime: 0,
  bestLapTime: 0,
  carIdxBestLapTime: [],
  sessionNum: 0,
  sessionTime: 0,
  playerTrackSurface: TrackLocation.OnTrack,
  incidentCount: 0,
  lapDistPct: 0.5,
  deltaToSessionLastLap: 0,
  deltaToSessionLastLapOk: false,
  deltaToSessionBestLap: 0,
  deltaToSessionBestLapOk: false,
  version: 0,
};

beforeEach(() => {
  snapshot = { ...emptySnapshot };
  getPersonalBest.mockClear();
});

describe('Lap Timer personal-best key', () => {
  it('keys an LMU car by its model, so a second livery shares the record', () => {
    // CarPath is the livery's .VEH file under LMU.
    drivers = [
      { CarIdx: 0, CarPath: 'AF_LMGT3_23.VEH', CarModel: 'Ferrari 296 LMGT3' },
    ];
    renderHook(() => useLapTimeLog());
    expect(getPersonalBest).toHaveBeenCalledWith('1', 'Ferrari 296 LMGT3');
  });

  it('keeps keying an iRacing car by CarPath, which has no CarModel', () => {
    drivers = [{ CarIdx: 0, CarPath: 'ferrari296gt3' }];
    renderHook(() => useLapTimeLog());
    expect(getPersonalBest).toHaveBeenCalledWith('1', 'ferrari296gt3');
  });
});
