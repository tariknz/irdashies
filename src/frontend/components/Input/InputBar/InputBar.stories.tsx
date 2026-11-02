import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputBar } from './InputBar';

const meta: Meta<typeof InputBar> = {
  component: InputBar,
  title: 'widgets/Input/components/InputBar',
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

export const Zero: Story = {
  ...Primary,
  args: {
    ...Primary.args,
    brake: 0,
    throttle: 0,
    clutch: 0,
  },
};

export const Full: Story = {
  ...Primary,
  args: {
    ...Primary.args,
    brake: 1,
    throttle: 1,
    clutch: 1,
  },
};

export const AbsActive: Story = {
  ...Primary,
  args: {
    ...Primary.args,
    brake: 0.75,
    throttle: 0.1234567,
    clutch: 0,
    brakeAbsActive: true,
  },
};

export const OutsideRange: Story = {
  ...Primary,
  args: {
    ...Primary.args,
    brake: 2,
    throttle: -1,
    clutch: 0.5,
  },
};
