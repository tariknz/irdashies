import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';

let dashboard: DashboardLayout;

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({ currentDashboard: dashboard }),
  SessionProvider: () => <div data-testid="session-provider" />,
  TelemetryProvider: () => <div data-testid="telemetry-provider" />,
  PitLaneProvider: () => <div data-testid="pitlane-provider" />,
  ReferenceStoreProvider: () => <div data-testid="reference-provider" />,
}));

import { RendererDataProviders } from './RendererDataProviders';

const layout = { x: 0, y: 0, width: 100, height: 100 };

describe('RendererDataProviders', () => {
  beforeEach(() => {
    dashboard = { widgets: [] };
  });

  it('does not mount legacy providers for a Fuel-only renderer', () => {
    dashboard.widgets = [{ id: 'fuel', enabled: true, layout }];

    const { container } = render(<RendererDataProviders />);

    expect(container).toBeEmptyDOMElement();
  });

  it('preserves legacy providers when any unmigrated widget is enabled', () => {
    dashboard.widgets = [
      { id: 'fuel', enabled: true, layout },
      { id: 'lap-time-log', enabled: true, layout },
    ];

    render(<RendererDataProviders />);

    expect(screen.getByTestId('telemetry-provider')).toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });

  it('mounts session and pit-lane providers without legacy telemetry', () => {
    Object.defineProperty(window, 'pitLaneBridge', {
      configurable: true,
      value: {},
    });
    dashboard.widgets = [{ id: 'pitlanehelper', enabled: true, layout }];

    render(<RendererDataProviders />);

    expect(screen.queryByTestId('telemetry-provider')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
    expect(screen.getByTestId('pitlane-provider')).toBeInTheDocument();
  });
});
