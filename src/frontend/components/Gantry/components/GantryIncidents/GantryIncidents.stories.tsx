import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  GantryChannelDecorator,
  GantryDecorator,
  RaceControlDecorator,
  WEEKEND_FEATURE_SESSION_NUM,
  gantryArgTypes,
  mockIncidents,
  trackStateStorySnapshot,
  weekendIncidents,
  weekendSession,
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

// GantryChannelDecorator comes last in each list, so it wraps everything:
// window.channelBridge must exist before the widget's first render.
const mockSessionDecorators: Decorator[] = [
  GantryDecorator(),
  RaceControlDecorator((args) => FEEDS[args.feed as string] ?? mockIncidents),
  GantryChannelDecorator(),
];

const weekendDecorators = (incidents: Incident[]): Decorator[] => [
  GantryDecorator({ session: weekendSession }),
  RaceControlDecorator(incidents),
  GantryChannelDecorator({
    'track-state.snapshot': {
      ...trackStateStorySnapshot,
      sessionNum: WEEKEND_FEATURE_SESSION_NUM,
    },
  }),
];

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
  ],
};
export default meta;
type Story = StoryObj<IncidentsArgs>;

export const Default: Story = {
  decorators: mockSessionDecorators,
};

/** Replay running, so the -5s / -10s / -30s jump buttons are enabled. */
export const ReplayPlaying: Story = {
  args: { isReplayPlaying: true },
  decorators: mockSessionDecorators,
};

/** Nothing detected yet. */
export const Empty: Story = {
  args: { feed: 'Empty' },
  decorators: mockSessionDecorators,
};

/**
 * Practice, qualify, a heat and the feature, with a separator above each
 * session. The feature is live. Try the session filter.
 */
export const MultiSessionWeekend: Story = {
  name: 'Multi-session weekend',
  argTypes: { feed: { table: { disable: true } } },
  decorators: weekendDecorators(weekendIncidents),
};

/** The feature has just started, so its separator reads "no incidents yet". */
export const WeekendFeatureNotStarted: Story = {
  name: 'Multi-session weekend, feature not started',
  argTypes: { feed: { table: { disable: true } } },
  decorators: weekendDecorators(
    weekendIncidents.filter((i) => i.sessionNum !== WEEKEND_FEATURE_SESSION_NUM)
  ),
};
