import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, RadarConfig } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { RadarSettings } from './RadarSettings';

// The dashboard reaches this component through context, so back the mock with a
// real external store rather than a module variable — a plain rerender would not
// re-run the hook with a new value.
const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    getDashboard: () => dashboard,
    setDashboard: (next: DashboardLayout | undefined) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
    updateDashboard: (next: DashboardLayout) => {
      dashboard = next;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock('@irdashies/context', async () => {
  const { useSyncExternalStore: subscribe } = await import('react');
  const { DEFAULT_SIM_WIDGET_SUPPORT } = await import('@irdashies/types');
  return {
    useDashboard: () => ({
      currentDashboard: subscribe((onChange) => {
        mocks.listeners.add(onChange);
        return () => mocks.listeners.delete(onChange);
      }, mocks.getDashboard),
      onDashboardUpdated: mocks.updateDashboard,
    }),
    // No simulator detected, so BaseSettingsSection greys nothing and the
    // radar's own settings are the only thing these tests exercise.
    useActiveSimulator: () => null,
    useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  };
});

const radarConfig = (overrides: Partial<RadarConfig> = {}): RadarConfig => ({
  ...getWidgetDefaultConfig('radar'),
  ...overrides,
});

const dashboardWith = (config: RadarConfig) =>
  ({
    widgets: [
      {
        id: 'radar',
        enabled: true,
        layout: { x: 0, y: 0, width: 300, height: 300 },
        config,
      },
    ],
  }) as unknown as DashboardLayout;

/**
 * The Options tab renders several sliders, so the right one is picked by the
 * label it belongs to rather than by position.
 */
const sliderFor = (label: string) => {
  const row = screen.getByText(label).closest('label');
  const input = row?.parentElement?.querySelector('input[type="range"]');
  if (!input) throw new Error(`no slider for ${label}`);
  return input as HTMLInputElement;
};
const sliderValue = (label: string) => sliderFor(label).value;
const rangeValue = () => sliderValue('Radar Range');

const openOptionsTab = () => {
  // "Options" also titles the panel it opens, so select the tab button itself.
  act(() => screen.getByRole('button', { name: 'Options' }).click());
};

describe('RadarSettings', () => {
  it('shows the saved config that arrives after the first render', () => {
    mocks.setDashboard(undefined);
    render(<RadarSettings />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    act(() =>
      mocks.setDashboard(dashboardWith(radarConfig({ radarRange: 22 })))
    );
    openOptionsTab();

    // Would fall back to the default range if the local state kept the value it
    // captured on the first render, and the next edit would persist that over
    // the saved config.
    expect(rangeValue()).toBe('22');
  });

  it('re-seeds when the dashboard is swapped for another profile', () => {
    mocks.setDashboard(dashboardWith(radarConfig({ radarRange: 22 })));
    render(<RadarSettings />);
    openOptionsTab();
    expect(rangeValue()).toBe('22');

    act(() =>
      mocks.setDashboard(dashboardWith(radarConfig({ radarRange: 11 })))
    );

    expect(rangeValue()).toBe('11');
  });

  it('uses and persists defaults after switching to a profile without Radar', () => {
    const defaults = getWidgetDefaultConfig('radar');
    mocks.setDashboard(
      dashboardWith(
        radarConfig({ radarRange: 22, sideIndicatorColor: '#ff00ff' })
      )
    );
    render(<RadarSettings />);
    openOptionsTab();
    expect(rangeValue()).toBe('22');

    act(() =>
      mocks.setDashboard({ widgets: [] } as unknown as DashboardLayout)
    );
    expect(rangeValue()).toBe(String(defaults.radarRange));

    const changedRange = defaults.radarRange + 1;
    fireEvent.change(sliderFor('Radar Range'), {
      target: { value: String(changedRange) },
    });

    const savedRadar = mocks
      .getDashboard()
      ?.widgets.find((widget) => widget.id === 'radar');
    expect(savedRadar?.config).toMatchObject({
      radarRange: changedRange,
      sideIndicatorColor: defaults.sideIndicatorColor,
    });
  });

  it('falls back to the column defaults for a config the profile never had', () => {
    mocks.setDashboard({ widgets: [] } as unknown as DashboardLayout);
    render(<RadarSettings />);
    openOptionsTab();

    expect(screen.getByText('Radar Range')).toBeInTheDocument();
  });

  it('scales the range-dependent slider limit with the radar range', () => {
    mocks.setDashboard(
      dashboardWith(radarConfig({ radarRange: 30, showWhenNearby: true }))
    );
    render(<RadarSettings />);
    act(() => screen.getByRole('button', { name: 'Display' }).click());

    expect(sliderFor('Near Range').max).toBe('29.5');
  });

  it('shows the saved track map setting state', () => {
    mocks.setDashboard(dashboardWith(radarConfig({ showTrackMap: true })));
    render(<RadarSettings />);
    act(() => screen.getByRole('button', { name: 'Display' }).click());

    expect(screen.getByRole('switch', { name: 'Track map' })).toBeChecked();
    expect(screen.getByText('Border opacity')).toBeInTheDocument();
    expect(screen.getByText('Surface opacity')).toBeInTheDocument();
  });

  it('offers the player and custom opponent colours', () => {
    mocks.setDashboard(
      dashboardWith({ ...getWidgetDefaultConfig('radar') } as RadarConfig)
    );
    render(<RadarSettings />);
    act(() => screen.getByRole('button', { name: 'Display' }).click());

    const swatch = (label: string) => {
      const input = screen
        .getByText(label)
        .parentElement?.querySelector('input[type="color"]');
      if (!input) throw new Error(`no colour field for ${label}`);
      return (input as HTMLInputElement).value;
    };

    expect(swatch('Your car')).toBe('#2fd16a');
    expect(swatch('Opponents')).toBe('#cbd5e1');
  });

  it('reads the saved road colours and opacities', () => {
    mocks.setDashboard(
      dashboardWith(
        radarConfig({
          // The road controls only render while the map is the active view,
          // so the profile under test has it on.
          showTrackMap: true,
          mapBorderColor: '#111827',
          mapBorderOpacity: 80,
          mapFillColor: '#64748b',
          mapFillOpacity: 35,
        })
      )
    );
    render(<RadarSettings />);
    act(() => screen.getByRole('button', { name: 'Display' }).click());

    const swatch = (label: string) => {
      const input = screen
        .getByText(label)
        .parentElement?.querySelector('input[type="color"]');
      if (!input) throw new Error(`no colour field for ${label}`);
      return (input as HTMLInputElement).value;
    };

    expect(swatch('Road border')).toBe('#111827');
    expect(swatch('Road surface')).toBe('#64748b');
    expect(sliderFor('Border opacity').value).toBe('80');
    expect(sliderFor('Surface opacity').value).toBe('35');
  });

  it('keeps border and surface colours independent', () => {
    mocks.setDashboard(
      dashboardWith(
        radarConfig({
          showTrackMap: true,
          mapBorderColor: '#111827',
          mapFillColor: '#64748b',
        })
      )
    );
    render(<RadarSettings />);
    act(() => screen.getByRole('button', { name: 'Display' }).click());

    const colorInput = (label: string) =>
      screen
        .getByText(label)
        .parentElement?.querySelector(
          'input[type="color"]'
        ) as HTMLInputElement;
    const border = colorInput('Road border');
    const surface = colorInput('Road surface');
    fireEvent.change(border, { target: { value: '#f97316' } });

    expect(border.value).toBe('#f97316');
    expect(surface.value).toBe('#64748b');
  });
});
