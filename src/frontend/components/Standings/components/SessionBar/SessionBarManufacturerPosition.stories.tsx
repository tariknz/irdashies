import { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import { SessionBar } from './SessionBar';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '../../../../../../.storybook/mockDashboardBridge';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { SessionBarSnapshot } from '@irdashies/types';
import {
  ChannelSnapshotDecorator,
  TelemetryDecorator,
} from '@irdashies/storybook';

// carId 56 = NASCAR Cup Series Toyota Camry, carId 30 = Ford Mustang FR500S
const TOYOTA_CAR_ID = 56;
const FORD_CAR_ID = 30;
const PLAYER_CAR_IDX = 4;

const standingsDefaults = getWidgetDefaultConfig('standings');

const manufacturerSnapshot = (
  competitorCarIds: number[],
  competitorPositions: number[],
  playerOverallPosition: number
): SessionBarSnapshot => ({
  displayUnits: 1,
  brakeBiasIsClio: false,
  incidents: 0,
  trackWetness: 1,
  playerCarIdx: PLAYER_CAR_IDX,
  playerCarId: TOYOTA_CAR_ID,
  playerClassified: true,
  playerOverallPosition,
  playerClassPosition: playerOverallPosition,
  playerClassSize: competitorCarIds.length,
  competitorCarIds,
  competitorPositions,
  lastLapTopSpeed: null,
  sessionBestTopSpeed: null,
  sessionNum: 0,
  version: 1,
});

const MULTI_MAKE_SNAPSHOT = manufacturerSnapshot(
  [
    TOYOTA_CAR_ID,
    TOYOTA_CAR_ID,
    TOYOTA_CAR_ID,
    TOYOTA_CAR_ID,
    TOYOTA_CAR_ID,
    FORD_CAR_ID,
    FORD_CAR_ID,
  ],
  [1, 2, 4, 5, 3, 6, 7],
  3
);
const SINGLE_MAKE_SNAPSHOT = manufacturerSnapshot(
  Array(6).fill(TOYOTA_CAR_ID),
  [1, 2, 3, 4, 5, 6],
  5
);
const SOLE_TOYOTA_SNAPSHOT = manufacturerSnapshot(
  [
    FORD_CAR_ID,
    FORD_CAR_ID,
    FORD_CAR_ID,
    FORD_CAR_ID,
    TOYOTA_CAR_ID,
    FORD_CAR_ID,
  ],
  [2, 3, 4, 5, 1, 6],
  1
);

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar/ManufacturerPosition',
  decorators: [
    TelemetryDecorator(),
    (Story: ComponentType) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <Story />
      </DashboardProvider>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof SessionBar>;

// Multi-make race: player (Toyota) is 3rd of 5, 2 Fords also in session
export const ManufacturerPosition: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': MULTI_MAKE_SNAPSHOT,
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
};

// Single-make session with hideIfSingleMake:false — item still shows (player is 5th of 6 Toyotas)
export const ManufacturerPositionSingleMakeVisible: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': SINGLE_MAKE_SNAPSHOT,
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleMake: false },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
};

// Single-make session with hideIfSingleMake:true — item hides (no output)
export const ManufacturerPositionHideIfSingleMake: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': SINGLE_MAKE_SNAPSHOT,
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleMake: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
};

// Player is the only Toyota with hideIfSingleDriver:false — shows "Toyota 1/1"
export const ManufacturerPositionSoleDriver: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': SOLE_TOYOTA_SNAPSHOT,
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleDriver: false },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
};

// Player is the only Toyota with hideIfSingleDriver:true — item hides (no output)
export const ManufacturerPositionHideIfSingleDriver: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': SOLE_TOYOTA_SNAPSHOT,
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      manufacturerPosition: { enabled: true, hideIfSingleDriver: true },
      displayOrder: ['manufacturerPosition'],
    },
    position: 'header',
  },
};
