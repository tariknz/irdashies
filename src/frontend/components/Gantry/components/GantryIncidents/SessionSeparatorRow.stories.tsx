import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionSeparatorRow } from './SessionSeparatorRow';

const meta: Meta<typeof SessionSeparatorRow> = {
  component: SessionSeparatorRow,
  title: 'widgets/Gantry/components/SessionSeparatorRow',
  parameters: { layout: 'fullscreen' },
  args: {
    label: 'Qualify',
    count: 6,
    isCurrent: false,
    isReplay: false,
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Session name, in title case.',
    },
    count: {
      control: { type: 'number', min: 0 },
      description: 'Incidents visible in this session after the filters.',
    },
    isCurrent: {
      control: 'boolean',
      description: 'The session the sim is in now. Adds the LIVE tag.',
    },
    isReplay: {
      control: 'boolean',
      description: 'A replay is playing. The tag reads REPLAY instead of LIVE.',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-130 bg-slate-900 text-white">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** A finished session. */
export const PastSession: Story = {};

/** The live session. */
export const Live: Story = {
  args: { label: 'Race', count: 14, isCurrent: true },
};

/** The current session while a replay is playing. */
export const Replay: Story = {
  args: { label: 'Race', count: 14, isCurrent: true, isReplay: true },
};

/** A session that has just started, so nothing has happened yet. */
export const CurrentNoIncidents: Story = {
  args: { label: 'Race', count: 0, isCurrent: true },
};

/** One incident, so the count reads in the singular. */
export const SingleIncident: Story = {
  args: { label: 'Heat 1', count: 1 },
};

/** A long name in a narrow pane. */
export const LongLabel: Story = {
  args: { label: 'Last Chance Qualifier', count: 23, isCurrent: true },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};
