import { Meta, StoryObj } from '@storybook/react-vite';
import { RivalsRow } from './RivalsRow';
import { TelemetryDecorator } from '../../../../.storybook/telemetryDecorator';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { RivalEntry } from './hooks/useRivalsData';
import { RIVAL_COLUMN_IDS, RIVAL_COLUMN_META, RivalColumnId } from './RivalsRow';

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
    return (
      <div className="bg-slate-800/80 rounded-md overflow-hidden flex flex-col justify-center w-[480px]">
        <div className="flex items-center gap-3 px-2 py-0.5 text-xs text-slate-400 uppercase tracking-wider border-b border-slate-600/50">
          <span className="w-8 shrink-0 text-center">Pos</span>
          <span className="flex-1 min-w-0">Driver</span>
          {displayOrder.map((colId: RivalColumnId) => {
            const col = headerConfig[colId] as { enabled: boolean };
            if (!col.enabled) return null;
            return (
              <span key={colId} className="w-16 text-right shrink-0">
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
