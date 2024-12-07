import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { DriverInfoRow } from './DriverInfoRow';
import { DriverRatingBadge } from '../DriverRatingBadge/DriverRatingBadge';

export default {
  component: DriverInfoRow,
  decorators: [
    (Story: StoryFn) => (
      <table className="w-full">
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof DriverInfoRow>;

export const Primary: Story = {
  args: {
    carIdx: 1,
    carNumber: '999',
    name: 'John Doe',
    isPlayer: false,
    delta: 0.1,
    position: 1,
    classColor: 16777215,
    fastestTime: 111.111,
    lastTime: 112.225,
    badge: <DriverRatingBadge license="A 4.99" rating={4999} />,
    onPitRoad: false,
    onTrack: true,
  },
};

export const HasFastestLap: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: true,
  },
};

export const LastLapIsFastestLap: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: true,
    fastestTime: 111.111,
    lastTime: 111.111,
  },
};

export const LastLapIsBestTime: Story = {
  args: {
    ...Primary.args,
    hasFastestTime: false,
    fastestTime: 111.111,
    lastTime: 111.111,
  },
};

export const OnPitRoad: Story = {
  args: {
    ...Primary.args,
    onPitRoad: true,
  },
};

export const NotOnTrack: Story = {
  args: {
    ...Primary.args,
    onTrack: false,
  },
};

export const RadioActive: Story = {
  args: {
    ...Primary.args,
    radioActive: true,
  },
};

export const IsPlayer: Story = {
  args: {
    ...Primary.args,
    isPlayer: true,
  },
};

export const IsLapped: Story = {
  args: {
    ...Primary.args,
    isLapped: true,
  },
};

export const IsLappingAhead: Story = {
  args: {
    ...Primary.args,
    isLappingAhead: true,
  },
};
