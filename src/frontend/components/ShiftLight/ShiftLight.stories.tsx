import { Meta, StoryObj } from '@storybook/react-vite';
import { ShiftLight } from './ShiftLight';
import { TelemetryDecorator } from '@irdashies/storybook';

const meta: Meta<typeof ShiftLight> = {
  component: ShiftLight,
  title: 'widgets/ShiftLight/components',
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof ShiftLight>;
