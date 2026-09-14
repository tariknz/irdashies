import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CameraGroup,
  DashboardLayout,
  LapGraphConfig,
} from '@irdashies/types';
import { deepMergeConfig, getWidgetDefaultConfig } from '@irdashies/types';
import { GantrySettings } from './GantrySettings';

/** Camera groups as the session publishes them; Cameras is unused by these tests. */
const cameraGroup = (GroupNum: number, GroupName: string): CameraGroup => ({
  GroupNum,
  GroupName,
  Cameras: [],
});

// GantrySettings is memo()'d and takes no props, so a plain rerender() would be
// skipped. Back the mocked context with a real external store instead, which is
// how the dashboard actually reaches the component.
const mocks = vi.hoisted(() => {
  let dashboard: DashboardLayout | undefined;
  const listeners = new Set<() => void>();
  return {
    listeners,
    // The shared type, so a change to the session contract fails here at
    // compile time rather than drifting silently.
    cameraGroups: undefined as CameraGroup[] | undefined,
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
    useSessionCameraGroups: () => mocks.cameraGroups,
  };
});

const gantryConfig = (overrides: Record<string, unknown> = {}) => ({
  slowSpeedThreshold: 21,
  slowDurationSeconds: 10,
  impactDecelKmhPerSec: 150,
  impactMinSpeed: 20,
  offTrackDurationSeconds: 3,
  pitEntryDurationSeconds: 3,
  cooldownSeconds: 5,
  sessionRetention: 'all',
  speedUnit: 'km/h',
  ...overrides,
});

const dashboardFor = (config: Record<string, unknown>) =>
  ({
    widgets: [
      {
        id: 'gantry',
        enabled: true,
        layout: { x: 0, y: 0, width: 1920, height: 1080 },
        config,
      },
    ],
  }) as unknown as DashboardLayout;

const dashboardWith = (sessionRetention: 'all' | 5 | 10 | 20) =>
  dashboardFor(gantryConfig({ sessionRetention }));

// The header carries the widget enable switch; the auto-pin toggle is the only
// other switch on the Options tab.
const autoPinSwitch = () => screen.getAllByRole('switch').at(-1) as HTMLElement;

const lapWindowInput = () =>
  screen.getByRole('spinbutton', { name: '' }) as HTMLInputElement;

const savedLapGraph = (): LapGraphConfig => {
  const dashboard = mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as
    DashboardLayout | undefined;
  const config = dashboard?.widgets.find((w) => w.id === 'gantry')?.config;
  return (config as { lapGraph: LapGraphConfig }).lapGraph;
};

const selectValue = (name: string) =>
  (screen.getByRole('combobox', { name }) as HTMLSelectElement).value;

const retentionValue = () => selectValue('Keep Sessions');

const cameraSelect = () =>
  screen.getByRole('combobox', {
    name: 'Incident Camera',
  }) as HTMLSelectElement;

const savedGantryConfig = () => {
  const dashboard = mocks.onDashboardUpdated.mock.calls.at(-1)?.[0] as
    DashboardLayout | undefined;
  return dashboard?.widgets.find((w) => w.id === 'gantry')?.config as Record<
    string,
    unknown
  >;
};

