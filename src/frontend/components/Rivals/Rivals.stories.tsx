import { useEffect } from 'react';
import { Meta, StoryObj } from '@storybook/react-vite';
import { RivalsRow, getCompactSizes } from './RivalsRow';
import { TelemetryDecorator } from '@irdashies/storybook';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { RivalEntry } from './hooks/useRivalsData';
import { RIVAL_COLUMN_IDS, RIVAL_COLUMN_META, RivalColumnId } from './RivalsRow';
import { useGeneralSettings, useRivalSectorStore, useSectorTimingStore } from '@irdashies/context';

export default {
  title: 'widgets/Rivals',
  component: RivalsRow,
  decorators: [TelemetryDecorator()],
} as Meta;

type Story = StoryObj<typeof RivalsRow>;

const defaultConfig = getWidgetDefaultConfig('rivals');

const mockDriver = (name: string, carNum: string): RivalEntry['driver'] => ({
  name,
  carNum,
  license: 'A',
  rating: 2500,
});

const mockAhead: RivalEntry = {
  carIdx: 5,
  classPosition: 3,
  isPlayer: false,
  driver: mockDriver('James Wilson', '42'),
  fastestTime: 102.341,
  hasFastestTime: false,
  lastTime: 102.812,
  lastTimeState: undefined,
  onPitRoad: false,
  onTrack: true,
  tireCompound: 0,
  carClass: {
    id: 1,
    color: 0xff3300,
    name: 'GTD Pro',
    relativeSpeed: 1,
    estLapTime: 103,
  },
  relativePct: 0.08,
  delta: 2.4,
  lap: 10,
  dnf: false,
  repair: false,
  penalty: false,
  slowdown: false,
  lastTimeDiff: 0.471,
  bestTimeDiff: 0.212,
};

const mockBehind: RivalEntry = {
  ...mockAhead,
  carIdx: 7,
  classPosition: 5,
  driver: mockDriver('Sophie Martin', '18'),
  fastestTime: 102.688,
  lastTime: 103.254,
  relativePct: -0.05,
  delta: -1.7,
  lastTimeDiff: 0.913,
  bestTimeDiff: 0.559,
};

const mockFasterRival: RivalEntry = {
  ...mockAhead,
  carIdx: 9,
  classPosition: 2,
  driver: mockDriver('Max Verstappen', '1'),
  fastestTime: 101.9,
  lastTime: 102.1,
  lastTimeDiff: -0.712,
  bestTimeDiff: -0.441,
};

export const AheadAllColumns: Story = {
  args: {
    rival: mockAhead,
    config: {
      background: {
        opacity: 80,
      },

      gap: {
        enabled: true,
      },

      lastTime: {
        enabled: true,
      },

      lastTimeDiff: {
        enabled: true,
      },

      bestTime: {
        enabled: true,
      },

      bestTimeDiff: {
        enabled: true,
      },

      showHeader: {
        enabled: true,
      },

      displayOrder: [
        'gap',
        'lastTime',
        'lastTimeDiff',
        'bestTime',
        'bestTimeDiff',
      ],

      sessionVisibility: {
        race: true,
        loneQualify: true,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },

      showOnlyWhenOnTrack: false,
    },
    displayOrder: RIVAL_COLUMN_IDS,
  },
};

export const BehindAllColumns: Story = {
  args: {
    rival: mockBehind,
    config: { ...defaultConfig, bestTimeDiff: { enabled: true } },
    displayOrder: RIVAL_COLUMN_IDS,
  },
};

export const FasterRival: Story = {
  args: {
    rival: mockFasterRival,
    config: { ...defaultConfig, bestTimeDiff: { enabled: true } },
    displayOrder: RIVAL_COLUMN_IDS,
  },
};

export const GapOnly: Story = {
  args: {
    rival: mockAhead,
    config: {
      ...defaultConfig,
      lastTime: { enabled: false },
      lastTimeDiff: { enabled: false },
      bestTime: { enabled: false },
      bestTimeDiff: { enabled: false },
    },
    displayOrder: RIVAL_COLUMN_IDS,
  },
};

