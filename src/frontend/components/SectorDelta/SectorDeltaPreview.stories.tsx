import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TelemetryDecorator,
  ChannelSnapshotDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SectorDeltaPreview } from './SectorDeltaPreview';

export default {
  title: 'widgets/SectorDelta/Settings preview',
  component: SectorDeltaPreview,
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'track-state.snapshot': trackStateStorySnapshot,
    }),
    (Story) => (
      <div className="h-15 w-75">
        <Story />
      </div>
    ),
  ],
  args: getWidgetDefaultConfig('sectordelta'),
} satisfies Meta<typeof SectorDeltaPreview>;

export const Default: StoryObj<typeof SectorDeltaPreview> = {};
