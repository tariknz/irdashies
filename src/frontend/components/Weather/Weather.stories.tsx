import type { Meta, StoryObj } from '@storybook/react-vite';
import { Weather } from './Weather';
import {
  TelemetryDecorator,
  ChannelSnapshotDecorator,
  sessionBarStorySnapshot,
  trackStateStorySnapshot,
} from '@irdashies/storybook';

export default {
  component: Weather,
  title: 'widgets/Weather',
} as Meta;

type Story = StoryObj<typeof Weather>;

export const Primary: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': sessionBarStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story, context) => (
      <div style={{ width: '380px' }}>
        {TelemetryDecorator('/test-data/1731637331038')(Story, context)}
      </div>
    ),
  ],
};
