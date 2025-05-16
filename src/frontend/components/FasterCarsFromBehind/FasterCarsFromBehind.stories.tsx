import { Meta, StoryObj } from '@storybook/react';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';
import { DynamicTelemetrySelector, TEST_DATA_DIRS } from '../Standings/DynamicTelemetrySelector';
import { useState } from 'react';

export default {
  component: FasterCarsFromBehind,
  parameters: {
    controls: {
      exclude: ['telemetryPath'],
    }
  }
} as Meta<typeof FasterCarsFromBehind>;

type Story = StoryObj<typeof FasterCarsFromBehind>;

export const Primary: Story = {
  decorators: [TelemetryDecorator()],
};

export const DynamicTelemetry: Story = {
  decorators: [(Story, context) => {
    const [selectedPath, setSelectedPath] = useState('/test-data/1745291694179');
    
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