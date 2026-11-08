import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TelemetryDecorator,
  ChannelSnapshotDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { FuelPreview } from './FuelPreview';

export default {
  title: 'widgets/FuelCalculator/Settings preview',
  component: FuelPreview,
  args: { showOnlyWhenOnTrack: false },
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story) => (
      <div className="h-[520px] w-[300px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FuelPreview>;

export const Default: StoryObj<typeof FuelPreview> = {};
