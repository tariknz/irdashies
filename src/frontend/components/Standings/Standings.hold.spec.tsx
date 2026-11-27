import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';
import { useSessionStore } from '@irdashies/context';
import { SessionHoldProvider } from '@irdashies/domain/sessionHold/useSessionHold';

const live = vi.hoisted(() => ({
  standings: [] as unknown[],
  classStats: {} as Record<string, unknown>,
  firstObservedLaps: [] as (number | undefined)[],
}));

vi.mock('@irdashies/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@irdashies/context')>()),
  useGeneralSettings: () => undefined,
  useLapTimesStoreUpdater: () => undefined,
  useP2PDisplayStates: () => [],
  useDrivingState: () => ({ isDriving: true }),
  useWeekendInfoNumCarClasses: () => 1,
  useWeekendInfoTeamRacing: () => false,
  useSessionVisibility: () => true,
  useCarIdxRollingAvgLapTime: () => [],
  usePitStopDuration: () => [],
  usePitLaneStore: () => null,
  useStandingsSelector: () => live.firstObservedLaps,
  useActiveSimulator: () => 'iracing',
}));

vi.mock('./hooks', () => ({
  useCarClassStats: () => live.classStats,
  useDriverStandings: () => live.standings,
  useStandingsSettings: () => ({
    titleBar: { enabled: true },
    headerBar: { enabled: true },
    footerBar: { enabled: true },
    driverStandings: { numTopDrivers: 0 },
  }),
  useHighlightColor: () => 0xffffff,
  useDriverTagMap: () => ({ tagMap: new Map(), hasAnyTag: false }),
  useManufacturerCounts: () => ({}),
  useClassLapEstimates: () => ({}),
}));

vi.mock('./hooks/useIsSingleMake', () => ({ useIsSingleMake: () => false }));
vi.mock('./hooks/useTrackLimitsMax', () => ({
  useTrackLimitsMax: () => undefined,
}));
vi.mock('./components/TitleBar/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}));
vi.mock('./components/SessionBar/SessionBar', () => ({
  SessionBar: () => <div data-testid="session-bar" />,
}));
vi.mock('./components/DriverClassHeader/DriverClassHeader', () => ({
  DriverClassHeader: ({ className }: { className?: string }) => (
    <tr>
      <td data-testid="class-header">{className}</td>
    </tr>
  ),
}));
vi.mock('./components/DriverInfoRow/DriverInfoRow', () => ({
  DriverInfoRow: ({
    name,
    currentLap,
  }: {
    name: string;
    currentLap?: number;
  }) => (
    <tr>
      <td data-testid="driver-row">{name}</td>
      <td data-testid="stint-lap">{currentLap}</td>
    </tr>
  ),
}));

import { Standings } from './Standings';

const result = (carIdx: number, name: string) => ({
  carIdx,
  classPosition: carIdx,
  carClass: { color: 0xff0000 },
  driver: { name, carNum: String(carIdx) },
});

const view = (running: boolean) => (
  <SessionHoldProvider running={running}>
    <Standings />
  </SessionHoldProvider>
);

describe('Standings after the session ends', () => {
  beforeEach(() => {
    live.standings = [['c1', [result(1, 'Driver A'), result(2, 'Driver B')]]];
    live.classStats = { c1: { shortName: 'GT3' } };
    live.firstObservedLaps = [];
    useSessionStore.getState().resetSession();
    act(() =>
      useSessionStore.getState().setSession({
        DriverInfo: { Drivers: [{ CarIdx: 0 }] },
      } as unknown as Session)
    );
  });

  it('uses the race snapshot for stint laps with Pit Status disabled', () => {
    live.standings = [
      ['c1', [{ ...result(1, 'Driver A'), lastLap: 42, onTrack: true }]],
    ];
    live.firstObservedLaps = [undefined, 1];

    render(view(true));

    expect(screen.getByTestId('stint-lap')).toHaveTextContent('43');
  });

  it('keeps the final results when the sim closes and the data empties', () => {
    const { rerender } = render(view(true));
    expect(screen.getAllByTestId('driver-row')).toHaveLength(2);
    expect(screen.getByTestId('class-header').textContent).toBe('GT3');

    live.standings = [];
    live.classStats = {};
    rerender(view(false));

    expect(screen.getAllByTestId('driver-row')).toHaveLength(2);
    expect(screen.getByTestId('class-header').textContent).toBe('GT3');
  });

  it('hides the live-only title and session bars while holding', () => {
    const { rerender } = render(view(true));
    expect(screen.getByTestId('title-bar')).toBeTruthy();
    expect(screen.getAllByTestId('session-bar')).toHaveLength(2);

    rerender(view(false));

    expect(screen.queryByTestId('title-bar')).toBeNull();
    expect(screen.queryByTestId('session-bar')).toBeNull();
  });

  it('shows live data as usual without a hold provider', () => {
    const { rerender } = render(<Standings />);
    live.standings = [];
    rerender(<Standings />);

    expect(screen.queryAllByTestId('driver-row')).toHaveLength(0);
    expect(screen.getByTestId('title-bar')).toBeTruthy();
  });
});
