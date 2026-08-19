import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useLapTimesStoreUpdater } from '@irdashies/context';
import { GantryStandings } from './GantryStandings';

vi.mock('@irdashies/domain', () => ({
  useHighlightColor: () => 0xffffff,
}));

vi.mock('@irdashies/domain/standings/useDriverStandings', () => ({
  useDriverStandings: vi.fn(() => []),
}));

const dashboardMock = vi.hoisted(() => ({
  current: undefined as unknown,
}));

vi.mock('@irdashies/context', () => ({
  useLapTimesStoreUpdater: vi.fn(),
  useDashboard: () => ({ currentDashboard: dashboardMock.current }),
}));

// Only the fields GantryDriverRow actually reads. The real standings entry is
// far wider, so this is cast rather than filled in.
const driverRow = (name: string) =>
  ({
    carIdx: 7,
    position: 1,
    classPosition: 1,
    isPlayer: false,
    dnf: false,
    driver: { name, carNum: '503', license: 'A 4.99', rating: 4300 },
    carClass: { color: 0xffffff, name: 'GT3' },
    lapTimeDeltas: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const withNameFormat = (driverNameFormat?: string) => {
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

  it.each([
    ['surname', 'Verstappen'],
    ['name-surname', 'Max Verstappen'],
    ['n.-surname', 'M. Verstappen'],
    ['name-middlename-surname', 'Max Emilian Verstappen'],
  ])('writes driver names as %s', (format, expected) => {
    withNameFormat(format);
    vi.mocked(useDriverStandings).mockReturnValue([
      ['gt3', [driverRow('Max Emilian Verstappen')]],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const { getByText } = render(<GantryStandings followedCarIdx={null} />);

    expect(getByText(expected)).toBeTruthy();
  });

  it('falls back to surname when the dashboard has not loaded', () => {
    withNameFormat(undefined);
    vi.mocked(useDriverStandings).mockReturnValue([
      ['gt3', [driverRow('Max Emilian Verstappen')]],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const { getByText } = render(<GantryStandings followedCarIdx={null} />);

    expect(getByText('Verstappen')).toBeTruthy();
  });
});
