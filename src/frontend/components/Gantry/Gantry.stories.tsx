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
import { useEffect, useState } from 'react';
import { Gantry } from './Gantry';
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

const meta: Meta<GantryStoryArgs> = {
  component: Gantry,
  title: 'widgets/Gantry',
  parameters: { layout: 'fullscreen' },
  args: gantryStoryArgs,
  argTypes: gantryArgTypes,
};

export default meta;
type Story = StoryObj<GantryStoryArgs>;

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

/** The sim has closed: the final results and lap graph stay up for review. */
export const SessionEnded: Story = {
  decorators: [SimClosesDecorator, ...gantrySetup()],
};
