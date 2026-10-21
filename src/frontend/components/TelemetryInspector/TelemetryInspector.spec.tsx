import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TelemetryInspector } from './TelemetryInspector';

const stores = vi.hoisted(() => ({
  telemetry: {} as Record<string, unknown>,
  session: {} as Record<string, unknown>,
}));

vi.mock('@irdashies/context', () => ({
  useTelemetryStore: (selector: (s: unknown) => unknown) =>
    selector({ telemetry: stores.telemetry }),
  useSessionStore: (selector: (s: unknown) => unknown) =>
    selector({ session: stores.session }),
  useDashboard: () => ({ currentDashboard: undefined }),
}));

/** DashboardView renders this as `<WidgetComponent {...widget.config} />`. */
const mount = (
  properties: {
    source: 'telemetry' | 'session';
    path: string;
    label?: string;
  }[]
) => render(<TelemetryInspector properties={properties} />);

describe('TelemetryInspector', () => {
  it('shows a speed channel in the unit it actually carries', () => {
    // 60 kph is 16.6667 m/s. The number is not wrong -- Speed is metres per
    // second in LMU and iRacing alike -- so the unit is printed rather than
    // the value converted, because the point of this widget is to show what
    // the app received.
    stores.telemetry = { Speed: { value: [16.666666] } };
    mount([{ source: 'telemetry', path: 'Speed', label: 'Speed' }]);

    expect(screen.getByText('16.6667')).toBeInTheDocument();
    expect(screen.getByText('m/s')).toBeInTheDocument();
  });

  it('leaves a channel with no known unit bare', () => {
    stores.telemetry = { Gear: { value: [4] } };
    mount([{ source: 'telemetry', path: 'Gear', label: 'Gear' }]);

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('m/s')).not.toBeInTheDocument();
  });

  it('resolves a nested session path, such as the fuel capacity', () => {
    stores.session = { DriverInfo: { DriverCarFuelMaxLtr: 100 } };
    mount([
      {
        source: 'session',
        path: 'DriverInfo.DriverCarFuelMaxLtr',
        label: 'Tank',
      },
    ]);

    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('does not unit-label a session path that shares a telemetry name', () => {
    // The table is for telemetry channels; a session field called Speed is a
    // different thing and must not inherit m/s.
    stores.session = { Speed: 42 };
    mount([{ source: 'session', path: 'Speed', label: 'Speed' }]);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByText('m/s')).not.toBeInTheDocument();
  });

  it('reports a missing path rather than rendering nothing', () => {
    stores.telemetry = {};
    mount([{ source: 'telemetry', path: 'Nope', label: 'Nope' }]);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
