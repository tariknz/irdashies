import type { Meta, StoryObj } from '@storybook/react-vite';
import { Compound } from './Compound';

const meta: Meta<typeof Compound> = {
  component: Compound,
  title: 'shared/Compound',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    tireCompound: {
      control: { type: 'number' },
      description: 'compound from the compounds.json data',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllCompound: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
      <div key={0} className="flex items-center gap-4">
        <span className="text-white w-24">Hard:</span>
        <Compound
          tireCompound={0}
          mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]}
        />
        <Compound
          tireCompound={0}
          mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]}
        />
        <Compound
          tireCompound={0}
          mockTires={[{ TireIndex: 0, TireCompoundType: 'Hard' }]}
        />
      </div>
      <div key={1} className="flex items-center gap-4">
        <span className="text-white w-24">Medium:</span>
        <Compound
          tireCompound={1}
          mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]}
        />
        <Compound
          tireCompound={1}
          mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]}
        />
        <Compound
          tireCompound={1}
          mockTires={[{ TireIndex: 1, TireCompoundType: 'Medium' }]}
        />
      </div>
      <div key={2} className="flex items-center gap-4">
        <span className="text-white w-24">Wet:</span>
        <Compound
          tireCompound={2}
          mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]}
        />
        <Compound
          tireCompound={2}
          mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]}
        />
        <Compound
          tireCompound={2}
          mockTires={[{ TireIndex: 2, TireCompoundType: 'Wet' }]}
        />
      </div>
      <div key={3} className="flex items-center gap-4">
        <span className="text-white w-24">Soft:</span>
        <Compound
          tireCompound={3}
          mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]}
        />
        <Compound
          tireCompound={3}
          mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]}
        />
        <Compound
          tireCompound={3}
          mockTires={[{ TireIndex: 3, TireCompoundType: 'Soft' }]}
        />
      </div>
      <div key={4} className="flex items-center gap-4">
        <span className="text-white w-24">Alternate:</span>
        <Compound
          tireCompound={4}
          mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]}
        />
        <Compound
          tireCompound={4}
          mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]}
        />
        <Compound
          tireCompound={4}
          mockTires={[{ TireIndex: 4, TireCompoundType: 'Alternate' }]}
        />
      </div>
      <div key={5} className="flex items-center gap-4">
        <span className="text-white w-24">Primary:</span>
        <Compound
          tireCompound={5}
          mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]}
        />
        <Compound
          tireCompound={5}
          mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]}
        />
        <Compound
          tireCompound={5}
          mockTires={[{ TireIndex: 5, TireCompoundType: 'Primary' }]}
        />
      </div>
      <div key={6} className="flex items-center gap-4">
        <span className="text-white w-24">Dry:</span>
        <Compound
          tireCompound={6}
          mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]}
        />
        <Compound
          tireCompound={6}
          mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]}
        />
        <Compound
          tireCompound={6}
          mockTires={[{ TireIndex: 6, TireCompoundType: 'Dry' }]}
        />
      </div>
    </div>
  ),
};

const LMU_TIRES = [
  { TireIndex: 0, TireCompoundType: 'Hard' },
  { TireIndex: 1, TireCompoundType: 'Medium' },
  { TireIndex: 2, TireCompoundType: 'Soft' },
  { TireIndex: 3, TireCompoundType: 'Wet' },
];

const Row = ({ label, wheels }: { label: string; wheels: number[] }) => (
  <div className="flex items-center gap-4">
    <span className="text-white w-56">{label}</span>
    <Compound
      tireCompound={wheels[0]}
      wheelCompounds={wheels}
      mockTires={LMU_TIRES}
    />
  </div>
);

/**
 * LMU reports a compound per wheel, so a car can be on more than one.
 *
 * A uniform set keeps the single glyph; a mixed one splits into four dots laid
 * out as the car. Both occupy the same space, so a row holding one of each
 * does not change height.
 */
export const PerWheel: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-lg">
      <Row label="Uniform (glyph):" wheels={[1, 1, 1, 1]} />
      <Row label="Wet front, dry rear:" wheels={[3, 3, 0, 0]} />
      <Row label="Staggered softs:" wheels={[2, 2, 1, 1]} />
      <Row label="One corner unknown:" wheels={[0, 0, 0, -1]} />
      <Row label="All four different:" wheels={[0, 1, 2, 3]} />
    </div>
  ),
};
