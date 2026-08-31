import type { Meta, StoryObj } from '@storybook/react-vite';
import { SplitPane } from './SplitPane';

interface PanelProps {
  title: string;
  tone: string;
}
const Panel = ({ title, tone }: PanelProps) => (
  <div className={`h-full p-3 text-white text-sm ${tone}`}>
    <div className="font-bold uppercase tracking-wider text-xs text-slate-400">
      {title}
    </div>
    <p className="pt-2">Drag the divider. Double-click it to reset.</p>
  </div>
);

const meta: Meta<typeof SplitPane> = {
  component: SplitPane,
  title: 'widgets/Gantry/components/SplitPane',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    defaultPercent: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Percentage of the width the left pane starts at.',
    },
    minPercent: {
      control: { type: 'range', min: 0, max: 50, step: 1 },
      description: 'Narrowest either pane is allowed to get, as a percentage.',
    },
    label: {
      control: 'text',
      description: 'Accessible name for the divider.',
    },
    storageKey: {
      control: 'text',
      description: 'localStorage key the ratio is remembered under.',
    },
    left: { control: false },
    right: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="w-full h-screen flex bg-slate-900">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SplitPane>;

export const Even: Story = {
  args: {
    label: 'Example split',
    left: <Panel title="Left" tone="bg-slate-800/60" />,
    right: <Panel title="Right" tone="bg-slate-900/60" />,
  },
};

export const LeftHeavy: Story = {
  args: {
    ...Even.args,
    defaultPercent: 70,
  },
};
