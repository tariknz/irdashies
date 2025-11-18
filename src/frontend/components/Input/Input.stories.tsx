import { StoryObj } from '@storybook/react-vite';
import { Input } from './Input';
import { TelemetryDecorator } from '@irdashies/storybook';
import type { InputWidgetSettings } from '../Settings/types';

const defaultConfig: InputWidgetSettings['config'] = {
  trace: {
    enabled: true,
    includeThrottle: true,
    includeBrake: true,
    includeAbs: true,
    includeSteer: true,
  },
  bar: {
    enabled: true,
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
    includeAbs: true,
  },
  gear: {
    enabled: true,
    unit: 'auto',
  },
  steer: {
    enabled: true,
    config: {
      style: 'default',
      color: 'dark',
    },
  },
};

const meta = {
  component: Input,
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  render: () => (
    <>
      <div className="h-[80px] w-[400px]">
        <Input {...defaultConfig} />
      </div>
    </>
  ),
};

export const Bigger: Story = {
  render: () => (
    <div className="h-full w-full">
      <Input {...defaultConfig} />
    </div>
  ),
};
