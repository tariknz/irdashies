import { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';
import {
  TelemetryDecorator,
  TelemetryDecoratorWithConfig,
  ChannelSnapshotDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';

const driverControls = ChannelSnapshotDecorator({
  'track-state.snapshot': trackStateStorySnapshot,
  'driver-controls.snapshot': {
    brake: 0.35,
    throttle: 0.72,
    clutch: 0.9,
    gear: 4,
    speed: 48,
    displayUnits: 1,
    steeringWheelAngle: 0.15,
    brakeAbsActive: false,
    version: 1,
  },
});

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'widgets/Input',
  decorators: [TelemetryDecorator(), driverControls],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  render: () => (
    <>
      <div className="h-23 w-105">
        <Input />
      </div>
    </>
  ),
  args: {},
};

export const Bigger: Story = {
  render: () => (
    <div className="h-full w-full">
      <Input />
    </div>
  ),
  args: {},
};

export const WithConfig: Story = {
  decorators: [
    driverControls,
    TelemetryDecoratorWithConfig(undefined, {
      input: {
        trace: { enabled: false },
        tachometer: { enabled: false },
      },
    }),
  ],
  render: () => (
    <div className="h-[150px] w-full">
      <Input />
    </div>
  ),
  args: {},
};
