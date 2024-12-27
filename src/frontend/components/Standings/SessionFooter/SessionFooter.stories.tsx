import { Meta, StoryObj } from '@storybook/react';
import { SessionFooter } from './SessionFooter';
import { TelemetryDecorator } from '../../../../../.storybook/telemetryDecorator';

export default {
  component: SessionFooter,
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionFooter>;

export const Primary: Story = {};
