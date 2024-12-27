import { Meta, StoryObj } from '@storybook/react';
import { SessionBar } from './SessionBar';
import { TelemetryDecorator } from '../../../../../.storybook/telemetryDecorator';

export default {
  component: SessionBar,
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

export const Primary: Story = {};