export const NoRival: Story = {
  args: {
    rival: undefined,
    config: { ...defaultConfig, bestTimeDiff: { enabled: true } },
    displayOrder: RIVAL_COLUMN_IDS,
  },
};

const headerConfig = {
  ...defaultConfig,
  bestTimeDiff: { enabled: true },
  showHeader: { enabled: true },
};

export const WithHeader: Story = {
  render: () => {
    const displayOrder = RIVAL_COLUMN_IDS;
    const { rowGap, rowPx, cellW, posW, headerFontSize } = getCompactSizes(useGeneralSettings()?.compactMode);
    return (
      <div className="bg-slate-800/80 rounded-md overflow-hidden flex flex-col justify-center w-[480px]">
        <div className={`flex items-center ${rowGap} ${rowPx} py-0.5 ${headerFontSize} text-slate-400 tracking-wider border-b border-slate-600/50`}>
          <span className={`${posW} shrink-0 text-center`}>Pos</span>
          <span className="flex-1 min-w-0">Driver</span>
          {displayOrder.map((colId: RivalColumnId) => {
            const col = headerConfig[colId] as { enabled: boolean };
            if (!col.enabled) return null;
            return (
              <span key={colId} className={`${cellW} text-right shrink-0`}>
                {RIVAL_COLUMN_META[colId].header}
              </span>
            );
          })}
        </div>
        <RivalsRow
          rival={mockAhead}
          config={headerConfig}
          displayOrder={displayOrder}
          playerCarIdx={undefined}
        />
        <div className="mx-2 border-t border-slate-600/50" />
        <RivalsRow
          rival={mockBehind}
          config={headerConfig}
          displayOrder={displayOrder}
          playerCarIdx={undefined}
        />
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Sector deltas story
// ---------------------------------------------------------------------------

const PLAYER_CAR_IDX = 0;
const AHEAD_CAR_IDX = 5;
const BEHIND_CAR_IDX = 7;

const sectorConfig = {
  ...defaultConfig,
  bestTimeDiff: { enabled: true },
  showHeader: { enabled: true },
  sectors: { enabled: true },
};

const SectorDataDecorator = (Story: React.ComponentType) => {
  useEffect(() => {
    useSectorTimingStore.setState({
      sectors: [
        { SectorNum: 0, SectorStartPct: 0 },
        { SectorNum: 1, SectorStartPct: 0.33 },
        { SectorNum: 2, SectorStartPct: 0.66 },
      ],
    });

    // Player: completed all 3 sectors on lap 5; lap 4 reference data for stale display
    const playerMap = new Map([
      [4, [29.501, 31.388, 29.012]],
      [5, [29.412, 31.204, 28.867]],
    ]);
    // Rival ahead: S1 faster, S2 slower — S3 still pending, stale italic from lap 4
    const aheadMap = new Map([
      [4, [29.198, 31.720, 28.544]],
      [5, [29.121, 31.643, null]],
    ]);
    // Rival behind: completed S1 — S2 & S3 pending, stale italic from lap 4
    const behindMap = new Map([
      [4, [29.655, 31.102, 29.334]],
      [5, [29.782, null, null]],
    ]);

    useRivalSectorStore.setState({
      cars: {
        [PLAYER_CAR_IDX]: {
          currentLap: 5,
          currentSectorIdx: 2,
          sectorEntryTime: 0,
          lastLapDistPct: 0.82,
          lastSessionTime: 0,
          sectorTimesByLap: playerMap,
        },
        [AHEAD_CAR_IDX]: {
          currentLap: 5,
          currentSectorIdx: 1,
          sectorEntryTime: 0,
          lastLapDistPct: 0.91,
          lastSessionTime: 0,
          sectorTimesByLap: aheadMap,
        },
        [BEHIND_CAR_IDX]: {
          currentLap: 5,
          currentSectorIdx: 0,
          sectorEntryTime: 0,
          lastLapDistPct: 0.22,
          lastSessionTime: 0,
          sectorTimesByLap: behindMap,
        },
      },
    });

    return () => {
      useSectorTimingStore.getState().reset();
      useRivalSectorStore.getState().reset();
    };
  }, []);

  return <Story />;
};

const sectorDeltaOnlyConfig = {
  ...defaultConfig,
  gap: { enabled: false },
  lastTime: { enabled: false },
  lastTimeDiff: { enabled: true },
  bestTime: { enabled: false },
  bestTimeDiff: { enabled: false },
  showHeader: { enabled: true },
  sectors: { enabled: true },
};

const deltaOnlyDisplayOrder: RivalColumnId[] = ['lastTimeDiff'];

export const WithSectorsDeltaOnly: Story = {
  decorators: [SectorDataDecorator],
  render: () => {
    const { rowGap, rowPx, cellW, posW, headerFontSize } = getCompactSizes(useGeneralSettings()?.compactMode);
    return (
      <div className="bg-slate-800/80 rounded-md overflow-hidden flex flex-col justify-center w-[300px]">
        <div className={`flex items-center ${rowGap} ${rowPx} py-0.5 ${headerFontSize} text-slate-400 tracking-wider border-b border-slate-600/50`}>
          <span className={`${posW} shrink-0 text-center`}>Pos</span>
          <span className="flex-1 min-w-0">Driver</span>
          <span className={`${cellW} text-right shrink-0`}>Delta</span>
        </div>
        <RivalsRow
          rival={{ ...mockAhead, carIdx: AHEAD_CAR_IDX }}
          config={sectorDeltaOnlyConfig}
          displayOrder={deltaOnlyDisplayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
        <div className="mx-2 border-t border-slate-600/50" />
        <RivalsRow
          rival={{ ...mockBehind, carIdx: BEHIND_CAR_IDX }}
          config={sectorDeltaOnlyConfig}
          displayOrder={deltaOnlyDisplayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
      </div>
    );
  },
};

const sectorNoHeaderConfig = {
  ...sectorConfig,
  showHeader: { enabled: false },
};

export const WithSectorsNoHeader: Story = {
  decorators: [SectorDataDecorator],
  render: () => {
    const displayOrder = RIVAL_COLUMN_IDS;
    return (
      <div className="bg-slate-800/80 rounded-md overflow-hidden flex flex-col justify-center w-[480px]">
        <RivalsRow
          rival={{ ...mockAhead, carIdx: AHEAD_CAR_IDX }}
          config={sectorNoHeaderConfig}
          displayOrder={displayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
        <div className="mx-2 border-t border-slate-600/50" />
        <RivalsRow
          rival={{ ...mockBehind, carIdx: BEHIND_CAR_IDX }}
          config={sectorNoHeaderConfig}
          displayOrder={displayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
      </div>
    );
  },
};

export const WithSectors: Story = {
  decorators: [SectorDataDecorator],
  render: () => {
    const displayOrder = RIVAL_COLUMN_IDS;
    const { rowGap, rowPx, cellW, posW, headerFontSize } = getCompactSizes(useGeneralSettings()?.compactMode);
    return (
      <div className="bg-slate-800/80 rounded-md overflow-hidden flex flex-col justify-center w-[480px]">
        <div className={`flex items-center ${rowGap} ${rowPx} py-0.5 ${headerFontSize} text-slate-400 tracking-wider border-b border-slate-600/50`}>
          <span className={`${posW} shrink-0 text-center`}>Pos</span>
          <span className="flex-1 min-w-0">Driver</span>
          {displayOrder.map((colId: RivalColumnId) => {
            const col = sectorConfig[colId] as { enabled: boolean };
            if (!col.enabled) return null;
            return (
              <span key={colId} className={`${cellW} text-right shrink-0`}>
                {RIVAL_COLUMN_META[colId].header}
              </span>
            );
          })}
        </div>
        <RivalsRow
          rival={{ ...mockAhead, carIdx: AHEAD_CAR_IDX }}
          config={sectorConfig}
          displayOrder={displayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
        <div className="mx-2 border-t border-slate-600/50" />
        <RivalsRow
          rival={{ ...mockBehind, carIdx: BEHIND_CAR_IDX }}
          config={sectorConfig}
          displayOrder={displayOrder}
          playerCarIdx={PLAYER_CAR_IDX}
        />
      </div>
    );
  },
};
