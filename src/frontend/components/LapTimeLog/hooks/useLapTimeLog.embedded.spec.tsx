import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackLocation } from '@irdashies/types';
import type { LapLogSnapshot, LapTimeLogConfig } from '@irdashies/types';

const setPersonalBest = vi.fn();

const snapshot: LapLogSnapshot = {
  lapCompleted: 3,
  currentLapTime: 30,
  lastLapTime: 91,
  bestLapTime: 90,
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
  lapInvalidated: false,
  lastLapUnderCaution: false,
  version: 0,
};

vi.mock('@irdashies/context', () => ({
  useLapLogSnapshot: () => snapshot,
  useDriverCarIdx: () => 0,
  useSessionStore: (selector: (state: unknown) => unknown) =>
    selector({
      session: {
        WeekendInfo: { TrackID: 1 },
        DriverInfo: { Drivers: [{ CarIdx: 0, CarPath: 'testcar' }] },
      },
    }),
  usePersonalBestStore: (selector: (state: unknown) => unknown) =>
    selector({ getPersonalBest: () => undefined, setPersonalBest }),
  useGeneralSettings: () => undefined,
}));

vi.mock('./useLapTimeLogSettings', () => ({
  useLapTimeLogSettings: () => ({}) as LapTimeLogConfig,
}));

import { useLapTimeLog } from './useLapTimeLog';

describe('useLapTimeLog personal best', () => {
  beforeEach(() => {
    setPersonalBest.mockClear();
  });

  it('saves a new personal best from the overlay copy', () => {
    renderHook(() => useLapTimeLog());
    expect(setPersonalBest).toHaveBeenCalledWith('1', 'testcar', 90);
  });

  it('never saves from an embedded copy, which must not write to disk', () => {
    renderHook(() => useLapTimeLog(true));
    expect(setPersonalBest).not.toHaveBeenCalled();
  });
});
