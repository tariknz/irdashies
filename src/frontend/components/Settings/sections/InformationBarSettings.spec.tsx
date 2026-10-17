import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type DashboardLayout,
} from '@irdashies/types';
import { InformationBarSettings } from './InformationBarSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  onDashboardUpdated: vi.fn(),
}));

vi.mock('@irdashies/context', async () => {
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: mocks.dashboard,
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

const additionalItems = [
  ['fuelLevel', 'Fuel Level'],
  ['lastLap', 'Last Lap'],
  ['bestLap', 'Best Lap'],
  ['topSpeed', 'Top Speed'],
  ['manufacturerPosition', 'Manufacturer Position'],
  ['classRank', 'Class Rank'],
] as const;
const defaults = getWidgetDefaultConfig('infobar');
// Fixed historical fixture: future default additions must also be backfilled.
const legacyOrder = [
  'sessionName',
  'sessionTime',
  'sessionLaps',
  'incidentCount',
  'brakeBias',
  'localTime',
  'sessionClockTime',
  'trackWetness',
  'precipitation',
  'airTemperature',
  'trackTemperature',
  'wind',
  'trackName',
];

// This is the same merge used at the dashboard-load boundary.
const load = (saved: Record<string, unknown>) =>
  deepMergeConfig(defaults as unknown as Record<string, unknown>, saved);
const dashboardFor = (config: Record<string, unknown>): DashboardLayout => ({
  widgets: [
    {
      id: 'infobar',
      enabled: true,
      layout: { x: 0, y: 0, width: 1000, height: 60 },
      config,
    },
  ],
});
const itemSwitch = (label: string) =>
  within(
    screen.getByText(label).parentElement?.parentElement as HTMLElement
  ).getByRole('switch');
const savedConfig = () => {
  const dashboard = mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as
    DashboardLayout | undefined;
  return dashboard?.widgets[0].config;
};

beforeEach(() => {
  localStorage.clear();
  mocks.onDashboardUpdated.mockClear();
});

describe('Information Bar shared items', () => {
  it('adds every shared option disabled to a legacy dashboard without changing saved order or settings', () => {
    const savedOrder = [...legacyOrder].reverse();
    const saved = {
      displayOrder: savedOrder,
      sessionName: { enabled: false },
      trackTemperature: { enabled: true, unit: 'Imperial' },
      background: { opacity: 42 },
    };
    const merged = load(saved);

    const mergedOrder = merged.displayOrder as string[];
    expect(mergedOrder.filter((id) => savedOrder.includes(id))).toEqual(
      savedOrder
    );
    expect(mergedOrder).toEqual(expect.arrayContaining(defaults.displayOrder));
    expect(new Set(mergedOrder).size).toBe(mergedOrder.length);
    expect(merged.sessionName).toEqual({ enabled: false });
    expect(merged.trackTemperature).toEqual({
      enabled: true,
      unit: 'Imperial',
    });
    expect(merged.background).toEqual({ opacity: 42 });
    for (const [id] of additionalItems) {
      expect(merged[id]).toEqual({ enabled: false });
    }
    expect(saved.displayOrder).toEqual(savedOrder);
  });

  it('shows all six selectable settings after loading a legacy dashboard', () => {
    mocks.dashboard = dashboardFor(load({ displayOrder: legacyOrder }));
    render(<InformationBarSettings />);

    for (const [, label] of additionalItems) {
      expect(itemSwitch(label)).toHaveAttribute('aria-checked', 'false');
    }
  });

  it.each(additionalItems)(
    'saves %s when enabled and retains it across reloads',
    (id, label) => {
      mocks.dashboard = dashboardFor(
        load({ displayOrder: legacyOrder, background: { opacity: 42 } })
      );
      const { unmount } = render(<InformationBarSettings />);

      fireEvent.click(itemSwitch(label));

      expect(savedConfig()?.[id]).toEqual({ enabled: true });
      expect(savedConfig()?.background).toEqual({ opacity: 42 });
      mocks.dashboard = dashboardFor(load(savedConfig() ?? {}));
      unmount();
      render(<InformationBarSettings />);
      expect(itemSwitch(label)).toHaveAttribute('aria-checked', 'true');
    }
  );

  it('retains manufacturer visibility choices when enabling the item', () => {
    mocks.dashboard = dashboardFor(
      load({
        displayOrder: legacyOrder,
        manufacturerPosition: {
          enabled: false,
          hideIfSingleMake: true,
          hideIfSingleDriver: false,
        },
      })
    );
    render(<InformationBarSettings />);
    fireEvent.click(itemSwitch('Manufacturer Position'));
    expect(savedConfig()?.manufacturerPosition).toEqual({
      enabled: true,
      hideIfSingleMake: true,
      hideIfSingleDriver: false,
    });
  });

  it('keeps newly available items in the reset order', () => {
    mocks.dashboard = dashboardFor(load({ displayOrder: legacyOrder }));
    render(<InformationBarSettings />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to Default Order' })
    );
    expect(savedConfig()?.displayOrder).toEqual(defaults.displayOrder);
  });
});
