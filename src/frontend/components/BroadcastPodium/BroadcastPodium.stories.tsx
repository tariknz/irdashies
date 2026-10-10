import { Meta, StoryObj } from '@storybook/react-vite';
import { DEMO_GROUPS as groups } from '../Broadcast/demoField';
import { PodiumCard } from './PodiumCard';

export default {
  title: 'widgets/BroadcastPodium',
} as Meta;

type Story = StoryObj;

const frame = (children: React.ReactNode) => (
  <div
    className="w-[300px] text-sm"
    style={{ ['--bg-opacity' as string]: '90%' }}
  >
    {children}
  </div>
);

export const Steps: Story = {
  render: () => frame(<PodiumCard groups={groups} look="steps" />),
};

export const Trophies: Story = {
  render: () => frame(<PodiumCard groups={groups} look="trophy" />),
};
