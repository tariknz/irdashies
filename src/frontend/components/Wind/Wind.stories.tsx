import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChannelSnapshotDecorator,
  sessionBarStorySnapshot,
  TelemetryDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { Wind } from './Wind';

export default {
  component: Wind,
  title: 'widgets/Wind',
} as Meta;

type Story = StoryObj<typeof Wind>;

export const Primary: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': sessionBarStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story, context) => (
      <div style={{ width: '150px', height: '180px' }}>
        {TelemetryDecorator('/test-data/1731637331038')(Story, context)}
      </div>
    ),
  ],
};
