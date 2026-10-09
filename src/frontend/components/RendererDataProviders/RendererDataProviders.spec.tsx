import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';

let dashboard: DashboardLayout;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: dashboard }),
  // No display bounds in these tests, so the real hook would return every
  // enabled widget; the mock stands in for exactly that.
  useWidgetsForThisDisplay: () =>
    dashboard.widgets.filter((widget) => widget.enabled),
  SessionProvider: () => <div data-testid="session-provider" />,
  TelemetryInspectorProvider: () => (
    <div data-testid="telemetry-inspector-provider" />
  ),
  PitLaneProvider: () => <div data-testid="pitlane-provider" />,
  ReferenceStoreProvider: () => <div data-testid="reference-provider" />,
}));

import { RendererDataProviders } from './RendererDataProviders';

const layout = { x: 0, y: 0, width: 100, height: 100 };

describe('RendererDataProviders', () => {
  beforeEach(() => {
    dashboard = { widgets: [] };
  });

  it('does not mount diagnostic providers for a Fuel-only renderer', () => {
    dashboard.widgets = [{ id: 'fuel', enabled: true, layout }];

    const { container } = render(<RendererDataProviders />);

    expect(container).toBeEmptyDOMElement();
  });

  it('mounts raw data only for the explicit Telemetry Inspector', () => {
    dashboard.widgets = [
      { id: 'fuel', enabled: true, layout },
      { id: 'telemetryinspector', enabled: true, layout },
    ];

    render(<RendererDataProviders />);

    expect(
      screen.getByTestId('telemetry-inspector-provider')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('session-provider')).not.toBeInTheDocument();
  });

  it('mounts session and pit-lane providers without diagnostic telemetry', () => {
    Object.defineProperty(window, 'pitLaneBridge', {
      configurable: true,
      value: {},
    });
    dashboard.widgets = [{ id: 'pitlanehelper', enabled: true, layout }];

    render(<RendererDataProviders />);

    expect(
      screen.queryByTestId('telemetry-inspector-provider')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('pitlane-provider')).toBeInTheDocument();
  });

  it('keeps session data for Input and Tachometer without raw telemetry', () => {
    dashboard.widgets = [
      { id: 'input', enabled: true, layout },
      { id: 'tachometer', enabled: true, layout },
    ];

    render(<RendererDataProviders />);

    expect(
      screen.queryByTestId('telemetry-inspector-provider')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });

  // Car Systems reads only its own snapshot channel, so nothing about its data
  // needs suggests session data. Its session-visibility settings need it all
  // the same, and a window holding just this widget is the normal standalone
  // overlay case where no other widget can mount the provider for it.
  it('keeps session data for a Car Systems only renderer', () => {
    dashboard.widgets = [{ id: 'carsystems', enabled: true, layout }];

    render(<RendererDataProviders />);

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });
});

describe('RendererDataProviders scoped to one browser-source widget', () => {
  beforeEach(() => {
    dashboard = { widgets: [] };
  });

  it('mounts what the named widget needs when nothing is enabled', () => {
    // The natural VR setup: every desktop overlay switched off, each widget
    // placed as its own browser source.
    dashboard.widgets = [{ id: 'map', enabled: false, layout }];

    render(<RendererDataProviders browser widgetId="map" />);

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });

  it('mounts what it needs even when the profile has no such widget', () => {
    render(<RendererDataProviders browser widgetId="map" />);

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });

  // A second instance of a widget has its own id and names what it is in
  // `type`. The registry only knows the type.
  it('resolves a second instance of a widget by its type', () => {
    dashboard.widgets = [{ id: 'map-2', type: 'map', enabled: false, layout }];

    render(<RendererDataProviders browser widgetId="map-2" />);

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });

  it('ignores what the other enabled widgets need', () => {
    dashboard.widgets = [
      { id: 'telemetryinspector', enabled: true, layout },
      { id: 'fuel', enabled: true, layout },
    ];

    render(<RendererDataProviders browser widgetId="fuel" />);

    expect(
      screen.queryByTestId('telemetry-inspector-provider')
    ).not.toBeInTheDocument();
  });

  it('still derives needs from the dashboard when no widget is named', () => {
    dashboard.widgets = [{ id: 'map', enabled: false, layout }];

    const { container } = render(<RendererDataProviders browser />);

    expect(container).toBeEmptyDOMElement();
  });
});
