import type { Meta, StoryObj } from '@storybook/react-vite';
import { Weather } from './Weather';
import {
  TelemetryDecorator,
  TelemetryDecoratorWithConfig,
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
      <div style={{ width: '150px' }}>
        {TelemetryDecorator('/test-data/1731637331038')(Story, context)}
      </div>
    ),
  ],
};

export const Horizontal: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': sessionBarStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story, context) => (
      <div style={{ width: '640px' }}>
        {TelemetryDecoratorWithConfig('/test-data/1731637331038', {
          weather: {
            layout: 'horizontal',
          },
        })(Story, context)}
      </div>
    ),
  ],
};

export const HorizontalFull: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': sessionBarStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story, context) => (
      <div style={{ width: '900px' }}>
        {TelemetryDecoratorWithConfig('/test-data/1731637331038', {
          weather: {
            layout: 'horizontal',
            horizontalMode: 'full',
          },
        })(Story, context)}
      </div>
    ),
  ],
};
