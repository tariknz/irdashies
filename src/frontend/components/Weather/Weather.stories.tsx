import type { Meta, StoryObj } from '@storybook/react';
import { Weather } from './Weather';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';

export default {
  component: Weather,
} as Meta;

type Story = StoryObj<typeof Weather>;

export const Primary: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};
