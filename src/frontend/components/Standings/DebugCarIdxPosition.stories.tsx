import { Meta, StoryObj } from '@storybook/react';
import { DebugCarIdxPosition } from './DebugCarIdxPosition';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';
import { DynamicTelemetrySelector, TEST_DATA_DIRS } from './DynamicTelemetrySelector';
import { useState } from 'react';

export default {
  component: DebugCarIdxPosition,
  parameters: {
    controls: {
      exclude: ['telemetryPath'],
    },
  },
  loaders: [
    async () => {
      return { testDataDirs: TEST_DATA_DIRS };
    },
  ],
} as Meta<typeof DebugCarIdxPosition>;

type Story = StoryObj<typeof DebugCarIdxPosition>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [(Story, context) => {
    const [selectedPath, setSelectedPath] = useState('/test-data/1746952742703');
    
    return (
      <>
        <DynamicTelemetrySelector
          onPathChange={setSelectedPath}
          initialPath={selectedPath}
        />
        {TelemetryDecorator(selectedPath)(Story, context)}
      </>
    );
  }],
};

export const MultiClassPCCWithClio: Story = {
  decorators: [TelemetryDecorator('/test-data/1746952742230')],
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