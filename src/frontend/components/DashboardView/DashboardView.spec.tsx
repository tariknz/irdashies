import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIM_WIDGET_SUPPORT } from '@irdashies/types';
import type { DashboardLayout } from '@irdashies/types';
import { DashboardView } from './DashboardView';

const dashboard = {
  widgets: [
    { id: 'carsystems', enabled: true, config: { fontSize: 14 } },
    { id: 'standings', enabled: true, config: {} },
    // Disabled for the desktop overlays, but still addressable by URL.
    { id: 'weather', enabled: false, config: {} },
    // A second instance: its own id, with the component named by `type`.
    { id: 'standings-2', type: 'standings', enabled: false, config: {} },
  ],
} as unknown as DashboardLayout;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentDashboard: dashboard,
    currentProfile: { id: 'default' },
    bridge: { saveDashboard: vi.fn() },
  }),
  SessionTimingUpdater: () => null,
  useHiddenWidgetIds: () => new Set<string>(),
  // No simulator detected, so no widget is dropped as unsupported.
  useActiveSimulator: () => null,
  useSimWidgetSupport: () => DEFAULT_SIM_WIDGET_SUPPORT,
  isGantryOnly: (widget: { placement?: string }) =>
    widget.placement === 'gantry',
}));

vi.mock('../../WidgetIndex', () => ({
  getWidget: (id: string) =>
    ({
      carsystems: () => <div>car systems widget</div>,
      standings: () => <div>standings widget</div>,
      weather: () => <div>weather widget</div>,
    })[id],
}));

vi.mock('../../widgetRuntime', () => ({
  WidgetRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe('DashboardView solo widget mode', () => {
  it('draws every enabled widget when no widget is named', () => {
    render(<DashboardView />);

    expect(screen.getByText('car systems widget')).toBeInTheDocument();
    expect(screen.getByText('standings widget')).toBeInTheDocument();
  });

  it('draws only the named widget', () => {
    render(<DashboardView soloWidgetId="carsystems" />);

    expect(screen.getByText('car systems widget')).toBeInTheDocument();
    expect(screen.queryByText('standings widget')).not.toBeInTheDocument();
  });

  it('draws a widget that is disabled for the desktop overlays', () => {
    render(<DashboardView soloWidgetId="weather" />);

    expect(screen.getByText('weather widget')).toBeInTheDocument();
  });

  it('drops the drag and resize chrome so the host window is the frame', () => {
    const { container } = render(<DashboardView soloWidgetId="carsystems" />);

    expect(container.querySelector('[data-resize-handle]')).toBeNull();
    expect(container.querySelector('.absolute')).toBeNull();
  });

  it('draws a second instance of a widget by its type', () => {
    render(<DashboardView soloWidgetId="standings-2" />);

    expect(screen.getByText('standings widget')).toBeInTheDocument();
  });

  it('says so when the profile has no such widget', () => {
    render(<DashboardView soloWidgetId="nosuchwidget" />);

    expect(screen.getByText('Unknown widget')).toBeInTheDocument();
  });
});
