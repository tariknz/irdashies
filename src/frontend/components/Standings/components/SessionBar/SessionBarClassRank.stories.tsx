import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { SessionBar } from './SessionBar';
import {
  DashboardProvider,
  useSessionStore,
  useTelemetryStore,
} from '@irdashies/context';
import { mockDashboardBridge } from '../../../../../../.storybook/mockDashboardBridge';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { Telemetry } from '@irdashies/types';

const PLAYER_CAR_IDX = 4;
const PLAYER_CLASS_ID = 1;
const OTHER_CLASS_ID = 2;

const standingsDefaults = getWidgetDefaultConfig('standings');

// Class rank depends on CarIdxClassPosition which the 60Hz mock bridge does not provide.
// Only DashboardProvider is mounted; session and telemetry stores are seeded directly.

interface SeederProps {
  drivers: { CarIdx: number; CarClassID: number }[];
  classPositionsByIdx: number[];
}

const ClassRankSeeder = ({ drivers, classPositionsByIdx }: SeederProps) => {
  useEffect(() => {
    useSessionStore.setState({
      session: {
        DriverInfo: {
          DriverCarIdx: PLAYER_CAR_IDX,
          Drivers: drivers,
        },
      } as never,
    });
    useTelemetryStore.getState().setTelemetry({
      CarIdxClassPosition: { value: classPositionsByIdx },
    } as Telemetry);
    return () => useTelemetryStore.getState().resetTelemetry();
  }, [drivers, classPositionsByIdx]);
  return null;
};

// 8 drivers in player's class, player (carIdx 4) is 3rd in class
const MULTI_CLASS_DRIVERS = [
  { CarIdx: 0, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 1, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 2, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 3, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 4, CarClassID: PLAYER_CLASS_ID }, // player
  { CarIdx: 5, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 6, CarClassID: OTHER_CLASS_ID },
  { CarIdx: 7, CarClassID: OTHER_CLASS_ID },
];
// Player (carIdx 4) is 3rd in class; other class drivers have their own class positions
const MULTI_CLASS_POSITIONS = [1, 2, 4, 5, 3, 6, 1, 2];

// All 6 drivers in the same class, player is 5th
const SINGLE_CLASS_DRIVERS = [
  { CarIdx: 0, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 1, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 2, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 3, CarClassID: PLAYER_CLASS_ID },
  { CarIdx: 4, CarClassID: PLAYER_CLASS_ID }, // player
  { CarIdx: 5, CarClassID: PLAYER_CLASS_ID },
];
const SINGLE_CLASS_POSITIONS = [1, 2, 3, 4, 5, 6];

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar/ClassRank',
  decorators: [
    (Story: ComponentType) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <Story />
      </DashboardProvider>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

// Multi-class race: player is 3rd of 6 in their class, 2 other-class cars also present
export const ClassRank: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ClassRankSeeder
        drivers={MULTI_CLASS_DRIVERS}
        classPositionsByIdx={MULTI_CLASS_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Single-class race: player is 5th of 6
export const ClassRankSingleClass: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ClassRankSeeder
        drivers={SINGLE_CLASS_DRIVERS}
        classPositionsByIdx={SINGLE_CLASS_POSITIONS}
      />
      <SessionBar {...args} />
    </>
  ),
};

// Player is leading their class (rank 1)
export const ClassRankLeading: Story = {
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
  render: (args) => (
    <>
      <ClassRankSeeder
        drivers={MULTI_CLASS_DRIVERS}
        classPositionsByIdx={[2, 3, 4, 5, 1, 6, 1, 2]}
      />
      <SessionBar {...args} />
    </>
  ),
};
