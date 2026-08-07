import { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  title: 'components/Tooltip',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content:
      'Jumps the replay to 10 seconds before this incident and points the camera at the car.',
    children: (
      <button className="rounded border border-indigo-500/40 bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">
        -10s
      </button>
    ),
  },
};

export const Below: Story = {
  args: {
    ...Default.args,
    placement: 'bottom',
    content: 'Opens beneath the trigger when there is room.',
  },
};

export const OnADisabledControl: Story = {
  args: {
    content:
      'Available only while a replay is playing. Wrap disabled controls in a span so the tooltip still receives hover.',
    children: (
      <span className="inline-flex">
        <button
          disabled
          className="cursor-not-allowed rounded border border-slate-700 bg-white/5 px-2 py-0.5 text-xs font-bold text-slate-600"
        >
          -30s
        </button>
      </span>
    ),
  },
};

export const InsideAnOverflowHiddenPanel: Story = {
  args: Default.args,
  render: (args) => (
    <div className="h-24 w-56 overflow-hidden rounded border border-slate-700 bg-slate-800 p-4">
      <p className="mb-2 text-xs text-slate-400">
        Clipping container — the tooltip is portalled out of it.
      </p>
      <Tooltip {...args} />
    </div>
  ),
};
