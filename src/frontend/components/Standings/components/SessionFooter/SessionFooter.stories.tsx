import { Meta, StoryObj } from '@storybook/react-vite';
import { SessionFooter } from './SessionFooter';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: SessionFooter,
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof SessionFooter>;

export const Primary: Story = {};
