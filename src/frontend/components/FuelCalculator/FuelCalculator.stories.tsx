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
  title: 'FRONTEND/components/FuelCalculator',
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

export const WithoutFuelSave: Story = {
  decorators: [TelemetryDecorator()],
  args: {
    showFuelSave: false,
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
    showFuelSave: true,
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
    showFuelSave: true,
    showFuelRequired: true,
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};

export const HorizontalLayout: Story = {
  decorators: [TelemetryDecorator('/test-data/mock-fuel/normal')],
  args: {
    layout: 'horizontal',
    showConsumption: true,
    showFuelRequired: true,
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

    // Add mock lap history (laps 1-10)
    const mockLaps: FuelLapData[] = [
      { lapNumber: 1, fuelUsed: 1.8, lapTime: 85, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 900000 },
      { lapNumber: 2, fuelUsed: 2.1, lapTime: 92, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 800000 },
      { lapNumber: 3, fuelUsed: 2.15, lapTime: 91, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 700000 },
      { lapNumber: 4, fuelUsed: 2.08, lapTime: 90, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 600000 },
      { lapNumber: 5, fuelUsed: 2.12, lapTime: 91, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 500000 },
      { lapNumber: 6, fuelUsed: 2.05, lapTime: 89, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 400000 },
      { lapNumber: 7, fuelUsed: 2.18, lapTime: 92, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 300000 },
      { lapNumber: 8, fuelUsed: 2.1, lapTime: 90, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 200000 },
      { lapNumber: 9, fuelUsed: 2.14, lapTime: 91, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() - 100000 },
      { lapNumber: 10, fuelUsed: 2.11, lapTime: 90, isGreenFlag: true, isValidForCalc: true, isOutLap: false, timestamp: Date.now() },
    ];

    mockLaps.forEach(lap => addLapData(lap));

    // Set current lap crossing state
    updateLapCrossing(0.1, 35.5, 900, 11, false);
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
    showFuelSave: true,
    showFuelRequired: true,
    safetyMargin: 0.05,
    background: { opacity: 85 },
  },
};
