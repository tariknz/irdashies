import { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';
import { TelemetryDecorator, TelemetryDecoratorWithConfig } from '@irdashies/storybook';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'widgets/Input',
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Primary: Story = {
  render: () => (
    <>
      <div className="h-[140px] w-[420px]">
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

export const WithConfig: Story = {
  decorators: [TelemetryDecoratorWithConfig(
    undefined,
    {
      input: {
        trace: { enabled: false },
        tachometer: { enabled: false },
      },
    }),
  ],
  render: () => (
    <div className="h-[150px] w-full">
      <Input />
    </div>
  ),
  args: {},
};