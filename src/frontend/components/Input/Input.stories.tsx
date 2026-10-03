import { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';
import {
  TelemetryDecorator,
  TelemetryDecoratorWithConfig,
  ChannelSnapshotDecorator,
  trackStateStorySnapshot,
} from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';

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

const defaultConfig = getWidgetDefaultConfig('input');

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

export const CustomLayout: Story = {
  render: () => (
    <div className="h-40 w-105">
      <Input
        {...defaultConfig}
        showOnlyWhenOnTrack={false}
        layoutTree={{
          id: 'root',
          type: 'split',
          direction: 'row',
          children: [
            {
              id: 'left',
              type: 'box',
              direction: 'col',
              widgets: ['trace', 'bar'],
              weight: 3,
            },
            {
              id: 'right',
              type: 'box',
              direction: 'col',
              widgets: ['gear', 'steer'],
              weight: 1,
            },
          ],
        }}
      />
    </div>
  ),
  args: {},
};

export const GearOnly: Story = {
  render: () => (
    <div className="h-23 w-23">
      <Input
        {...defaultConfig}
        showOnlyWhenOnTrack={false}
        layoutTree={{
          id: 'root',
          type: 'box',
          direction: 'col',
          widgets: ['gear'],
        }}
      />
    </div>
  ),
  args: {},
};

export const ShiftFlash: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'track-state.snapshot': trackStateStorySnapshot,
      'driver-controls.snapshot': {
        brake: 0,
        throttle: 1,
        clutch: 1,
        gear: 3,
        speed: 40,
        rpm: 7200,
        blinkRpm: 6800,
        displayUnits: 1,
        steeringWheelAngle: 0,
        brakeAbsActive: false,
        version: 1,
      },
    }),
  ],
  render: () => (
    <div className="h-23 w-105">
      <Input
        {...defaultConfig}
        showOnlyWhenOnTrack={false}
        shiftFlash={{ enabled: true, source: 'redline', color: '#9333ea' }}
      />
    </div>
  ),
  args: {},
};
