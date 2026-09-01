import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  GantryChannelDecorator,
  GantryDecorator,
  RaceControlDecorator,
  gantryArgTypes,
  mockIncidents,
} from '@irdashies/storybook';
import { IncidentType, type Incident } from '@irdashies/types';
import { GantryIncidents } from './GantryIncidents';

/** Named feeds, so the story can be switched without editing code. */
const FEEDS: Record<string, Incident[]> = {
  'All types': mockIncidents,
  'Crashes only': mockIncidents.filter((i) => i.type === IncidentType.Crash),
  'Pit entries only': mockIncidents.filter(
    (i) => i.type === IncidentType.PitEntry
  ),
  Empty: [],
};

interface IncidentsArgs {
  feed: keyof typeof FEEDS;
  isReplayPlaying: boolean;
}

const meta: Meta<IncidentsArgs> = {
  component: GantryIncidents,
  title: 'widgets/Gantry/components/GantryIncidents',
  parameters: { layout: 'fullscreen' },
  args: {
    feed: 'All types',
    isReplayPlaying: false,
  },
  argTypes: {
    feed: {
      control: 'select',
      options: Object.keys(FEEDS),
      description: 'Which incidents are seeded into the feed.',
      table: { category: 'Data' },
    },
    isReplayPlaying: gantryArgTypes.isReplayPlaying,
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-130 bg-slate-900 text-white">
        <Story />
      </div>
    ),
    GantryDecorator(),
    RaceControlDecorator((args) => FEEDS[args.feed as string] ?? mockIncidents),
    // Last, so it wraps everything: window.channelBridge must exist before the
    // widget's first render.
    GantryChannelDecorator(),
  ],
};
export default meta;
type Story = StoryObj<IncidentsArgs>;

export const Default: Story = {};

/** Replay running, so the -5s / -10s / -30s jump buttons are enabled. */
export const ReplayPlaying: Story = {
  args: { isReplayPlaying: true },
};

/** Nothing detected yet. */
export const Empty: Story = {
  args: { feed: 'Empty' },
};
