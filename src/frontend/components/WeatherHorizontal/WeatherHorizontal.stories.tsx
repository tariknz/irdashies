import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { WeatherHorizontal } from './WeatherHorizontal';

export default {
  component: WeatherHorizontal,
  title: 'widgets/WeatherHorizontal',
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof WeatherHorizontal>;

export const Primary: Story = {};
