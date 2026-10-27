import { useEffect, useState } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  GantryChannelDecorator,
  GantryDecorator,
  RaceControlDecorator,
  gantryArgTypes,
  gantryStoryArgs,
  type GantryStoryArgs,
} from '@irdashies/storybook';
import { SessionHoldProvider } from '@irdashies/domain/sessionHold/useSessionHold';
import { GantryStandingsHost, useGantryStandings } from './GantryStandingsHost';

/** Runs the sim briefly, then closes it so the host holds the session. */
const SimClosesDecorator: Decorator = (Story) => {
  const [running, setRunning] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setRunning(false), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <SessionHoldProvider running={running}>
      <Story />
    </SessionHoldProvider>
  );
};

interface HostStoryArgs extends GantryStoryArgs {
  followedCarIdx: number | null;
}

/** Resolves the saved standings choice the way GantryApp does. */
const HostFromSettings = ({ followedCarIdx }: HostStoryArgs) => {
  const standings = useGantryStandings();
  if (standings.status !== 'ready') {
    return <div className="p-2 text-xs text-slate-400">Built-in view</div>;
  }
  return (
    <GantryStandingsHost
      widget={standings.widget}
      source={standings.source}
      followedCarIdx={followedCarIdx}
    />
  );
};

const setup: Decorator[] = [
  RaceControlDecorator(),
  GantryDecorator(),
  GantryChannelDecorator(),
];

const meta: Meta<HostStoryArgs> = {
  title: 'widgets/Gantry/GantryStandingsHost',
  parameters: { layout: 'fullscreen' },
  args: {
    ...gantryStoryArgs,
    standingsSource: 'overlay',
    followedCarIdx: null,
  },
  argTypes: gantryArgTypes,
  render: (args) => (
    <div className="h-screen w-[720px] bg-slate-900">
      <HostFromSettings {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<HostStoryArgs>;

/** The overlay Standings widget as the Gantry shows it, with click and follow. */
export const OverlayStandings: Story = {
  decorators: setup,
};

/** After the sim closes the overlay-style standings keep the final results. */
export const OverlayStandingsSessionEnded: Story = {
  decorators: [SimClosesDecorator, ...setup],
};
