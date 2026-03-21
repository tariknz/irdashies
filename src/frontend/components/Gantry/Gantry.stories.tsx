import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator, RaceControlDecorator } from '@irdashies/storybook';
import { Gantry } from './Gantry';

const meta: Meta<typeof Gantry> = {
  component: Gantry,
  decorators: [TelemetryDecorator(), RaceControlDecorator()],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Gantry>;

export const Default: Story = {};
