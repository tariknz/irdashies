import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrackLocation } from '@irdashies/types';
import type { LapLogSnapshot, LapTimeLogConfig } from '@irdashies/types';

let snapshot: LapLogSnapshot;

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
    selector({
      getPersonalBest: () => undefined,
      setPersonalBest: () => undefined,
    }),
  useGeneralSettings: () => undefined,
}));

const settings = (
  overrides: Partial<LapTimeLogConfig['history']> = {}
): LapTimeLogConfig =>
  ({
    background: { opacity: 80 },
    foreground: { opacity: 70 },
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: false,
    showPredictedLap: false,
    showLastLap: false,
    showBestLap: false,
    showAllTimeLap: false,
    delta: { enabled: false, method: 'bestlap' },
    history: { enabled: true, count: 20, ...overrides },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    showOnlyWhenOnTrack: false,
  }) as LapTimeLogConfig;

vi.mock('./useLapTimeLogSettings', () => ({
  useLapTimeLogSettings: () => ({ config: settings() }),
}));

import { useLapTimeLog } from './useLapTimeLog';
import { LapTimeLogDisplay } from '../LapTimeLog';

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

/**
 * The retained history feeds the display, and with pitted laps hidden the
 * display filters it before taking the configured number of laps. So the cap
 * here is not a display concern that a display-only test can cover: if the hook
 * has already thrown a clean lap away, no setting can bring it back.
 *
 * This drives the real hook through a stint long enough to exercise the cap,
 * then hands its output to the real display component, because the bug lives in
 * the seam between the two rather than in either one.
 */
describe('lap history retention', () => {
  /**
   * One lap in two steps, because the pit latch and the lap recording are
   * separate effects: the surface has to be seen during the lap for the entry
   * to be marked when the lap is scored.
   */
  const driveLaps = (
    rerender: () => void,
    laps: number,
    isPitLap: (lap: number) => boolean
  ) => {
    for (let lap = 1; lap <= laps; lap += 1) {
      snapshot = {
        ...snapshot,
        playerTrackSurface: isPitLap(lap)
          ? TrackLocation.InPitStall
          : TrackLocation.OnTrack,
        lapDistPct: 0.5,
        version: snapshot.version + 1,
      };
      rerender();

      snapshot = {
        ...snapshot,
        playerTrackSurface: TrackLocation.OnTrack,
        lapCompleted: lap,
        lastLapTime: 90 + lap,
        lapDistPct: 0.01,
        version: snapshot.version + 1,
      };
      rerender();
    }
  };

  it('keeps enough clean laps to fill the display when pit laps are hidden', () => {
    snapshot = { ...emptySnapshot };
    const { result, rerender } = renderHook(() => useLapTimeLog());

    // A 40 lap stint stopping every fifth lap: 8 pit laps sit inside the most
    // recent 40, which under the old cap of 20 left only 16 clean laps for a
    // display asking for 20.
    driveLaps(rerender, 40, (lap) => lap % 5 === 0);

    const clean = result.current.history.filter((entry) => !entry.pitted);
    expect(clean.length).toBeGreaterThanOrEqual(20);
    expect(
      result.current.history.filter((entry) => entry.pitted).length
    ).toBeGreaterThan(0);

    render(
      <LapTimeLogDisplay
        {...result.current}
        settings={settings({ hidePittedLaps: true })}
      />
    );

    expect(screen.getAllByText(/^LAP \d+$/)).toHaveLength(20);
    // Every lap the display shows is a green one, and the newest clean lap
    // leads: a filter applied after the slice would have shown fewer rows.
    expect(screen.queryByText('LAP 40')).not.toBeInTheDocument();
    expect(screen.getByText('LAP 39')).toBeInTheDocument();
    for (const pitted of [35, 30, 25]) {
      expect(screen.queryByText(`LAP ${pitted}`)).not.toBeInTheDocument();
    }
  });
});
