import type { Meta, StoryObj } from '@storybook/react-vite';
import { WindDirection } from './WindDirection';

export default {
  component: WindDirection,
  title: 'widgets/Weather/components/WindDirection',
  argTypes: {
    direction: {
      control: {
        type: 'range',
        min: 0,
        max: 3.14 * 2,
        step: 0.1,
      },
    },
    speedMs: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
        step: 0.1,
      },
    },
  },
} as Meta;

type Story = StoryObj<typeof WindDirection>;

export const Primary: Story = {
  args: {
    direction: 0,
    speedMs: 0,
  },
};
