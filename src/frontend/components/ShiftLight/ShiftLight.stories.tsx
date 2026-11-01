import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShiftLight } from './ShiftLight';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';

const meta: Meta<typeof ShiftLight> = {
  component: ShiftLight,
  title: 'widgets/Shift Light/Widget',
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'track-state.snapshot': { ...trackStateStorySnapshot, isOnTrack: true },
      'driver-controls.snapshot': { gear: 4, rpm: 6200, version: 1 },
    }),
  ],
};
export default meta;
type Story = StoryObj<typeof ShiftLight>;

export const Primary: Story = {
  render: () => (
    <div className="h-[100px] w-[300px]">
      <ShiftLight />
    </div>
  ),
};

export const ShiftNow: Story = {
  ...Primary,
  decorators: [
    ChannelSnapshotDecorator({
      'track-state.snapshot': { ...trackStateStorySnapshot, isOnTrack: true },
      'driver-controls.snapshot': {
        gear: 4,
        rpm: 7100,
        shiftRpm: 6900,
        // The cue waits for the driver to be accelerating.
        throttleRaw: 1,
        version: 1,
      },
    }),
  ],
};
