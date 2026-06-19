import type { Meta, StoryObj } from '@storybook/react-vite';
import { DriverStatusBadges } from './DriverStatusBadges';

const meta: Meta<typeof DriverStatusBadges> = {
  component: DriverStatusBadges,
  title: 'widgets/Standings/components/DriverStatusBadges',
  decorators: [
    (Story) => (
      <div className="bg-slate-800 p-4 inline-flex">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DriverStatusBadges>;

export const PitActive: Story = {
  args: { pit: true },
};

export const Out: Story = {
  args: { out: true },
};

export const LastPit: Story = {
  args: { lastPit: true, lastPitLap: 5 },
};

export const LastPitWithDuration: Story = {
  args: { lastPit: true, lastPitLap: 5, pitStopDuration: 34, showPitTime: true },
};

export const LastPitWithDurationLong: Story = {
  args: { lastPit: true, lastPitLap: 5, pitStopDuration: 84, showPitTime: true },
};

export const LastPitLap1WithDuration: Story = {
  name: 'LastPit – Lap 1 (was broken by > 1 guard)',
  args: { lastPit: true, lastPitLap: 1, pitStopDuration: 27, showPitTime: true },
};

export const OutWithDuration: Story = {
  args: { out: true, lastPit: true, lastPitLap: 5, pitStopDuration: 34, showPitTime: true },
};

export const DNF: Story = {
  args: { dnf: true },
};

export const Tow: Story = {
  args: { tow: true },
};

export const Repair: Story = {
  args: { repair: true },
};

export const Penalty: Story = {
  args: { penalty: true },
};
