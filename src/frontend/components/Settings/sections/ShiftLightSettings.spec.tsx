import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, Session } from '@irdashies/types';
import { ShiftLightSettings } from './ShiftLightSettings';

const mocks = vi.hoisted(() => ({
  onDashboardUpdated: vi.fn(),
  session: undefined as unknown,
}));

vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: dashboard,
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
    useActiveSimulator: () => 'lmu',
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
    useSessionStore: (selector: (state: { session: unknown }) => unknown) =>
      selector({ session: mocks.session }),
  };
});

const dashboard = {
  widgets: [
    {
      id: 'shiftlight',
      enabled: true,
      layout: { x: 0, y: 0, width: 200, height: 60 },
      config: {
        shiftPointSettings: {
          enabled: true,
          indicatorType: 'glow',
          indicatorColor: '#00ff00',
          carConfigs: {},
        },
        background: { opacity: 80 },
        showRpmText: true,
        showOnlyWhenOnTrack: true,
        sessionVisibility: { race: true },
      },
    },
  ],
} as unknown as DashboardLayout;

const lmuSession = (carModel: string | undefined) =>
  ({
    DriverInfo: {
      DriverCarIdx: 1,
      DriverCarRedLine: 8500,
      DriverCarGearNumForward: 6,
      DriverCarSLShiftRPM: 7300,
      Drivers: [
        { CarIdx: 0, CarModel: 'BMW M4 LMGT3' },
        { CarIdx: 1, CarModel: carModel },
      ],
    },
  }) as unknown as Session;

const savedShiftPoints = () => {
  const saved = mocks.onDashboardUpdated.mock.lastCall?.[0] as DashboardLayout;
  const widget = saved.widgets.find((w) => w.id === 'shiftlight');
  return (widget?.config as { shiftPointSettings: { carConfigs: object } })
    .shiftPointSettings.carConfigs;
};

describe('ShiftLightSettings custom shift points', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
    localStorage.setItem('shiftlightTab', 'options');
  });

  it('offers the LMU car being driven, keyed by its model', () => {
    mocks.session = lmuSession('Ferrari 296 LMGT3');
    render(<ShiftLightSettings />);

    fireEvent.change(screen.getAllByRole('combobox')[1], {
      target: { value: 'Ferrari 296 LMGT3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const gears = Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((g) => [String(g), { shiftRpm: 7300 }])
    );
    expect(savedShiftPoints()).toEqual({
      'Ferrari 296 LMGT3': {
        enabled: true,
        carId: 'Ferrari 296 LMGT3',
        carName: 'Ferrari 296 LMGT3',
        gearCount: 6,
        redlineRpm: 8500,
        gearShiftPoints: gears,
      },
    });
  });

  it('offers no current car where the sim names none by model', () => {
    mocks.session = lmuSession(undefined);
    render(<ShiftLightSettings />);
    expect(screen.queryByText(/\(current car\)/)).not.toBeInTheDocument();
  });
});
