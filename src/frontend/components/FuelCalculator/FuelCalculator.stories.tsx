import { Meta, StoryObj } from '@storybook/react-vite';
import { FuelCalculator } from './FuelCalculator';
import {
  TelemetryDecorator,
  DynamicTelemetrySelector,
} from '@irdashies/storybook';
import { useState, useEffect } from 'react';
import { useFuelStore } from './FuelStore';
import type { FuelLapData } from './types';

export default {
  component: FuelCalculator,
  title: 'widgets/FuelCalculator',
} as Meta;

type Story = StoryObj<typeof FuelCalculator>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

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

export const GT3Race: Story = {
  decorators: [TelemetryDecorator('/test-data/1732359661942')],
};

export const MultiClassPCC: Story = {
  decorators: [TelemetryDecorator('/test-data/1731391056221')],
};

export const SupercarsRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const WithGallons: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    fuelUnits: 'gal',
    showConsumption: true,
  },
};

export const LowOpacity: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    background: { opacity: 25 },
  },
};

export const HighOpacity: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    background: { opacity: 95 },
  },
};

export const WithoutConsumption: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    showConsumption: false,
  },
};

export const WithoutPitWindow: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    showPitWindow: false,
  },
};

export const WithoutFuelScenarios: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    showFuelScenarios: false,
  },
};

export const HighSafetyMargin: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    safetyMargin: 0.15, // 15% safety margin instead of default 5%
  },
};

export const MinimalView: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    showConsumption: true,
    showPitWindow: true,
    showFuelScenarios: true,
    show10LapAvg: true,
  },
};

export const NormalRaceSimulation: Story = {
  decorators: [TelemetryDecorator('/test-data/mock-fuel/normal')],
  args: {
    fuelUnits: 'L',
    layout: 'vertical',
    showConsumption: true,
    showMin: true,
    showLastLap: true,
    show3LapAvg: true,
    show10LapAvg: true,
    showMax: true,
    showPitWindow: true,
    showFuelScenarios: true,
    showFuelRequired: true,
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const HorizontalLayout: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator('/test-data/mock-fuel/normal'),
  ],
  args: {
    fuelUnits: 'L',
    layout: 'horizontal',
    showConsumption: true,
    showMin: true,
    showLastLap: true,
    show3LapAvg: true,
    show10LapAvg: true,
    showMax: true,
    showPitWindow: true,
    showEnduranceStrategy: true,
    showFuelRequired: true,
    showConsumptionGraph: true,
    consumptionGraphType: 'histogram',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

// Helper component to populate fuel store with mock lap data
const MockFuelDataProvider = ({ children }: { children: React.ReactNode }) => {
  const addLapData = useFuelStore((state) => state.addLapData);
  const updateLapCrossing = useFuelStore((state) => state.updateLapCrossing);
  const clearAllData = useFuelStore((state) => state.clearAllData);

  useEffect(() => {
    // Clear existing data
    clearAllData();

    // Add mock lap history (laps 1-30 for histogram)
    const mockLaps: FuelLapData[] = Array.from({ length: 30 }, (_, i) => {
      // Create varied fuel usage with some above and below average (avg ~2.1)
      const baseUsage = 2.1;
      const variation = [
        -0.3, 0, 0.05, -0.02, 0.02, -0.05, 0.08, 0, 0.01, -0.06,
        0.15, -0.1, 0.03, -0.02, 0.05, -0.08, 0.1, -0.03, 0.02, -0.05,
        0.12, -0.07, 0.04, -0.01, 0.06, -0.04, 0.09, -0.02, 0.03, -0.06
      ][i];
      return {
        lapNumber: i + 1,
        fuelUsed: baseUsage + variation,
        lapTime: 90 + Math.floor(Math.random() * 3),
        isGreenFlag: true,
        isValidForCalc: true,
        isOutLap: false,
        timestamp: Date.now() - (30 - i) * 100000,
      };
    });

    mockLaps.forEach(lap => addLapData(lap));

    // Set current lap crossing state
    updateLapCrossing(0.1, 35.5, 2700, 31, false);
  }, [addLapData, updateLapCrossing, clearAllData]);

  return <>{children}</>;
};

export const WithMockLapData: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    fuelUnits: 'L',
    layout: 'vertical',
    showConsumption: true,
    showMin: true,
    showLastLap: true,
    show3LapAvg: true,
    show10LapAvg: true,
    showMax: true,
    showPitWindow: true,
    showFuelRequired: true,
    showConsumptionGraph: true,
    consumptionGraphType: 'histogram',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const WithHistogram: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    fuelUnits: 'L',
    layout: 'vertical',
    showConsumption: true,
    showPitWindow: true,
    showConsumptionGraph: true,
    consumptionGraphType: 'histogram',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const WithLineChart: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    fuelUnits: 'L',
    layout: 'vertical',
    showConsumption: true,
    showPitWindow: true,
    showConsumptionGraph: true,
    consumptionGraphType: 'line',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const WithoutConsumptionGraph: Story = {
  decorators: [
    (Story) => (
      <MockFuelDataProvider>
        <Story />
      </MockFuelDataProvider>
    ),
    TelemetryDecorator(),
  ],
  args: {
    showConsumptionGraph: false,
  },
};

export const FuelScenariosShowcase: Story = {
  decorators: [TelemetryDecorator('/test-data/mock-fuel/normal')],
  args: {
    fuelUnits: 'L',
    layout: 'vertical',
    showConsumption: true,
    showMin: true,
    showLastLap: true,
    show3LapAvg: true,
    show10LapAvg: true,
    showMax: true,
    showPitWindow: true,
    showFuelScenarios: true,
    showFuelRequired: false,
    showConsumptionGraph: true,
    consumptionGraphType: 'histogram',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const FuelScenariosHorizontal: Story = {
  decorators: [TelemetryDecorator('/test-data/mock-fuel/normal')],
  args: {
    fuelUnits: 'L',
    layout: 'horizontal',
    showConsumption: true,
    showMin: true,
    showLastLap: true,
    show3LapAvg: true,
    show10LapAvg: true,
    showMax: true,
    showPitWindow: true,
    showEnduranceStrategy: true,
    showFuelScenarios: true,
    showFuelRequired: false,
    showConsumptionGraph: true,
    consumptionGraphType: 'histogram',
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};
