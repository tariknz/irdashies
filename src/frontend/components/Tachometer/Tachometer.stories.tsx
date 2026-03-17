import { Meta, StoryObj } from '@storybook/react-vite';
import { Tachometer } from './Tachometer';
import { TelemetryDecorator } from '@irdashies/storybook';

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
  title: 'widgets/Tachometer/components/Widget',
  decorators: [TelemetryDecorator()],
};
export default meta;

type Story = StoryObj<typeof Tachometer>;

export const Primary: Story = {
  render: () => (
    <div className="h-[100px] w-[420px]">
      <Tachometer />
    </div>
  ),
  args: {},
};
