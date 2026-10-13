import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';
import { GantryTabBar } from './GantryTabBar';

type GantryTabBarProps = ComponentProps<typeof GantryTabBar>;
type GantryView = GantryTabBarProps['activeView'];

const drivers = [
  { carIdx: 1, name: 'Verstappen', carNumber: '1' },
  { carIdx: 4, name: 'Norris', carNumber: '4' },
  { carIdx: 16, name: 'Leclerc', carNumber: '16' },
];

/** Keeps the tab, follow and pin choices live so the controls can be clicked. */
const TabBarStory = ({ alwaysOnTop }: { alwaysOnTop: boolean }) => {
  const [view, setView] = useState<GantryView>('standings-incidents');
  const [followed, setFollowed] = useState<number | null>(null);
  const [pinned, setPinned] = useState(alwaysOnTop);

  return (
    <div className="bg-slate-900 text-white">
      <GantryTabBar
        activeView={view}
        onViewChange={setView}
        drivers={drivers}
        followedCarIdx={followed}
        onFollowChange={setFollowed}
        alwaysOnTop={pinned}
        onAlwaysOnTopChange={setPinned}
      />
    </div>
  );
};

const meta: Meta<typeof TabBarStory> = {
  component: TabBarStory,
  title: 'widgets/Gantry/components/GantryTabBar',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    alwaysOnTop: {
      control: 'boolean',
      description: 'Whether the Gantry window starts pinned on top.',
    },
  },
  render: (args) => <TabBarStory key={String(args.alwaysOnTop)} {...args} />,
};

export default meta;
type Story = StoryObj<typeof TabBarStory>;

export const Unpinned: Story = {
  args: { alwaysOnTop: false },
};

export const Pinned: Story = {
  args: { alwaysOnTop: true },
};
