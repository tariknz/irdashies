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

const PLAYER_CAR_IDX = 4;
const standingsDefaults = getWidgetDefaultConfig('standings');

const classRankSnapshot = (
  playerClassPosition: number,
  playerClassSize: number
): SessionBarSnapshot => ({
  displayUnits: 1,
  brakeBiasIsClio: false,
  incidents: 0,
  trackWetness: 1,
  playerCarIdx: PLAYER_CAR_IDX,
  playerClassified: true,
  playerOverallPosition: playerClassPosition,
  playerClassPosition,
  playerClassSize,
  competitorCarIds: [],
  competitorPositions: [],
  lastLapTopSpeed: null,
  sessionBestTopSpeed: null,
  sessionNum: 0,
  version: 1,
});

export default {
  component: SessionBar,
  title: 'widgets/Standings/components/SessionBar/ClassRank',
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

// Multi-class race: player is 3rd of 6 in their class, 2 other-class cars also present
export const ClassRank: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': classRankSnapshot(3, 6),
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
};

// Single-class race: player is 5th of 6
export const ClassRankSingleClass: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': classRankSnapshot(5, 6),
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
};

// Player is leading their class (rank 1)
export const ClassRankLeading: Story = {
  decorators: [
    ChannelSnapshotDecorator({
      'session-bar.snapshot': classRankSnapshot(1, 6),
    }),
  ],
  args: {
    settings: {
      ...standingsDefaults.headerBar,
      classRank: { enabled: true },
      displayOrder: ['classRank'],
    },
    position: 'header',
  },
};
