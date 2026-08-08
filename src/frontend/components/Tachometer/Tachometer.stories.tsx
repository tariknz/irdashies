import { Meta, StoryObj } from '@storybook/react-vite';
import { Tachometer } from './Tachometer';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
  title: 'widgets/Tachometer/components/Widget',
  decorators: [
    TelemetryDecorator(),
    ChannelSnapshotDecorator({
      'track-state.snapshot': trackStateStorySnapshot,
      'driver-controls.snapshot': {
        gear: 4,
        rpm: 6200,
        shiftGrindRpm: 7600,
        shiftRpm: 6900,
        blinkRpm: 7400,
        oilTemp: 105,
        waterTemp: 92,
        engineWarnings: 0,
        version: 1,
      },
    }),
  ],
};
export default meta;

type Story = StoryObj<typeof Tachometer>;

export const Primary: Story = {
  render: () => (
    <div className="h-[100px] w-full">
      <Tachometer />
    </div>
  ),
  args: {},
};
