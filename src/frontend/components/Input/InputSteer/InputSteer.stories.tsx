import { Meta, StoryObj } from '@storybook/react-vite';
import { InputSteer } from './InputSteer';

export default {
  component: InputSteer,
} as Meta;

type Story = StoryObj<typeof InputSteer>;

export const Primary: Story = {
  args: {},
};
