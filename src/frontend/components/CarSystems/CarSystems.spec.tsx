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

vi.mock('./hooks/useCarSystemsSettings', () => ({
  useCarSystemsSettings: () => ({
    rows: ['dcBrakeBias', 'dcABS'],
    showUnsupportedRows: true,
    background: { opacity: 80 },
    showOnlyWhenOnTrack: false,
  }),
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
    inCar('dallarap217');

    render(<CarSystems />);

    expect(screen.getByText('MIGR')).toBeInTheDocument();
    expect(screen.queryByText('ABS')).not.toBeInTheDocument();
  });

  it('still shows the value under the renamed header', () => {
    inCar('dallarap217');

    render(<CarSystems />);

    // The rename is cosmetic - the row is still matched on dcABS, so a car
    // that renames it must not end up with a blanked-out column.
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('falls back to the catalogue name when session data has no player entry', () => {
    inCar(undefined);

    render(<CarSystems />);

    expect(screen.getByText('ABS')).toBeInTheDocument();
  });
});
