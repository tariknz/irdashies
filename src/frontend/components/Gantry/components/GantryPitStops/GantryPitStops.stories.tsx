import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  PitStopsView,
  type PitStopsClassFilter,
  type PitStopsMode,
} from './GantryPitStops';
import { demoPitStopData } from './pitStopsDemo';

interface StoryArgs {
  mode: PitStopsMode;
  inProgress: boolean;
  empty: boolean;
  isReplayPlaying: boolean;
}

const Interactive = ({
  mode: initialMode,
  inProgress,
  empty,
  isReplayPlaying,
}: StoryArgs) => {
  const [mode, setMode] = useState(initialMode);
  const [classFilter, setClassFilter] = useState<PitStopsClassFilter | null>(
    null
  );
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  return (
    <div className="h-screen overflow-hidden bg-settings-page p-3 text-white">
      <PitStopsView
        data={demoPitStopData({ inProgress, empty })}
        followedCarIdx={5}
        classFilter={classFilter}
        onClassFilterChange={setClassFilter}
        mode={mode}
        onModeChange={setMode}
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
        isReplayPlaying={isReplayPlaying}
      />
    </div>
  );
};

const meta: Meta<StoryArgs> = {
  title: 'widgets/Gantry/components/GantryPitStops',
  render: (args) => <Interactive key={args.mode} {...args} />,
  args: {
    mode: 'stops',
    inProgress: true,
    empty: false,
    isReplayPlaying: false,
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['stops', 'teams'] },
  },
};
export default meta;

type Story = StoryObj<StoryArgs>;

export const StopLog: Story = {};
export const Teams: Story = { args: { mode: 'teams' } };
export const NoStops: Story = { args: { empty: true } };
/** Replay running, so the -5s buttons jump to each stop. */
export const ReplayPlaying: Story = { args: { isReplayPlaying: true } };
