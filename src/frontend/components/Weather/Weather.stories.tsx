import type { Meta, StoryObj } from '@storybook/react-vite';
import { Weather } from './Weather';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: Weather,
  decorators: [(Story) => (
    <div style={{ width: '150px' }}>
      <Story />
    </div>
  )],
} as Meta;

type Story = StoryObj<typeof Weather>;

export const Primary: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};
