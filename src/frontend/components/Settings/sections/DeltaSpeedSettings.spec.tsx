import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { DeltaSpeedSettings } from './DeltaSpeedSettings';

// The dashboard reaches this component through context, so back the mock with a
// real external store rather than a module variable — a plain rerender would not
// re-run the hook with a new value.
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
  };
});

const dashboardWith = (unit: 'auto' | 'km/h' | 'mph') =>
  ({
    widgets: [
      {
        id: 'deltaspeed',
        enabled: true,
        layout: { x: 0, y: 0, width: 160, height: 40 },
        config: {
          background: { opacity: 80 },
          unit,
          scaleKph: 15,
          scaleMph: 10,
          capKph: 30,
          capMph: 20,
          updateThresholdKph: 0.3,
          updateThresholdMph: 0.2,
          showNumber: true,
          showOnlyWhenOnTrack: true,
          sessionVisibility: { race: true },
        },
      },
    ],
  }) as unknown as DashboardLayout;

const unitValue = () =>
  (screen.getByRole('combobox') as HTMLSelectElement).value;

describe('DeltaSpeedSettings', () => {
  it('shows the saved config that arrives after the first render', () => {
    mocks.setDashboard(undefined);
    render(<DeltaSpeedSettings />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    act(() => mocks.setDashboard(dashboardWith('mph')));

    // Would fall back to the default unit if the local state kept the value it
    // captured on the first render, and the next edit would persist that over
    // the saved config.
    expect(unitValue()).toBe('mph');
  });

  it('re-seeds when the dashboard is swapped for another profile', () => {
    mocks.setDashboard(dashboardWith('mph'));
    render(<DeltaSpeedSettings />);
    expect(unitValue()).toBe('mph');

    act(() => mocks.setDashboard(dashboardWith('km/h')));

    expect(unitValue()).toBe('km/h');
  });
});
