import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
  mockDashboardBridge,
  standingsStorySnapshot,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { DashboardProvider } from '@irdashies/context';
import {
  defaultDashboard,
  type DashboardWidget,
  type FuelProjectionSnapshot,
  type ResolvedDock,
} from '@irdashies/types';
import { GantryDockHost } from './GantryDockHost';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';

const widget = (id: string) =>
  defaultDashboard.widgets.find((w) => w.id === id) as DashboardWidget;

const fuelProjection: FuelProjectionSnapshot = {
  isReplay: false,
  fuelLevel: 33.9,
  fuelLevelPct: 0.56,
  currentLap: 3,
  lapDistPct: 0.55,
  currentLapUsage: 1.2,
  projectedLapUsage: 2.3,
  lastLapUsage: 2.34,
  sessionLapsRemain: 20,
  sessionTimeRemain: 2700,
  sessionTimeTotal: 3600,
  sessionFlags: 0,
  sessionState: 4,
  sessionNum: 0,
  sessionLaps: 23,
  calculatedTotalRaceLaps: 23,
  estimatedLapsRemaining: 0,
  hasValidRaceEstimate: false,
  isFixedLapRace: true,
  sessionType: 'Race',
  isOnTrack: true,
  fuelTankCapacity: 60,
  completedLaps: [],
  engine: {
    accumulatedRefuel: 0,
    isLapDistPctReset: false,
    lapCrossingTime: 180,
    lapStartFuel: 35.1,
    lastLap: 3,
    lastLapDistPct: 0.55,
    lastSessionFlags: 0,
    wasOnPitRoad: false,
  },
};

const fuelAndMap: ResolvedDock = {
  arrangement: 'row',
  panels: [
    {
      panel: { id: 'p1', type: 'fuel', widgetId: 'fuel' },
      status: 'ready',
      widget: widget('fuel'),
    },
    {
      panel: { id: 'p2', type: 'map' },
      status: 'ready',
      widget: widget('map'),
    },
  ],
};

const meta: Meta<typeof GantryDockHost> = {
  component: GantryDockHost,
  title: 'widgets/Gantry/GantryDockHost',
  parameters: { layout: 'fullscreen' },
  argTypes: { dock: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-[900px] h-[360px] flex flex-col bg-slate-900 text-white">
        <Story />
      </div>
    ),
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'fuel.projection': fuelProjection,
      'standings.snapshot': standingsStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
  ],
};
export default meta;
type Story = StoryObj<typeof GantryDockHost>;

/** Fuel calculator and track map side by side. */
export const FuelAndMap: Story = {
  args: { dock: fuelAndMap },
};

/** A 200% host must not multiply the panels' independent scales. */
export const ScaledPanels: Story = {
  args: {
    dock: {
      ...fuelAndMap,
      panels: fuelAndMap.panels.map((panel, index) =>
        panel.status === 'ready'
          ? {
              ...panel,
              widget: { ...panel.widget, scale: index === 0 ? 75 : 150 },
            }
          : panel
      ),
    },
  },
  render: (args) => (
    <WidgetScale scale={200}>
      <div className="flex h-full flex-col">
        <GantryDockHost {...args} />
      </div>
    </WidgetScale>
  ),
};

const demoBridge = {
  ...mockDashboardBridge,
  onDemoModeChanged: (callback: (demoMode: boolean) => void) => {
    callback(true);
    return () => undefined;
  },
};

/** Three panels with adjustable dividers, the Lap Timer scrolling 20 laps. */
export const WithLapTimer: Story = {
  args: {
    dock: {
      ...fuelAndMap,
      panels: [
        ...fuelAndMap.panels,
        {
          panel: { id: 'p3', type: 'laptimelog' },
          status: 'ready',
          widget: widget('laptimelog'),
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <DashboardProvider bridge={demoBridge}>
        <Story />
      </DashboardProvider>
    ),
  ],
};

/** A single panel fills the whole width. */
export const LapTimerOnly: Story = {
  args: {
    dock: {
      arrangement: 'row',
      panels: [
        {
          panel: { id: 'p3', type: 'laptimelog' },
          status: 'ready',
          widget: widget('laptimelog'),
        },
      ],
    },
  },
  decorators: WithLapTimer.decorators,
};

/** One panel at a time, for a narrow Gantry window. */
export const Tabs: Story = {
  args: { dock: { ...fuelAndMap, arrangement: 'tabs' } },
};

/** A panel whose fuel layout was deleted, and one with no layout chosen. */
export const MissingSource: Story = {
  args: {
    dock: {
      arrangement: 'row',
      panels: [
        {
          panel: { id: 'p1', type: 'fuel', widgetId: 'fuel-deleted' },
          status: 'removed',
        },
        { panel: { id: 'p2', type: 'fuel' }, status: 'unlinked' },
      ],
    },
  },
};
