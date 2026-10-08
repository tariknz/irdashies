import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useLapTimesStoreUpdater } from '@irdashies/context';
import { GantryStandings } from './GantryStandings';
import { GantrySessionDataProvider } from '../../hooks/useGantrySessionData';
import type { NameFormat } from '@irdashies/types';

vi.mock('@irdashies/domain', () => ({
  useHighlightColor: () => 0xffffff,
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: vi.fn(() => []),
}));

const dashboardMock = vi.hoisted(() => ({
  current: undefined as unknown,
}));
const simulatorMock = vi.hoisted(() => ({
  current: 'iracing' as 'iracing' | 'lmu' | null,
}));

vi.mock('@irdashies/context', () => ({
  useLapTimesStoreUpdater: vi.fn(),
  useDashboard: () => ({ currentDashboard: dashboardMock.current }),
  // Read by GantrySessionDataProvider for the lap graph; unused here.
  trackStateSelectors: { sessionNum: () => null },
  useTrackStateSelector: () => null,
  useLapHistorySnapshot: () => undefined,
  useReplayContextSnapshot: () => ({
    mode: 'live',
    provenance: 'none',
    subSessionId: '',
  }),
  useArchivedLapHistory: () => null,
  // iRacing by default, so these specs keep exercising the rating badge.
  useActiveSimulator: () => simulatorMock.current,
}));

vi.mock('@irdashies/domain/standings/useQualifyingGrid', () => ({
  useQualifyingResults: () => undefined,
}));

const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: GantrySessionDataProvider });

type StandingsByClass = ReturnType<typeof useDriverStandings>;
type StandingsRow = StandingsByClass[number][1][number];

// Only the fields GantryDriverRow reads. The real row carries far more, so the
// rest is filled in as a partial rather than stubbed out.
const driverRow = (name: string): StandingsRow =>
  ({
    carIdx: 7,
    position: 1,
    classPosition: 1,
    isPlayer: false,
    dnf: false,
    driver: { name, carNum: '503', license: 'A 4.99', rating: 4300 },
    carClass: {
      id: 1,
      color: 0xffffff,
      name: 'GT3',
      relativeSpeed: 0,
      estLapTime: 90,
    },
    lapTimeDeltas: [],
  }) as Partial<StandingsRow> as StandingsRow;

const standings = (rows: StandingsRow[]): StandingsByClass =>
  [['gt3', rows]] as unknown as StandingsByClass;

const withNameFormat = (driverNameFormat: NameFormat | undefined) => {
  dashboardMock.current = driverNameFormat
    ? { widgets: [{ id: 'gantry', config: { driverNameFormat } }] }
    : undefined;
};

describe('GantryStandings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withNameFormat(undefined);
  });

  it('enables the three displayed lap-delta columns', () => {
    render(<GantryStandings followedCarIdx={null} />);

    expect(useLapTimesStoreUpdater).toHaveBeenCalledWith(true);
    expect(useDriverStandings).toHaveBeenCalledWith(
      expect.objectContaining({
        lapTimeDeltas: { enabled: true, numLaps: 3 },
      }),
      { showAll: true }
    );
  });

  // Every NameFormat the picker offers.
  it.each([
    ['surname', 'Verstappen'],
    ['surname-n.', 'Verstappen M.'],
    ['n.-surname', 'M. Verstappen'],
    ['name-surname', 'Max Verstappen'],
    ['name-m.-surname', 'Max E. Verstappen'],
    ['name-middlename-surname', 'Max Emilian Verstappen'],
  ] as [NameFormat, string][])(
    'writes driver names as %s',
    (format, expected) => {
      withNameFormat(format);
      vi.mocked(useDriverStandings).mockReturnValue(
        standings([driverRow('Max Emilian Verstappen')])
      );

      const { getByText } = render(<GantryStandings followedCarIdx={null} />);

      expect(getByText(expected)).toBeTruthy();
    }
  );

  it('falls back to surname when the dashboard has not loaded', () => {
    withNameFormat(undefined);
    vi.mocked(useDriverStandings).mockReturnValue(
      standings([driverRow('Max Emilian Verstappen')])
    );

    const { getByText } = render(<GantryStandings followedCarIdx={null} />);

    expect(getByText('Verstappen')).toBeTruthy();
  });
});

describe('GantryStandings rating badge', () => {
  afterEach(() => {
    simulatorMock.current = 'iracing';
  });

  it('shows the rating under a simulator that has one', () => {
    simulatorMock.current = 'iracing';
    const { container } = render(<GantryStandings followedCarIdx={null} />);
    // The mock driver is rated 4300, rendered as "4.3k" by this format.
    expect(container.textContent).toContain('4.3k');
  });

  it('shows nothing under a simulator with no rating system', () => {
    // LMU has neither iRating nor a licence, so the badge would otherwise
    // render its "AI" fallback for every driver.
    simulatorMock.current = 'lmu';
    const { container } = render(<GantryStandings followedCarIdx={null} />);

    expect(container.textContent).not.toContain('4.3k');
    expect(container.textContent).not.toContain('AI');
  });
});
