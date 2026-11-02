import type { Meta, StoryObj } from '@storybook/react-vite';
import type { P2PDisplayState } from '@irdashies/context';
import { PushToPassCell } from './PushToPassCell';

const meta = {
  title: 'Components/Standings/PushToPassCell',
  component: PushToPassCell,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="pointer-events-none">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PushToPassCell>;

export default meta;
type Story = StoryObj<typeof meta>;

const examples: { label: string; state: P2PDisplayState }[] = [
  { label: 'Practice available', state: { status: 'inactive', count: 1000 } },
  { label: 'Practice active', state: { status: 'active', count: 1000 } },
  { label: 'Practice cooldown', state: { status: 'cooldown', count: 1000 } },
  {
    label: 'Recorded IL-15 practice',
    state: { status: 'inactive', count: 999 },
  },
  { label: 'Race available', state: { status: 'inactive', count: 65 } },
  { label: 'Race active', state: { status: 'active', count: 65 } },
  { label: 'Race low remaining', state: { status: 'inactive', count: 15 } },
  { label: 'Race exhausted', state: { status: 'exhausted', count: 0 } },
];

export const PracticeAndRace: Story = {
  render: () => (
    <table className="bg-slate-800 text-white text-sm border-separate border-spacing-x-2 border-spacing-y-1">
      <thead>
        <tr>
          <th className="px-2 text-left">State</th>
          <th>P2P</th>
          <th>Gap</th>
        </tr>
      </thead>
      <tbody>
        {examples.map(({ label, state }) => (
          <tr key={label}>
            <td className="px-2">{label}</td>
            <PushToPassCell state={state} />
            <td className="px-2 text-right">+1.25</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
