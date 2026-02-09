import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeatherHumidity } from './WeatherHumidity';

export default {
  component: WeatherHumidity,
  title: 'widgets/Weather/components/WeatherHumidity',
} as Meta;

type Story = StoryObj<typeof WeatherHumidity>;

export const Primary: Story = {
  args: {
    humidity: 0.65,
  },
};
