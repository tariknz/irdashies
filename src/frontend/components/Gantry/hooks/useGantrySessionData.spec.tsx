import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LapHistorySnapshot } from '@irdashies/types';
import { GantrySessionHoldProvider } from './useGantrySessionHold';
import {
  GantrySessionDataProvider,
  useGantrySessionData,
} from './useGantrySessionData';

const sim = vi.hoisted(() => ({
  hasDrivers: true,
  standings: [] as unknown[],
  live: undefined as unknown,
  replay: { mode: 'live', provenance: 'none', subSessionId: '' },
  cursorSessionNum: null as number | null,
  archived: null as unknown,
  qualifying: undefined as unknown,
}));

vi.mock('@irdashies/context', () => ({
  useSessionStore: (
    select: (state: { session: unknown }) => unknown
  ): unknown =>
    select({
      session: sim.hasDrivers
        ? { DriverInfo: { Drivers: [{ CarIdx: 0 }] } }
        : null,
    }),
  useLapTimesStoreUpdater: vi.fn(),
  useLapHistorySnapshot: () => sim.live,
  useReplayContextSnapshot: () => sim.replay,
  trackStateSelectors: { sessionNum: () => null },
  useTrackStateSelector: () => sim.cursorSessionNum,
  useArchivedLapHistory: () => sim.archived,
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: () => sim.standings,
}));

vi.mock('@irdashies/domain/standings/useQualifyingGrid', () => ({
  useQualifyingResults: () => sim.qualifying,
}));

const history = (
  sessionNum: number,
  laps: number,
  version = laps
): LapHistorySnapshot => ({
  carCount: 1,
  capacity: 10,
  count: [laps],
  start: [0],
  lap: [],
  sessionTime: [],
  classPosition: [],
  flags: [],
  sessionNum,
  version,
});

const Probe = () => {
  const { standingsByClass, history, qualifyingResults } =
    useGantrySessionData();
  return (
    <div>
      <span data-testid="standings">{standingsByClass.length}</span>
      <span data-testid="qualifying">
        {qualifyingResults?.length ?? 'none'}
      </span>
      <span data-testid="laps">{history?.count[0] ?? 'none'}</span>
    </div>
  );
};

const view = (running: boolean, showProbe: boolean) => (
  <GantrySessionHoldProvider running={running}>
    <GantrySessionDataProvider>
      {showProbe && <Probe />}
    </GantrySessionDataProvider>
  </GantrySessionHoldProvider>
);

const closeSim = (
  rerender: (ui: React.ReactElement) => void,
  showProbe: boolean
) => {
  sim.standings = [];
  sim.live = undefined;
  sim.archived = null;
  sim.qualifying = undefined;
  rerender(view(false, showProbe));
  sim.hasDrivers = false;
  rerender(view(false, showProbe));
};

describe('GantrySessionDataProvider', () => {
  beforeEach(() => {
    sim.hasDrivers = true;
    sim.standings = [['class', []]];
    sim.live = history(2, 5);
    sim.replay = { mode: 'live', provenance: 'none', subSessionId: '' };
    sim.cursorSessionNum = null;
    sim.archived = null;
    sim.qualifying = undefined;
  });

  it('keeps the finished session for a tab opened after the sim closes', () => {
    const { rerender } = render(view(true, false));
    rerender(view(true, false));

    closeSim(rerender, false);
    rerender(view(false, true));

    expect(screen.getByTestId('standings').textContent).toBe('1');
    expect(screen.getByTestId('laps').textContent).toBe('5');
  });

  it('drops replay laps once the cursor moves to a session with none', () => {
    sim.live = undefined;
    sim.replay = {
      mode: 'replayFile',
      provenance: 'archived',
      subSessionId: '123',
    };
    sim.cursorSessionNum = 1;
    sim.archived = history(1, 7);
    const { rerender } = render(view(true, true));
    rerender(view(true, true));
    expect(screen.getByTestId('laps').textContent).toBe('7');

    sim.cursorSessionNum = 2;
    sim.archived = null;
    rerender(view(true, true));
    closeSim(rerender, true);

    expect(screen.getByTestId('laps').textContent).toBe('none');
  });

  it('keeps qualifying results for the session that ended', () => {
    sim.cursorSessionNum = 1;
    sim.qualifying = [{ CarIdx: 0 }, { CarIdx: 1 }];
    const { rerender } = render(view(true, true));
    rerender(view(true, true));

    closeSim(rerender, true);

    expect(screen.getByTestId('qualifying').textContent).toBe('2');
  });

  it('drops the heat qualifying results once a race without any starts', () => {
    sim.cursorSessionNum = 1;
    sim.qualifying = [{ CarIdx: 0 }, { CarIdx: 1 }];
    const { rerender } = render(view(true, true));
    rerender(view(true, true));

    sim.cursorSessionNum = 2;
    sim.qualifying = undefined;
    rerender(view(true, true));
    closeSim(rerender, true);

    expect(screen.getByTestId('qualifying').textContent).toBe('none');
  });
});
