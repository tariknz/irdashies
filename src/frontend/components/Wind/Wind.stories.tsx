import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { Wind } from './Wind';

export default {
  component: Wind,
  title: 'widgets/Wind',
} as Meta;

type Story = StoryObj<typeof Wind>;

export const Primary: Story = {
  decorators: [
    (Story, context) => (
      <div style={{ width: '150px', height: '180px' }}>
        {TelemetryDecorator('/test-data/1731637331038')(Story, context)}
      </div>
    ),
  ],
};
