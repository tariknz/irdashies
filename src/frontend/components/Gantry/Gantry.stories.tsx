import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  GantryChannelDecorator,
  GantryDecorator,
  RaceControlDecorator,
  emptyLapHistory,
  enduranceLapHistory,
  enduranceSession,
  gantryArgTypes,
  gantryStoryArgs,
  mockIncidents,
  type GantryChannels,
  type GantryDecoratorOptions,
  type GantryStoryArgs,
} from '@irdashies/storybook';
import type { Incident } from '@irdashies/types';
import { Gantry, type GantryProps } from './Gantry';
import { useEffect, useState } from 'react';
import { GantrySessionHoldProvider } from './hooks/useGantrySessionHold';

interface GantrySetup extends GantryDecoratorOptions {
  channels?: Partial<GantryChannels>;
  incidents?: Incident[];
}

/**
 * Decorators for one Gantry story. The channel decorator goes last: Storybook
 * nests the final entry outermost, and `window.channelBridge` has to exist
 * before the widget's first render.
 */
const gantrySetup = ({
  channels,
  incidents,
  ...providers
}: GantrySetup = {}): Decorator[] => [
  RaceControlDecorator(incidents),
  GantryDecorator(providers),
  GantryChannelDecorator(channels),
];

/** Runs the sim briefly, then closes it so the Gantry holds the session. */
const SimClosesDecorator: Decorator = (Story) => {
  const [running, setRunning] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setRunning(false), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <GantrySessionHoldProvider running={running}>
      <Story />
    </GantrySessionHoldProvider>
  );
};

const meta: Meta<GantryStoryArgs & GantryProps> = {
  component: Gantry,
  title: 'widgets/Gantry',
  parameters: { layout: 'fullscreen' },
  args: gantryStoryArgs,
  argTypes: gantryArgTypes,
};

export default meta;
type Story = StoryObj<GantryStoryArgs & GantryProps>;

/** A 28-lap sprint over the mock grid, with a mixed incident feed. */
export const Default: Story = {
  decorators: gantrySetup(),
};

/** 60 cars over 2 classes, 500 laps. Past the 300-lap cap the ring has wrapped. */
export const Endurance: Story = {
  decorators: gantrySetup({
    session: enduranceSession,
    channels: { 'lap-history.snapshot': enduranceLapHistory },
  }),
};

/** Replay running, so the incident feed's jump buttons are live. */
export const ReplayPlaying: Story = {
  args: { isReplayPlaying: true },
  decorators: gantrySetup(),
};

/** Race under way, but nothing has happened yet: no laps, no incidents. */
export const QuietRace: Story = {
  decorators: gantrySetup({
    incidents: [],
    channels: { 'lap-history.snapshot': emptyLapHistory },
  }),
};

/** A single-driver feed, for checking the incident row layout in isolation. */
export const OneIncident: Story = {
  decorators: gantrySetup({ incidents: mockIncidents.slice(0, 1) }),
};

const DockPlaceholder = ({ label }: { label: string }) => (
  <div className="flex-1 flex flex-col min-w-0">
    <div className="px-2 py-0.5 bg-slate-800/60 border-b border-slate-700/50 text-xs font-bold uppercase tracking-wider text-slate-400">
      {label}
    </div>
    <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
      Docked widget
    </div>
  </div>
);

/**
 * Panels docked under the incident feed. The real panels come from
 * GantryDockHost; Gantry only places whatever it is given.
 */
export const WithDock: Story = {
  argTypes: { dock: { control: false } },
  args: {
    dock: (
      <div className="flex h-full divide-x divide-slate-700/50">
        <DockPlaceholder label="Fuel Calculator" />
        <DockPlaceholder label="Track Map" />
      </div>
    ),
  },
  decorators: gantrySetup(),
};

/** The sim has closed: the final results and lap graph stay up for review. */
export const SessionEnded: Story = {
  decorators: [SimClosesDecorator, ...gantrySetup()],
};
