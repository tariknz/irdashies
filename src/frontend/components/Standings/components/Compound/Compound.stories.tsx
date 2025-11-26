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
    }
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCompound: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
        <div key={0} className="flex items-center gap-4">
          <span className="text-white w-24">Hard:</span>
          <Compound tireCompound={0} carIdx={0} mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]} />
          <Compound tireCompound={0} carIdx={0} mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]} />
          <Compound tireCompound={0} carIdx={0} mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]} />
        </div>
        <div key={1} className="flex items-center gap-4">
          <span className="text-white w-24">Medium:</span>
          <Compound tireCompound={1} carIdx={1} mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]} />
          <Compound tireCompound={1} carIdx={1} mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]} />
          <Compound tireCompound={1} carIdx={1} mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]} />
        </div>
        <div key={2} className="flex items-center gap-4">
          <span className="text-white w-24">Wet:</span>
          <Compound tireCompound={2} carIdx={2} mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]} />
          <Compound tireCompound={2} carIdx={2} mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]} />
          <Compound tireCompound={2} carIdx={2} mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]} />
        </div>
        <div key={3} className="flex items-center gap-4">
          <span className="text-white w-24">Soft:</span>
          <Compound tireCompound={3} carIdx={3} mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]} />
          <Compound tireCompound={3} carIdx={3} mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]} />
          <Compound tireCompound={3} carIdx={3} mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]} />
        </div>
        <div key={4} className="flex items-center gap-4">
          <span className="text-white w-24">Alternate:</span>
          <Compound tireCompound={4} carIdx={4} mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]} />
          <Compound tireCompound={4} carIdx={4} mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]} />
          <Compound tireCompound={4} carIdx={4} mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]} />
        </div>
        <div key={5} className="flex items-center gap-4">
          <span className="text-white w-24">Primary:</span>
          <Compound tireCompound={5} carIdx={5} mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]} />
          <Compound tireCompound={5} carIdx={5} mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]} />
          <Compound tireCompound={5} carIdx={5} mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]} />
        </div>
        <div key={6} className="flex items-center gap-4">
          <span className="text-white w-24">Dry:</span>
          <Compound tireCompound={6} carIdx={6} mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]} />
          <Compound tireCompound={6} carIdx={6} mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]} />
          <Compound tireCompound={6} carIdx={6} mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]} />
        </div>
    </div>
  ),
};