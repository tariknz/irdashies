import { Meta, StoryObj } from '@storybook/react-vite';
import { InputTrace } from './InputTrace';
import { TelemetryDecorator } from '@irdashies/storybook';

const meta: Meta<typeof InputTrace> = {
  component: InputTrace,
  title: 'widgets/InputTrace',
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof InputTrace>;

export const Primary: Story = {
  render: () => (
    <div className="h-[70px] w-[396px]">
      <InputTrace />
    </div>
  ),
};

export const Tall: Story = {
  render: () => (
    <div className="h-[120px] w-[600px]">
      <InputTrace />
    </div>
  ),
};
