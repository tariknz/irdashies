import { Meta, StoryObj } from '@storybook/react-vite';
import { FuelCalculator } from './FuelCalculator';
import {
  TelemetryDecorator,
  DynamicTelemetrySelector,
} from '@irdashies/storybook';
import { useState } from 'react';

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
    showConsumption: {},
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
    show10LapAvg: {},
  },
};
