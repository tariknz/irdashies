import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputBar } from './InputBar';

const meta: Meta<typeof InputBar> = {
  component: InputBar,
  decorators: [
    (Story) => (
      <div className="w-[100px] m-5 h-[120px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    brake: {
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    throttle: {
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    clutch: {
      control: {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof InputBar>;

export const Primary: Story = {
  render: (args) => <InputBar {...args} />,
  args: {
    brake: 0.5,
    throttle: 0.5,
    clutch: 0.5,
    brakeAbsActive: false,
    settings: {
      includeBrake: true,
      includeThrottle: true,
      includeClutch: true,
      includeAbs: true,
    },
  },
};
