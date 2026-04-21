import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeatherPrecipitation } from './WeatherPrecipitation';

const meta: Meta<typeof WeatherPrecipitation> = {
  title: 'Weather/WeatherPrecipitation',
  component: WeatherPrecipitation,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WeatherPrecipitation>;

export const NoPrecipitation: Story = {
  args: {
    precipitation: 0,
  },
};

export const LightRain: Story = {
  args: {
    precipitation: 0.15,
  },
};

export const HeavyRain: Story = {
  args: {
    precipitation: 0.85,
  },
};

export const Loading: Story = {
  args: {
    precipitation: undefined,
  },
};
