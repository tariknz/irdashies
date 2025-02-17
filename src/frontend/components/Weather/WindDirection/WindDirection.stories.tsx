import type { Meta, StoryObj } from '@storybook/react';

import { TelemetryDecorator } from '../../../../../.storybook/telemetryDecorator';
import { WindDirection } from './WindDirection';

export default {
  component: WindDirection,
} as Meta;

type Story = StoryObj<typeof WindDirection>;

export const Primary: Story = {
  decorators: [TelemetryDecorator('/test-data/1731637331038')],
};
