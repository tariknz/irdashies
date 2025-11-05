import type { Meta, StoryObj } from '@storybook/react-vite';
import { Compound } from './Compound';

const meta: Meta<typeof Compound> = {
  component: Compound,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tireCompound: {
      control: { type: 'number' },
      description: 'compound from the compounds.json data',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the compound',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCompound: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
        <div key={0} className="flex items-center gap-4">
          <span className="text-white w-24">0:</span>
          <Compound tireCompound={0} size="sm" />
          <Compound tireCompound={0} size="md" />
          <Compound tireCompound={0} size="lg" />
        </div>
        <div key={1} className="flex items-center gap-4">
          <span className="text-white w-24">1:</span>
          <Compound tireCompound={1} size="sm" />
          <Compound tireCompound={1} size="md" />
          <Compound tireCompound={1} size="lg" />
        </div>
    </div>
  ),
};
