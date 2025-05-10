import { Meta, StoryObj } from '@storybook/react';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';
//import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';
//import { DynamicTelemetrySelector, TEST_DATA_DIRS } from './DynamicTelemetrySelector';
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
  //decorators: [TelemetryDecorator()],
};