import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeatherTemp } from './WeatherTemp';

export default {
  component: WeatherTemp,
} as Meta;

type Story = StoryObj<typeof WeatherTemp>;

export const Primary: Story = {
  args: {
    title: 'Air Temp',
    value: '19°C',
  },
};
