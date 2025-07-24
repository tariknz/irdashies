import { Meta, StoryObj } from '@storybook/react-vite';
import { InputSteer } from './InputSteer';

export default {
  component: InputSteer,
  argTypes: {
    angleRad: {
      control: {
        type: 'range',
        min: -3.14,
        max: 3.14,
        step: 0.01,
      },
    },
  },
} as Meta;

type Story = StoryObj<typeof InputSteer>;

export const Primary: Story = {
  args: {
    angleRad: 0,
  },
};
