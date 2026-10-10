import { Meta, StoryObj } from '@storybook/react-vite';
import { DEMO_GROUPS as groups } from '../demoField';
import { GridCard } from './PhaseScreens';

export default {
  title: 'widgets/Broadcast/PhaseScreens',
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

export const Grid: Story = {
  render: () => frame(<GridCard groups={groups} perClass={4} />),
};
