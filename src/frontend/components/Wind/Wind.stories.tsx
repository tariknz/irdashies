import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { Wind } from './Wind';

export default {
  component: Wind,
  title: 'widgets/Wind',
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof Wind>;

export const Primary: Story = {};
