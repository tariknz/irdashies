import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { GantrySettings } from './GantrySettings';

// GantrySettings is memo()'d and takes no props, so a plain rerender() would be
// skipped. Back the mocked context with a real external store instead, which is
// how the dashboard actually reaches the component.
const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    onDashboardUpdated: vi.fn(),
    getDashboard: () => dashboard,
    setDashboard: (next: DashboardLayout | undefined) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useDashboard: () => ({
      currentDashboard: useSyncExternalStore((onChange) => {
        mocks.listeners.add(onChange);
        return () => mocks.listeners.delete(onChange);
      }, mocks.getDashboard),
      onDashboardUpdated: mocks.onDashboardUpdated,
    }),
    useTrackStateSelector: () => 1,
  };
});

const dashboardWith = (sessionRetention: 'all' | 5 | 10 | 20) =>
  ({
    widgets: [
      {
        id: 'gantry',
        enabled: true,
        layout: { x: 0, y: 0, width: 1920, height: 1080 },
        config: {
          slowSpeedThreshold: 21,
          slowDurationSeconds: 10,
          impactDecelKmhPerSec: 150,
          impactMinSpeed: 20,
          offTrackDurationSeconds: 3,
          pitEntryDurationSeconds: 3,
          cooldownSeconds: 5,
          sessionRetention,
          speedUnit: 'km/h',
        },
      },
    ],
  }) as unknown as DashboardLayout;

// The only saved value rendered on the default "Options" tab.
const retentionValue = () =>
  (screen.getByRole('combobox', { name: '' }) as HTMLSelectElement).value;

describe('GantrySettings', () => {
  it('shows the saved config that arrives after the first render', () => {
    mocks.setDashboard(undefined);
    render(<GantrySettings />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    act(() => mocks.setDashboard(dashboardWith(5)));

    // Would be the default 'all' if the local state kept its first-render value.
    expect(retentionValue()).toBe('5');
  });

  it('re-seeds when the dashboard is swapped for another profile', () => {
    mocks.setDashboard(dashboardWith(5));
    render(<GantrySettings />);
    expect(retentionValue()).toBe('5');

    act(() => mocks.setDashboard(dashboardWith(20)));

    expect(retentionValue()).toBe('20');
  });
});
