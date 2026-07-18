import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, type ReactNode, useState } from 'react';
import { FuelCalculator } from './FuelCalculator';
import {
  DynamicTelemetrySelector,
  TelemetryDecorator,
} from '@irdashies/storybook';
import { useFuelStore } from './FuelStore';
import type { FuelCalculation, FuelLapData } from './types';
import type { LayoutNode } from '@irdashies/types';

const OverlayFrame = ({
  children,
  height,
}: {
  children: ReactNode;
  height: 260 | 520;
}) => (
  <div className="w-[300px] [&>div]:h-full" style={{ height }}>
    {children}
  </div>
);

const strategyLayout: LayoutNode = {
  id: 'fuel-strategy',
  type: 'box',
  direction: 'col',
  widgets: ['fuelHeader', 'fuelGauge', 'fuelGrid'],
};

const strategyWithHistoryLayout: LayoutNode = {
  id: 'fuel-strategy-history',
  type: 'box',
  direction: 'col',
  widgets: ['fuelHeader', 'fuelGauge', 'fuelGrid', 'fuelGraph'],
};

const strategyWithPlanningLayout: LayoutNode = {
  id: 'fuel-strategy-planning',
  type: 'box',
  direction: 'col',
  widgets: [
    'fuelHeader',
    'fuelGauge',
    'fuelGrid',
    'fuelTargetMessage',
    'fuelScenarios',
  ],
};

const targetPitMessageLayout: LayoutNode = {
  id: 'fuel-target-pit-message',
  type: 'box',
  direction: 'col',
  widgets: ['fuelHeader', 'fuelGauge', 'fuelTargetMessage'],
};

const fuelSaveTargetsLayout: LayoutNode = {
  id: 'fuel-save-targets',
  type: 'box',
  direction: 'col',
  widgets: ['fuelHeader', 'fuelGauge', 'fuelEconomyPredict'],
};

const baselineArgs = {
  showOnlyWhenOnTrack: false,
  layoutTree: strategyLayout,
  showFuelStatusBorder: false,
  showMin: false,
  showQualifyConsumption: false,
  consumptionGridOrder: ['avg', 'last', 'max'],
};

const previewFuelData: FuelCalculation = {
  fuelLevel: 32.6,
  lastLapUsage: 2.4,
  currentLapUsage: 1.3,
  projectedLapUsage: 2.35,
  avgLaps: 2.34,
  avg10Laps: 2.36,
  avgAllGreenLaps: 2.34,
  minLapUsage: 2.28,
  maxLapUsage: 2.48,
  lapsWithFuel: 13.9,
  lapsRemaining: 32,
  totalLaps: 35,
  currentLap: 3,
  fuelToFinish: 74.9,
  fuelToAdd: 42.3,
  pitWindowOpen: 15,
  pitWindowClose: 16.9,
  canFinish: false,
  targetConsumption: 1.02,
  confidence: 'high',
  fuelAtFinish: -42.3,
  avgLapTime: 90,
  stopsRemaining: 1,
  lapsPerStint: 25.6,
  targetScenarios: [
    { laps: 11, fuelPerLap: 2.34, isCurrentTarget: false },
    { laps: 12, fuelPerLap: 2.34, isCurrentTarget: true },
    { laps: 13, fuelPerLap: 2.34, isCurrentTarget: false },
  ],
  earliestPitLap: 15,
  fuelTankCapacity: 60,
  lastFinishedLap: 2,
  fuelStatus: 'safe',
  lapsRange: [31, 34],
  maxQualify: null,
};

export default {
  component: FuelCalculator,
  title: 'widgets/FuelCalculator',
  args: baselineArgs,
  decorators: [
    (Story, context) => (
      <OverlayFrame
        height={
          context.id.includes('strategy-with-history') ||
          context.id.includes('strategy-with-pit-planning')
            ? 520
            : 260
        }
      >
        <Story />
      </OverlayFrame>
    ),
  ],
} satisfies Meta<typeof FuelCalculator>;

type Story = StoryObj<typeof FuelCalculator>;

/** The default overlay: one strategy hierarchy, aligned with Standings/Relative. */
export const Primary: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: { ...baselineArgs, previewData: previewFuelData },
};

/** Verifies that the layout tree, grid order, and visibility settings are applied. */
export const StrategyWithHistory: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    layoutTree: strategyWithHistoryLayout,
    fuelHistoryType: 'histogram',
    previewData: previewFuelData,
  },
};

/** Planning tools deliberately sit below the core strategy, rather than competing with it. */
export const StrategyWithPitPlanning: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    layoutTree: strategyWithPlanningLayout,
    enableTargetPitLap: true,
    targetPitLap: 15,
    showFuelScenarios: true,
    previewData: previewFuelData,
  },
};

/** Isolates the target pit instruction so its copy and spacing can be reviewed. */
export const TargetPitMessage: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    layoutTree: targetPitMessageLayout,
    enableTargetPitLap: true,
    targetPitLap: 15,
    previewData: previewFuelData,
  },
};

/** Isolates the three fuel-save targets, including the selected recommendation. */
export const FuelSaveTargets: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    layoutTree: fuelSaveTargetsLayout,
    previewData: previewFuelData,
  },
};

/** Confirms unit formatting without changing the strategy layout. */
export const Gallons: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    fuelUnits: 'gal',
    previewData: previewFuelData,
  },
};

/** An amber shell makes the approaching pit decision visible without relying on the table. */
export const Caution: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    showFuelStatusBorder: true,
    previewData: { ...previewFuelData, fuelStatus: 'caution' },
  },
};

/** A new session communicates uncertainty explicitly while calculations establish a trend. */
export const LowConfidence: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider lapCount={1}>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    ...baselineArgs,
    previewData: {
      ...previewFuelData,
      confidence: 'low',
      lapsRange: [28, 36],
    },
  },
};

/** A live-data picker for checking the baseline against recorded sessions. */
export const DynamicTelemetry: Story = {
  decorators: [
    (Story, context) => {
      const [selectedPath, setSelectedPath] = useState(
        '/test-data/1745291694179'
      );

      return (
        <>
          <DynamicTelemetrySelector
            onPathChange={setSelectedPath}
            initialPath={selectedPath}
          />
          {TelemetryDecorator(selectedPath)(Story, context)}
        </>
      );
    },
  ],
};

const MockFuelDataProvider = ({
  children,
  lapCount = 30,
}: {
  children: ReactNode;
  lapCount?: number;
}) => {
  const addLapData = useFuelStore((state) => state.addLapData);
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const clearAllData = useFuelStore((state) => state.clearAllData);

  useEffect(() => {
    clearAllData();

    const variations = [
      -0.3, 0, 0.05, -0.02, 0.02, -0.05, 0.08, 0, 0.01, -0.06, 0.15, -0.1, 0.03,
      -0.02, 0.05,
    ];
    const mockLaps: FuelLapData[] = Array.from(
      { length: lapCount },
      (_, index) => ({
        lapNumber: index + 1,
        fuelUsed: 2.1 + variations[index % variations.length],
        lapTime: 90 + (index % 3),
        isGreenFlag: true,
        isValidForCalc: true,
        isOutLap: false,
        timestamp: Date.UTC(2025, 0, 1) + index * 100000,
      })
    );

    mockLaps.forEach((lap) => addLapData(lap));
    updateLapCrossing(0.1, 35.5, 2700, 31, false);
  }, [addLapData, clearAllData, lapCount, updateLapCrossing]);

  return <>{children}</>;
};
