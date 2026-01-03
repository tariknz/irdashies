import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeatherTrackWetness } from './WeatherTrackWetness';

export default {
  component: WeatherTrackWetness,
  title: 'widgets/Weather/components/WeatherTrackWetness',
  argTypes: {
    trackMoisture: {
      control: {
        type: 'range',
        min: 1,
        max: 7,
        step: 1,
      },
    },
  },
} as Meta;

type Story = StoryObj<typeof WeatherTrackWetness>;

export const Primary: Story = {
  args: {
    trackMoisture: 5,
  },
};
