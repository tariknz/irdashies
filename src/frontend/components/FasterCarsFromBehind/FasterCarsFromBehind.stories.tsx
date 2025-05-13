import { Meta, StoryObj } from '@storybook/react';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';

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