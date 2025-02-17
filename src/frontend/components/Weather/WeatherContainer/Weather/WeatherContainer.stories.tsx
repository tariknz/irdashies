import type { Meta, StoryObj } from '@storybook/react';
import { WeatherContainer } from './WeatherContainer';
import { TelemetryDecorator } from '../../../../../../.storybook/telemetryDecorator';

export default {
  component: WeatherContainer,
} as Meta;

type Story = StoryObj<typeof WeatherContainer>;

export const Primary: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};
