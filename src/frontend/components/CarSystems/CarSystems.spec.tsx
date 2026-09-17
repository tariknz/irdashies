import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CarSystemsSnapshot } from '@irdashies/types';
import * as Context from '@irdashies/context';
import { CarSystems } from './CarSystems';

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useCarSystemsSnapshot: vi.fn(),
    useDrivingState: vi.fn(),
    useGeneralSettings: vi.fn(),
    useSessionVisibility: vi.fn(),
    useSessionStore: vi.fn(),
    useDriverCarIdx: vi.fn(),
  };
});

const DEFAULT_SETTINGS = {
  rows: ['dcBrakeBias', 'dcABS'],
  showUnsupportedRows: true,
  showOffRows: true,
  background: { opacity: 80 },
  showOnlyWhenOnTrack: false,
};

// Prefixed so Vitest allows the hoisted vi.mock factory to close over it.
const mockSettings = { ...DEFAULT_SETTINGS };

vi.mock('./hooks/useCarSystemsSettings', () => ({
  useCarSystemsSettings: () => mockSettings,
}));

const snapshot: CarSystemsSnapshot = {
  adjustments: [
    {
      key: 'dcBrakeBias',
      label: 'Brake Bias',
      value: 54.5,
      isOff: false,
      precision: 1,
      unit: '%',
    },
    {
      key: 'dcABS',
      label: 'ABS',
      value: 3,
      isOff: false,
      precision: 0,
    },
  ],
  discovered: true,
  sessionNum: 0,
  version: 1,
};

const inCar = (carPath: string | undefined) => {
  vi.mocked(Context.useDriverCarIdx).mockReturnValue(2);
  // The store is read with a selector, so the mock has to apply it rather than
  // hand back the whole state - otherwise every lookup silently reads
  // undefined and the test passes for the wrong reason.
  vi.mocked(Context.useSessionStore).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((selector: (state: any) => unknown) =>
      selector({
        session: {
          DriverInfo: {
            Drivers: carPath ? [{ CarIdx: 2, CarPath: carPath }] : [],
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any
  );
};

describe('CarSystems per-car labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSettings, DEFAULT_SETTINGS);
    vi.mocked(Context.useCarSystemsSnapshot).mockReturnValue(snapshot);
    vi.mocked(Context.useDrivingState).mockReturnValue({
      isDriving: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(Context.useGeneralSettings).mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { compactMode: 'normal' } as any
    );
    vi.mocked(Context.useSessionVisibility).mockReturnValue(true);
  });

  it('uses the catalogue name on a car that does not rename the channel', () => {
    inCar('bmwm4gt3');

    render(<CarSystems />);

    expect(screen.getByText('ABS')).toBeInTheDocument();
    expect(screen.queryByText('MIGR')).not.toBeInTheDocument();
  });

  it('uses the car-specific name where the car renames the channel', () => {
    inCar('cadillacvseriesrgtp');

    render(<CarSystems />);

    expect(screen.getByText('MIGR')).toBeInTheDocument();
    expect(screen.queryByText('ABS')).not.toBeInTheDocument();
  });

  it('still shows the value under the renamed header', () => {
    inCar('cadillacvseriesrgtp');

    render(<CarSystems />);

    // The rename is cosmetic - the row is still matched on dcABS, so a car
    // that renames it must not end up with a blanked-out column.
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not let dcPeakBrakeBias overwrite the brake bias column', () => {
    // The W13 publishes both: a live 52% bias and a migration dial reading 3.
    // Folding them into one column showed the migration setting as the bias.
    vi.mocked(Context.useCarSystemsSnapshot).mockReturnValue({
      ...snapshot,
      adjustments: [
        {
          key: 'dcBrakeBias',
          label: 'Brake Bias',
          value: 52,
          isOff: false,
          precision: 1,
          unit: '%',
        },
        {
          key: 'dcPeakBrakeBias',
          label: 'Peak Brake Bias',
          value: 3,
          isOff: false,
          precision: 0,
        },
      ],
    });
    inCar('mercedesw13');

    render(<CarSystems />);

    // Under the old fold the bias column rendered the migration adjustment,
    // so it read a bare "3" - its own precision and no unit - rather than 52.0%.
    expect(screen.getByText('52.0%')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('hides a system the driver switched off when asked to', () => {
    vi.mocked(Context.useCarSystemsSnapshot).mockReturnValue({
      ...snapshot,
      adjustments: [
        {
          key: 'dcBrakeBias',
          label: 'Brake Bias',
          value: 54.5,
          isOff: false,
          precision: 1,
          unit: '%',
        },
        {
          key: 'dcABS',
          label: 'ABS',
          value: 0,
          isOff: true,
          precision: 0,
        },
      ],
    });
    mockSettings.showOffRows = false;
    inCar('bmwm4gt3');

    render(<CarSystems />);

    expect(screen.getByText('BB')).toBeInTheDocument();
    expect(screen.queryByText('ABS')).not.toBeInTheDocument();
  });

  it('keeps a switched-off system by default', () => {
    // Off and unsupported are different facts, so turning off one filter must
    // not quietly take the other's rows with it.
    vi.mocked(Context.useCarSystemsSnapshot).mockReturnValue({
      ...snapshot,
      adjustments: [
        {
          key: 'dcABS',
          label: 'ABS',
          value: 0,
          isOff: true,
          precision: 0,
        },
      ],
    });
    mockSettings.showUnsupportedRows = false;
    inCar('bmwm4gt3');

    render(<CarSystems />);

    expect(screen.getByText('ABS')).toBeInTheDocument();
  });

  it('falls back to the catalogue name when session data has no player entry', () => {
    inCar(undefined);

    render(<CarSystems />);

    expect(screen.getByText('ABS')).toBeInTheDocument();
  });
});
