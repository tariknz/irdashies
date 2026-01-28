import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputAbsIndicator } from './InputAbsIndicator';

const meta: Meta<typeof InputAbsIndicator> = {
  component: InputAbsIndicator,
  title: 'widgets/Input/components/InputAbsIndicator',
  decorators: [
    (Story) => (
      <div className="w-[100px] h-[100px] m-5 flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    absActive: {
      control: {
        type: 'boolean',
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof InputAbsIndicator>;

export const Primary: Story = {
  args: {
    absActive: false,
  },
};