describe('GantrySettings incident camera', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
    mocks.cameraGroups = undefined;
  });

  it('falls back to Far Chase before a session has loaded', () => {
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    expect(cameraSelect().value).toBe('Far Chase');
  });

  it("offers the session's own camera groups once they arrive", () => {
    mocks.cameraGroups = [
      cameraGroup(12, 'Chase'),
      cameraGroup(13, 'Far Chase'),
      cameraGroup(18, 'TV1'),
    ];
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    const labels = [...cameraSelect().options].map((o) => o.value);
    expect(labels).toEqual(['Chase', 'Far Chase', 'TV1']);
  });

  it('keeps a saved group that this track does not offer', () => {
    mocks.cameraGroups = [cameraGroup(12, 'Chase')];
    mocks.setDashboard(
      dashboardFor(gantryConfig({ incidentCameraGroup: 'Blimp' }))
    );
    render(<GantrySettings />);

    // Dropping it would silently rewrite the user's choice on one track.
    expect([...cameraSelect().options].map((o) => o.value)).toContain('Blimp');
    expect(cameraSelect().value).toBe('Blimp');
  });

  it('writes the chosen group', () => {
    mocks.cameraGroups = [cameraGroup(13, 'Far Chase'), cameraGroup(18, 'TV1')];
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    fireEvent.change(cameraSelect(), { target: { value: 'TV1' } });

    expect(savedGantryConfig().incidentCameraGroup).toBe('TV1');
  });
});

describe('GantrySettings', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
  });

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

describe('GantrySettings lap graph', () => {
  beforeEach(() => {
    mocks.onDashboardUpdated.mockClear();
  });

  it('explains what every y axis option shows', () => {
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    for (const label of ['Race Trace', 'Position', 'Gap to Leader']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    expect(screen.getByText(/median lap/)).toBeInTheDocument();
    expect(screen.getByText(/a place gained/)).toBeInTheDocument();
    expect(screen.getByText(/leader sits on zero/)).toBeInTheDocument();
  });

  it('falls back to the defaults when the saved config has no lap graph block', () => {
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    expect(lapWindowInput().value).toBe('75');
    expect(autoPinSwitch()).toHaveAttribute('aria-checked', 'true');
  });

  it('writes the y axis mode without dropping the other lap graph values', () => {
    mocks.setDashboard(
      dashboardFor(
        gantryConfig({
          lapGraph: { yAxisMode: 'trace', lapWindow: 40, autoPin: false },
        })
      )
    );
    render(<GantrySettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Gap to Leader' }));

    expect(savedLapGraph()).toEqual({
      yAxisMode: 'gap',
      lapWindow: 40,
      autoPin: false,
    });
  });

  it('writes the lap window and the auto-pin toggle', () => {
    mocks.setDashboard(
      dashboardFor(
        gantryConfig({
          lapGraph: { yAxisMode: 'position', lapWindow: 75, autoPin: true },
        })
      )
    );
    render(<GantrySettings />);

    fireEvent.change(lapWindowInput(), { target: { value: '120' } });
    expect(savedLapGraph()).toEqual({
      yAxisMode: 'position',
      lapWindow: 120,
      autoPin: true,
    });

    fireEvent.click(autoPinSwitch());
    expect(savedLapGraph().autoPin).toBe(false);
  });

  it('keeps the lap window inside the supported range', () => {
    mocks.setDashboard(dashboardWith('all'));
    render(<GantrySettings />);

    expect(lapWindowInput().min).toBe('5');
    expect(lapWindowInput().max).toBe('300');
  });
});

// The settings pane reads whatever storage hands it. The Gantry has no config
// migrator, so deepMergeConfig is what fills in a block a saved config predates.
describe('Gantry config defaults', () => {
  const defaults = getWidgetDefaultConfig('gantry') as unknown as Record<
    string,
    unknown
  >;

  const load = (saved: Record<string, unknown>) =>
    deepMergeConfig(defaults, saved) as Record<string, unknown>;

  it('gives a saved config with no lap graph block the defaults', () => {
    const merged = load(gantryConfig({ sessionRetention: 10 }));

    expect(merged.lapGraph).toEqual({
      yAxisMode: 'trace',
      lapWindow: 75,
      autoPin: true,
    });
    expect(merged.sessionRetention).toBe(10);
    expect(merged.slowSpeedThreshold).toBe(21);
    expect(merged.speedUnit).toBe('km/h');
  });

  it('renders that config', () => {
    mocks.setDashboard(dashboardFor(load(gantryConfig())));
    render(<GantrySettings />);

    expect(lapWindowInput().value).toBe('75');
  });
});
