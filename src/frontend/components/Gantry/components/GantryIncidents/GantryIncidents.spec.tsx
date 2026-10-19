import { useSyncExternalStore, type ReactElement } from 'react';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IncidentType,
  type Incident,
  type IncidentSessionFilter,
} from '@irdashies/types';

const trackState = vi.hoisted(() => ({
  snapshot: undefined as
    { isReplayPlaying: boolean; sessionNum?: number | null } | undefined,
}));

const feed = vi.hoisted(() => ({
  incidents: [] as Incident[],
  filtered: [] as Incident[],
  sessionFilter: 'all' as IncidentSessionFilter,
  setSessionFilter: (() => undefined) as (f: IncidentSessionFilter) => void,
  sessions: undefined as
    | { SessionNum: number; SessionName: string; SessionType: string }[]
    | undefined,
}));

const sessionStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify: () => listeners.forEach((listener) => listener()),
    // One stable object, as a store snapshot must be.
    withDrivers: { DriverInfo: { Drivers: [{}] } },
  };
});

vi.mock('@irdashies/context', () => ({
  useRaceControlStore: (selector: (state: unknown) => unknown) =>
    selector({
      activeTypeFilters: new Set(Object.values(IncidentType)),
      toggleTypeFilter: vi.fn(),
      driverFilter: null,
      setDriverFilter: vi.fn(),
      sessionFilter: feed.sessionFilter,
      setSessionFilter: feed.setSessionFilter,
      incidents: feed.incidents,
    }),
  useFilteredIncidents: () => feed.filtered,
  // Subscribed like the real store, so a change re-renders the memoised feed.
  useSessionList: () =>
    useSyncExternalStore(sessionStore.subscribe, () => feed.sessions),
  // Read by the hold provider to tell when a session has drivers.
  useSessionStore: (selector: (state: unknown) => unknown) =>
    selector({
      session: useSyncExternalStore(sessionStore.subscribe, () =>
        feed.sessions ? sessionStore.withDrivers : null
      ),
    }),
  // Mirrors the real selector contract: undefined until a snapshot arrives.
  useTrackStateSelector: (selector: (snapshot: unknown) => unknown) =>
    trackState.snapshot === undefined
      ? undefined
      : selector(trackState.snapshot),
  // Read by GantrySessionDataProvider for the other tabs; unused here.
  trackStateSelectors: {
    sessionNum: (snapshot: { sessionNum?: number | null }) =>
      snapshot.sessionNum,
  },
  useLapTimesStoreUpdater: vi.fn(),
  useLapHistorySnapshot: () => undefined,
  useReplayContextSnapshot: () => ({
    mode: 'live',
    provenance: 'none',
    subSessionId: '',
  }),
  useArchivedLapHistory: () => null,
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => {
  const none: unknown[] = [];
  return { useDriverStandings: () => none };
});

vi.mock('@irdashies/domain/standings/useQualifyingGrid', () => ({
  useQualifyingResults: () => undefined,
}));

const makeIncident = (overrides: Partial<Incident> = {}): Incident => ({
  id: 'incident-1',
  carIdx: 4,
  driverName: 'Vogel',
  carNumber: '7',
  teamName: '',
  sessionNum: 0,
  sessionTime: 120,
  lapNum: 3,
  replayFrameNum: 900,
  type: IncidentType.Crash,
  lapDistPct: 0.5,
  timestamp: 0,
  ...overrides,
});

const incident = makeIncident();

const WEEKEND = [
  { SessionNum: 0, SessionName: 'PRACTICE', SessionType: 'Practice' },
  { SessionNum: 1, SessionName: 'QUALIFY', SessionType: 'Lone Qualify' },
  { SessionNum: 2, SessionName: 'RACE', SessionType: 'Race' },
];

const { GantryIncidents } = await import('./GantryIncidents');
const { GantrySessionHoldProvider } =
  await import('../../hooks/useGantrySessionHold');
const { GantrySessionDataProvider } =
  await import('../../hooks/useGantrySessionData');

const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: GantrySessionDataProvider });

// The Gantry's tree: the hold above the data provider, and the feed only
// mounted while its tab is showing.
const gantry = (running: boolean, showFeed: boolean) => (
  <GantrySessionHoldProvider running={running}>
    <GantrySessionDataProvider>
      {showFeed && <GantryIncidents />}
    </GantrySessionDataProvider>
  </GantrySessionHoldProvider>
);

const closeSim = (rerender: (ui: ReactElement) => void, showFeed: boolean) => {
  trackState.snapshot = undefined;
  rerender(gantry(false, showFeed));
  // The disconnect reset empties the session store; incidents stay.
  feed.sessions = undefined;
  act(() => sessionStore.notify());
};

