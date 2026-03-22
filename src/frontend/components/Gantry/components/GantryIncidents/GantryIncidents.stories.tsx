import type { Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator, RaceControlDecorator } from '@irdashies/storybook';
import { GantryIncidents } from './GantryIncidents';

const meta: Meta<typeof GantryIncidents> = {
  component: GantryIncidents,
  decorators: [TelemetryDecorator(), RaceControlDecorator()],
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof GantryIncidents>;

export const Default: Story = {};
