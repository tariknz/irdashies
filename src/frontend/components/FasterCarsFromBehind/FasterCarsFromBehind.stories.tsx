import { Meta, StoryObj } from '@storybook/react';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';

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
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};
