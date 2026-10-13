import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveSimulator,
  DashboardLayout,
  ResolvedDock,
} from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  openWidgetSettings: vi.fn(),
  running: true,
  widgetProps: [] as Record<string, unknown>[],
  sectorTimingMounted: vi.fn(),
  providerProps: vi.fn(),
  dashboard: undefined as DashboardLayout | undefined,
  simulator: null as ActiveSimulator | null,
}));

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    bridge: { openWidgetSettings: mocks.openWidgetSettings },
    currentDashboard: mocks.dashboard,
  }),
  useActiveSimulator: () => mocks.simulator,
  useSimWidgetSupport: () => ({
    message: 'nope',
    disabledWidgets: { iracing: [], lmu: ['map'] },
  }),
  useRunningState: () => ({ running: mocks.running }),
  SectorTimingUpdater: () => {
    mocks.sectorTimingMounted();
    return null;
  },
}));

vi.mock('../RendererDataProviders/RendererDataProviders', () => ({
  RendererDataProviders: (props: Record<string, unknown>) => {
    mocks.providerProps(props);
    return null;
  },
}));

vi.mock('../../WidgetIndex', () => ({
  getWidget: (type: string) => {
    if (type === 'broken') {
      return () => {
        throw new Error('boom');
      };
    }
    return (props: Record<string, unknown>) => {
      mocks.widgetProps.push(props);
      return <div data-testid={`widget-${type}`} />;
    };
  },
}));

vi.mock('@irdashies/utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GantryDockHost, useGantryDock } from './GantryDockHost';

const layout = { x: 0, y: 0, width: 100, height: 100 };

const fuelAndMap: ResolvedDock = {
  arrangement: 'row',
  panels: [
    {
      panel: { id: 'p1', type: 'fuel', widgetId: 'fuel-2' },
      status: 'ready',
      widget: {
        id: 'fuel-2',
        type: 'fuel',
        enabled: true,
        layout,
        config: { safetyMargin: 1 },
      },
    },
    {
      panel: { id: 'p2', type: 'map' },
      status: 'ready',
      widget: { id: 'map', enabled: false, layout },
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  mocks.running = true;
  mocks.widgetProps.length = 0;
  mocks.dashboard = undefined;
  mocks.simulator = null;
  vi.clearAllMocks();
});

describe('useGantryDock', () => {
  it('leaves out panels the running sim cannot support', () => {
    mocks.dashboard = {
      widgets: [
        {
          id: 'gantry',
          enabled: true,
          layout,
          config: {
            dock: {
              enabled: true,
              panels: [
                { id: 'p1', type: 'map' },
                { id: 'p2', type: 'flatmap' },
              ],
            },
          },
        },
        { id: 'map', enabled: true, layout },
        { id: 'flatmap', enabled: true, layout },
      ],
    };
    const panelIds = () =>
      renderHook(() => useGantryDock()).result.current.panels.map(
        (resolved) => resolved.panel.id
      );

    expect(panelIds()).toEqual(['p1', 'p2']);
    mocks.simulator = 'lmu';
    expect(panelIds()).toEqual(['p2']);
  });
});

describe('GantryDockHost', () => {
  it('renders each widget with its config and never lets it persist', () => {
    render(<GantryDockHost dock={fuelAndMap} />);

    expect(screen.getByTestId('widget-fuel')).toBeInTheDocument();
    expect(screen.getByTestId('widget-map')).toBeInTheDocument();
    expect(mocks.widgetProps[0]).toEqual({ safetyMargin: 1, embedded: true });
    expect(mocks.widgetProps[1]).toEqual({ embedded: true });
  });

  it('mounts data providers for the docked widgets only', () => {
    render(<GantryDockHost dock={fuelAndMap} />);

    expect(mocks.providerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionAlreadyMounted: true,
        widgets: [
          fuelAndMap.panels[0].status === 'ready' &&
            fuelAndMap.panels[0].widget,
          fuelAndMap.panels[1].status === 'ready' &&
            fuelAndMap.panels[1].widget,
        ],
      })
    );
    expect(mocks.sectorTimingMounted).toHaveBeenCalled();
  });

  it('does not run sector timing without a map', () => {
    render(
      <GantryDockHost
        dock={{ arrangement: 'row', panels: [fuelAndMap.panels[0]] }}
      />
    );
    expect(mocks.sectorTimingMounted).not.toHaveBeenCalled();
  });

  it('opens the settings for the exact widget instance', () => {
    render(<GantryDockHost dock={fuelAndMap} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Fuel Calculator settings' })
    );
    expect(mocks.openWidgetSettings).toHaveBeenCalledWith('fuel-2');
  });

  it('collapses a panel and remembers it', () => {
    const { unmount } = render(<GantryDockHost dock={fuelAndMap} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Track Map' }));
    expect(screen.queryByTestId('widget-map')).not.toBeInTheDocument();

    unmount();
    render(<GantryDockHost dock={fuelAndMap} />);
    expect(screen.queryByTestId('widget-map')).not.toBeInTheDocument();
    expect(screen.getByTestId('widget-fuel')).toBeInTheDocument();
  });

  it('shows one panel at a time in tabs', () => {
    render(<GantryDockHost dock={{ ...fuelAndMap, arrangement: 'tabs' }} />);

    expect(screen.getByTestId('widget-fuel')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Track Map' }));
    expect(screen.getByTestId('widget-map')).toBeInTheDocument();
    expect(screen.queryByTestId('widget-fuel')).not.toBeInTheDocument();
  });

  it('explains a removed fuel layout and links to settings', () => {
    render(
      <GantryDockHost
        dock={{
          arrangement: 'row',
          panels: [
            {
              panel: { id: 'p1', type: 'fuel', widgetId: 'gone' },
              status: 'removed',
            },
          ],
        }}
      />
    );

    expect(
      screen.getByText('The fuel layout this panel used was removed.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose another' }));
    expect(mocks.openWidgetSettings).toHaveBeenCalledWith('gantry');
  });

  it('waits for iRacing before rendering widgets', () => {
    mocks.running = false;
    render(<GantryDockHost dock={fuelAndMap} />);

    expect(screen.queryByTestId('widget-fuel')).not.toBeInTheDocument();
    expect(screen.getAllByText('Waiting for iRacing.')).toHaveLength(2);
  });

  it('keeps the other panels working when one throws', () => {
    render(
      <GantryDockHost
        dock={{
          arrangement: 'row',
          panels: [
            {
              panel: { id: 'p1', type: 'map' },
              status: 'ready',
              widget: { id: 'map', type: 'broken', enabled: true, layout },
            },
            fuelAndMap.panels[0],
          ],
        }}
      />
    );

    expect(screen.getByText(/This panel hit a problem/)).toBeInTheDocument();
    expect(screen.getByTestId('widget-fuel')).toBeInTheDocument();
  });
});
