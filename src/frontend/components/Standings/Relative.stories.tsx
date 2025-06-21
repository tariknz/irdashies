import { Meta, StoryObj } from '@storybook/react-vite';
import { Relative } from './Relative';
import {
  TelemetryDecorator,
  DynamicTelemetrySelector,
} from '@irdashies/storybook';
import { useState } from 'react';

export default {
  component: Relative,
  parameters: {
    controls: {
      exclude: ['telemetryPath'],
    },
  },
} as Meta<typeof Relative>;

type Story = StoryObj<typeof Relative>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [
    (Story, context) => {
      const [selectedPath, setSelectedPath] = useState(
        '/test-data/1747384273173'
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

export const MultiClassPCCWithClio: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};

export const SupercarsRace: Story = {
  decorators: [TelemetryDecorator('/test-data/1732274253573')],
};

export const AdvancedMX5: Story = {
  decorators: [TelemetryDecorator('/test-data/1732260478001')],
};

export const GT3Practice: Story = {
  decorators: [TelemetryDecorator('/test-data/1732355190142')],
};

export const PCCPacing: Story = {
  decorators: [TelemetryDecorator('/test-data/1735296198162')],
};

export const MultiClass: Story = {
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};
