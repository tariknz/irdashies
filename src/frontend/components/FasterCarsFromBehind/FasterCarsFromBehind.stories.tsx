import { Meta, StoryObj } from '@storybook/react-vite';
import { FasterCarsFromBehind } from './FasterCarsFromBehind';
import { TelemetryDecorator } from '@irdashies/storybook';

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
