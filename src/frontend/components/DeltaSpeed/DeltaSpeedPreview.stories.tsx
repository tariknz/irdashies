import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TelemetryDecorator,
  ChannelSnapshotDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { DeltaSpeedPreview } from './DeltaSpeedPreview';

export default {
  title: 'widgets/DeltaSpeed/Settings preview',
  component: DeltaSpeedPreview,
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story) => (
      <div className="h-10 w-40">
        <Story />
      </div>
    ),
  ],
  args: getWidgetDefaultConfig('deltaspeed'),
} satisfies Meta<typeof DeltaSpeedPreview>;

export const Default: StoryObj<typeof DeltaSpeedPreview> = {};