const sessionOptions = () =>
  within(screen.getByLabelText('Filter incidents by session'))
    .getAllByRole('option')
    .map((o) => o.textContent);

const replayButtons = () =>
  screen.getAllByRole('button', { name: /^-\d+s$/ }) as HTMLButtonElement[];

const headings = () =>
  screen.queryAllByRole('heading').map((h) => h.textContent ?? '');

beforeEach(() => {
  trackState.snapshot = undefined;
  feed.incidents = [incident];
  feed.filtered = [incident];
  feed.sessionFilter = 'all';
  feed.setSessionFilter = vi.fn();
  feed.sessions = undefined;
});

describe('GantryIncidents replay state', () => {
  it('enables the replay buttons when the track-state snapshot says a replay is playing', () => {
    trackState.snapshot = { isReplayPlaying: true };
    render(<GantryIncidents />);

    expect(replayButtons().length).toBeGreaterThan(0);
    replayButtons().forEach((button) => expect(button.disabled).toBe(false));
  });

  it('disables the replay buttons while the sim is live', () => {
    trackState.snapshot = { isReplayPlaying: false };
    render(<GantryIncidents />);

    replayButtons().forEach((button) => expect(button.disabled).toBe(true));
    expect(screen.getByText(/replay unavailable/i)).toBeTruthy();
  });

  it('does not retain stale replay state when the snapshot goes missing', () => {
    trackState.snapshot = { isReplayPlaying: true };
    const { unmount } = render(<GantryIncidents />);
    replayButtons().forEach((button) => expect(button.disabled).toBe(false));
    unmount();

    trackState.snapshot = undefined;
    render(<GantryIncidents />);

    replayButtons().forEach((button) => expect(button.disabled).toBe(true));
  });
});

describe('GantryIncidents sessions', () => {
  const qualifying = makeIncident({ id: 'q', sessionNum: 1 });
  const race = makeIncident({
    id: 'r',
    sessionNum: 2,
    carIdx: 9,
    driverName: 'Anders',
  });

  beforeEach(() => {
    feed.sessions = WEEKEND;
    feed.incidents = [race, qualifying];
    feed.filtered = [race, qualifying];
  });

  it('puts a separator above each session and tags the live one', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    render(<GantryIncidents />);

    expect(headings()).toEqual(['RaceLIVE1 incident', 'Qualify1 incident']);
  });

  it('tags the current session as a replay while one is playing', () => {
    trackState.snapshot = { isReplayPlaying: true, sessionNum: 2 };
    render(<GantryIncidents />);

    expect(headings()[0]).toContain('REPLAY');
  });

  it('shows the current session even before it has incidents', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    feed.filtered = [qualifying];
    render(<GantryIncidents />);

    expect(headings()[0]).toBe('RaceLIVE— no incidents yet');
  });

  it('shows no live separator when a past session is selected', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    feed.sessionFilter = 1;
    feed.filtered = [qualifying];
    render(<GantryIncidents />);

    expect(headings()).toEqual(['Qualify1 incident']);
  });

  it('lists sessions with incidents, newest first, and selects by number', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    render(<GantryIncidents />);

    const select = screen.getByLabelText('Filter incidents by session');
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual([
      'All sessions',
      'Current session',
      'Race (1)',
      'Qualify (1)',
    ]);

    fireEvent.change(select, { target: { value: '1' } });
    expect(feed.setSessionFilter).toHaveBeenCalledWith(1);
    fireEvent.change(select, { target: { value: 'current' } });
    expect(feed.setSessionFilter).toHaveBeenCalledWith('current');
  });

  it('keeps the session names after the sim closes', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    const { rerender } = rtlRender(gantry(true, true));

    closeSim(rerender, true);

    expect(sessionOptions()).toEqual([
      'All sessions',
      'Current session',
      'Race (1)',
      'Qualify (1)',
    ]);
  });

  it('keeps the session names for a feed opened after the sim closes', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    const { rerender } = rtlRender(gantry(true, false));

    closeSim(rerender, false);
    rerender(gantry(false, true));

    expect(sessionOptions()).toEqual([
      'All sessions',
      'Current session',
      'Race (1)',
      'Qualify (1)',
    ]);
  });

  it('lists only drivers from the selected session', () => {
    trackState.snapshot = { isReplayPlaying: false, sessionNum: 2 };
    feed.sessionFilter = 'current';
    render(<GantryIncidents />);

    const select = screen.getByLabelText('Filter incidents by driver');
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual(['All Drivers', 'Anders']);
  });
});
