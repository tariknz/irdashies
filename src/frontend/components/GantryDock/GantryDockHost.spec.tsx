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

import {
  GantryDockHost,
  groupDockPanels,
  useGantryDock,
} from './GantryDockHost';

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

const withLapTimer: ResolvedDock = {
  arrangement: 'row',
  panels: [
    ...fuelAndMap.panels,
    {
      panel: { id: 'p3', type: 'laptimelog' },
      status: 'ready',
      widget: { id: 'laptimelog', enabled: false, layout },
    },
  ],
};

describe('GantryDockHost panel dividers', () => {
  it('puts a draggable divider between side-by-side panels', () => {
    render(<GantryDockHost dock={fuelAndMap} />);

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(
      screen.getByRole('separator', {
        name: 'Fuel Calculator and Track Map split',
      })
    ).toBeInTheDocument();
  });

  it('starts three panels at equal widths, with a divider between each', () => {
    render(<GantryDockHost dock={withLapTimer} />);

    const [first, second] = screen.getAllByRole('separator');
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(first).toHaveAccessibleName('Fuel Calculator and Track Map split');
    expect(first).toHaveAttribute('aria-valuenow', '33');
    expect(second).toHaveAccessibleName('Track Map and Lap Timer split');
    expect(second).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByTestId('widget-laptimelog')).toBeInTheDocument();
  });

  it('drops the divider next to a collapsed panel', () => {
    render(<GantryDockHost dock={fuelAndMap} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Track Map' }));

    expect(screen.queryAllByRole('separator')).toHaveLength(0);
    expect(
      screen.getByRole('region', { name: 'Track Map' })
    ).toBeInTheDocument();
  });

  it('remembers where a divider was moved to', () => {
    const { unmount } = render(<GantryDockHost dock={fuelAndMap} />);
    const divider = screen.getByRole('separator');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '54');

    unmount();
    render(<GantryDockHost dock={fuelAndMap} />);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '54'
    );
  });

  it('starts afresh when collapsing a panel changes what a divider separates', () => {
    render(<GantryDockHost dock={withLapTimer} />);
    const [first] = screen.getAllByRole('separator');
    for (let i = 0; i < 5; i++) fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(first).toHaveAttribute('aria-valuenow', '23');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Track Map' }));

    const [remaining] = screen.getAllByRole('separator');
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(remaining).toHaveAccessibleName(
      'Fuel Calculator and Lap Timer split'
    );
    expect(remaining).toHaveAttribute('aria-valuenow', '50');
  });

  it('has no dividers in tabs, which show one panel at a time', () => {
    render(<GantryDockHost dock={{ ...withLapTimer, arrangement: 'tabs' }} />);

    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });
});

describe('groupDockPanels', () => {
  const [fuel, map, laps] = withLapTimer.panels;
  const ids = (groups: ReturnType<typeof groupDockPanels>) =>
    groups.map((group) => group.map((resolved) => resolved.panel.id));

  it('gives each expanded panel its own group', () => {
    expect(ids(groupDockPanels([fuel, map, laps], new Set()))).toEqual([
      ['p1'],
      ['p2'],
      ['p3'],
    ]);
  });

  it('keeps a collapsed panel beside the expanded panel before it', () => {
    expect(ids(groupDockPanels([fuel, map, laps], new Set(['p2'])))).toEqual([
      ['p1', 'p2'],
      ['p3'],
    ]);
  });

  it('keeps a leading collapsed panel with the first expanded panel', () => {
    expect(ids(groupDockPanels([fuel, map, laps], new Set(['p1'])))).toEqual([
      ['p1', 'p2'],
      ['p3'],
    ]);
  });

  it('puts panels in one group when all are collapsed', () => {
    expect(ids(groupDockPanels([fuel, map], new Set(['p1', 'p2'])))).toEqual([
      ['p1', 'p2'],
    ]);
  });
});
