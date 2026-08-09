import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';

let dashboard: DashboardLayout;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: dashboard }),
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
});
