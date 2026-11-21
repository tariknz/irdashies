import { mockDashboardUpdater } from '../mockDashboardUpdater';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWidgetDefaultConfig, type DashboardLayout } from '@irdashies/types';
import { FasterCarsFromBehindSettings } from './FasterCarsFromBehindSettings';

const mocks = vi.hoisted(() => ({
  dashboard: undefined as DashboardLayout | undefined,
  listeners: new Set<() => void>(),
  onDashboardUpdated: vi.fn((dashboard: DashboardLayout) => {
    mocks.dashboard = dashboard;
    mocks.listeners.forEach((listener) => listener());
  }),
}));

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore(
        (onChange) => {
          mocks.listeners.add(onChange);
          return () => mocks.listeners.delete(onChange);
        },
        () => mocks.dashboard
      ),
      onDashboardUpdated: mockDashboardUpdater(
        () => mocks.dashboard,
        mocks.onDashboardUpdated
      ),
    }),
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

const WIDGET_ID = 'fastercarsfrombehind';

const dashboardWith = (overrides: Record<string, unknown> = {}) => {
  mocks.dashboard = {
    widgets: [
      {
        id: WIDGET_ID,
        enabled: true,
        layout: { x: 0, y: 0, width: 405, height: 120 },
        config: {
          ...getWidgetDefaultConfig(WIDGET_ID),
          ...overrides,
        } as unknown as Record<string, unknown>,
      },
    ],
  };
};

const savedConfig = () => {
  const dashboard = mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as
    DashboardLayout | undefined;
  return dashboard?.widgets.find((widget) => widget.id === WIDGET_ID)?.config;
};

const rowLabels = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-sortable-id]')).map(
    (row) => within(row).getAllByRole('switch')[0].getAttribute('aria-label')
  );

const itemSwitch = (name: string) => screen.getByRole('switch', { name });

const formatTrigger = () =>
  screen.queryByRole('button', { name: 'iRacing rating format' });

beforeEach(() => {
  localStorage.clear();
  mocks.onDashboardUpdated.mockClear();
  dashboardWith();
});

describe('FasterCarsFromBehindSettings display order', () => {
  it('lists Driver Name, Rating and Distance in the default order', () => {
    render(<FasterCarsFromBehindSettings />);

    expect(screen.getByRole('heading', { name: 'Display Order' })).toBeTruthy();
    expect(rowLabels()).toEqual(['Driver Name', 'Rating', 'Distance']);
    expect(screen.queryByText('Show Driver Badge')).toBeNull();
  });

  it.each([
    ['Driver Name', 'showName', true],
    ['Rating', 'showBadge', false],
    ['Distance', 'showDistance', true],
  ] as const)('toggling %s writes %s', (label, configKey, initiallyEnabled) => {
    render(<FasterCarsFromBehindSettings />);
    expect(itemSwitch(label)).toHaveAttribute(
      'aria-checked',
      String(initiallyEnabled)
    );

    fireEvent.click(itemSwitch(label));

    expect(savedConfig()?.[configKey]).toBe(!initiallyEnabled);
    expect(itemSwitch(label)).toHaveAttribute(
      'aria-checked',
      String(!initiallyEnabled)
    );
  });

  it('offers Remove Numbers From Names only while Driver Name is on', () => {
    render(<FasterCarsFromBehindSettings />);
    const removeNumbers = () =>
      screen.queryByRole('switch', { name: 'Remove Numbers From Names' });

    expect(removeNumbers()).not.toBeNull();
    fireEvent.click(removeNumbers() as HTMLElement);
    expect(savedConfig()?.removeNumbersFromName).toBe(true);

    fireEvent.click(itemSwitch('Driver Name'));
    expect(removeNumbers()).toBeNull();
  });

  it('hides Remove Numbers From Names when Driver Name is saved off', () => {
    dashboardWith({ showName: false });
    render(<FasterCarsFromBehindSettings />);

    expect(
      screen.queryByRole('switch', { name: 'Remove Numbers From Names' })
    ).toBeNull();
  });

  it('offers the iRacing rating formats only while Rating is on', () => {
    render(<FasterCarsFromBehindSettings />);
    expect(formatTrigger()).toBeNull();

    fireEvent.click(itemSwitch('Rating'));
    fireEvent.click(formatTrigger() as HTMLElement);

    const options = within(
      screen.getByRole('listbox', { name: 'iRacing rating formats' })
    ).getAllByRole('option');
    expect(options).toHaveLength(12);
    expect(options[4]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(options[10]);
    expect(savedConfig()?.badgeFormat).toBe('rating-bw-no-license');
    expect(savedConfig()?.showBadge).toBe(true);

    fireEvent.click(itemSwitch('Rating'));
    expect(formatTrigger()).toBeNull();
  });

  it('respects a saved display order and writes a new one on reorder', () => {
    dashboardWith({ displayOrder: ['distance', 'driverName', 'badge'] });
    render(<FasterCarsFromBehindSettings />);

    expect(rowLabels()).toEqual(['Distance', 'Driver Name', 'Rating']);

    fireEvent.click(screen.getByRole('button', { name: 'Move Distance down' }));

    expect(savedConfig()?.displayOrder).toEqual([
      'driverName',
      'distance',
      'badge',
    ]);
    expect(rowLabels()).toEqual(['Driver Name', 'Distance', 'Rating']);
  });

  it('resets to the default order', () => {
    dashboardWith({ displayOrder: ['badge', 'distance', 'driverName'] });
    render(<FasterCarsFromBehindSettings />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to Default Order' })
    );

    expect(savedConfig()?.displayOrder).toEqual([
      'driverName',
      'badge',
      'distance',
    ]);
    expect(rowLabels()).toEqual(['Driver Name', 'Rating', 'Distance']);
  });
});
