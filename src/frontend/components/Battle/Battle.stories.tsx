import { Meta, StoryObj } from '@storybook/react-vite';
import { Battle } from './Battle';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
  trackStateStorySnapshot,
  standingsStorySnapshot,
} from '@irdashies/storybook';
import type { RelativeGapsSnapshot } from '@irdashies/types';

const relativeGapsStorySnapshot = {
  focusCarIdx: 30,
  relativePcts: Array.from({ length: 64 }, (_, carIdx) =>
    Math.max(-0.49, Math.min(0.49, (carIdx - 30) * 0.012))
  ),
  deltas: Array.from({ length: 64 }, (_, carIdx) => (carIdx - 30) * 1.2),
  sessionNum: 0,
  version: 1,
} satisfies RelativeGapsSnapshot;

export default {
  component: Battle,
  title: 'widgets/Battle',
} as Meta<typeof Battle>;

type Story = StoryObj<typeof Battle>;

export const Primary: Story = {
  render: () => <Battle />,
  decorators: [
    TelemetryDecorator('/test-data/1747384033336'),
    ChannelSnapshotDecorator({
      'car-speeds.snapshot': {
        carSpeeds: [],
        sessionNum: 0,
        version: 1,
      },
      'relative-gaps.snapshot': relativeGapsStorySnapshot,
      'standings.snapshot': standingsStorySnapshot,
      'track-state.snapshot': trackStateStorySnapshot,
    }),
  ],
};
