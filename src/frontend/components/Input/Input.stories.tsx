import { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { TelemetryDecorator } from '@irdashies/storybook';

const meta: Meta<typeof Input> = {
  component: Input,
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  render: () => (
    <>
      <div className="h-[80px] w-[400px]">
        <Input />
      </div>
    </>
  ),
  args: {},
};

export const Bigger: Story = {
  render: () => (
    <div className="h-full w-full">
      <Input />
    </div>
  ),
  args: {},
};
