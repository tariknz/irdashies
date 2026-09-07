import type { Meta, StoryObj } from '@storybook/react-vite';
import { LapTimeLogDisplay } from './LapTimeLog';
import type { LapTimeLogConfig } from '@irdashies/types';
import { TelemetryDecorator } from '@irdashies/storybook';

interface LapEntry {
  lap: number;
  time: number;
  delta: number;
}

const meta: Meta<typeof LapTimeLogDisplay> = {
  title: 'widgets/LapTimeLog',
  component: LapTimeLogDisplay,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    TelemetryDecorator(),
    (Story) => (
      <div style={{ width: '250px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LapTimeLogDisplay>;

// --- Mocks ---
const mockConfig = (
  overrides: Partial<LapTimeLogConfig> = {}
): LapTimeLogConfig => {
  const baseConfig: LapTimeLogConfig = {
    background: { opacity: 80 },
    foreground: { opacity: 70 },
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: true,
    showPredictedLap: true,
    showLastLap: true,
    showBestLap: true,
    showAllTimeLap: false,
    delta: {
      enabled: true,
      method: 'bestlap',
    },
    history: {
      enabled: true,
      count: 5,
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    showOnlyWhenOnTrack: true,
  };

  return {
    ...baseConfig,
    ...overrides,
    // Deep merge for nested objects
    delta: { ...baseConfig.delta, ...overrides.delta },
    history: { ...baseConfig.history, ...overrides.history },
  };
};

const baseHistory: LapEntry[] = [
  { lap: 10, time: 92.1, delta: 0.6 },
  { lap: 9, time: 91.5, delta: 0.0 },
  { lap: 8, time: 91.8, delta: 0.3 },
  { lap: 7, time: 92.5, delta: 1.0 },
  { lap: 6, time: 91.9, delta: 0.4 },
];

const baseArgs = {
  current: 88.123,
  lastlap: 92.1,
  bestlap: 91.5,
  alltimelap: 91.3,
  reference: 91.5,
  delta: 0.2,
  overall: 91.0,
  history: baseHistory,
};

// --- Stories ---

export const Default: Story = {
  name: 'Default View',
  args: {
    ...baseArgs,
    settings: mockConfig(),
  },
};

export const NewPersonalBest: Story = {
  name: 'Flash: New Personal Best',
  args: {
    ...baseArgs,
    current: 4.5, // within 5 seconds
    lastlap: 91.2,
    bestlap: 91.2,
    alltimelap: 91.2, // new personal best
    settings: mockConfig({
      showAllTimeLap: true,
    }),
  },
};

export const NewSessionBest: Story = {
  name: 'Flash: New Session Best',
  args: {
    ...baseArgs,
    current: 3.2, // within 5 seconds
    lastlap: 90.9,
    bestlap: 90.9, // new session best
    overall: 90.2,
    settings: mockConfig(),
  },
};

export const NewOverallBest: Story = {
  name: 'Flash: New Overall Best',
  args: {
    ...baseArgs,
    current: 3.2, // within 5 seconds
    lastlap: 90.9, // new overall best
    bestlap: 90.9,
    overall: 90.9,
    settings: mockConfig(),
  },
};

export const CurrentLapOnly: Story = {
  name: 'Minimal',
  args: {
    ...baseArgs,
    settings: mockConfig({
      showPredictedLap: false,
      showLastLap: false,
      showBestLap: false,
      history: { enabled: false, count: 5 },
    }),
  },
};

export const CompactAndPredicted: Story = {
  name: 'Current and Predicted',
  args: {
    ...baseArgs,
    settings: mockConfig({
      delta: { enabled: true, method: 'lastlap' },
      showLastLap: false,
      showBestLap: false,
      history: { enabled: false, count: 5 },
    }),
  },
};

export const DirtyLap: Story = {
  name: 'Invalid Dirty Lap',
  args: {
    ...baseArgs,
    dirty: true,
    settings: mockConfig({
      delta: { enabled: true, method: 'lastlap' },
      showLastLap: false,
      showBestLap: false,
      history: { enabled: false, count: 5 },
    }),
  },
};

export const HistoryView: Story = {
  name: 'History Only View',
  args: {
    ...baseArgs,
    history: [
      ...baseHistory,
      { lap: 5, time: 92.2, delta: 0.7 },
      { lap: 4, time: 91.6, delta: 0.1 },
      { lap: 3, time: 93.1, delta: 1.6 },
      { lap: 2, time: 92.0, delta: 0.5 },
      { lap: 1, time: 91.7, delta: 0.2 },
    ],
    settings: mockConfig({
      showCurrentLap: false,
      showPredictedLap: false,
      showLastLap: false,
      showBestLap: false,
      history: { enabled: true, count: 10 },
    }),
  },
};

export const HistoryChart: Story = {
  name: 'History As Graph',
  args: {
    ...baseArgs,
    history: [
      ...baseHistory,
      { lap: 5, time: 92.2, delta: 0.7 },
      { lap: 4, time: 91.6, delta: 0.1 },
      { lap: 3, time: 93.1, delta: 1.6 },
      { lap: 2, time: 92.0, delta: 0.5 },
      { lap: 1, time: 91.7, delta: 0.2 },
    ],
    settings: mockConfig({
      history: { enabled: true, count: 10, style: 'chart' },
    }),
  },
};

/**
 * A practice stint with two stops, shaped like the one a user reported: the pit
 * laps are ~12s slower, which stretches the y-axis and pulls the average away
 * from the laps being compared.
 */
const pitStintHistory = [
  { lap: 12, time: 31.2, delta: 0.0 },
  { lap: 11, time: 31.3, delta: 0.1 },
  { lap: 10, time: 43.2, delta: 12.0, pitted: true },
  { lap: 9, time: 38.9, delta: 7.7, pitted: true },
  { lap: 8, time: 31.4, delta: 0.2 },
  { lap: 7, time: 31.2, delta: 0.0 },
  { lap: 6, time: 31.5, delta: 0.3 },
  { lap: 5, time: 43.6, delta: 12.4, pitted: true },
  { lap: 4, time: 31.6, delta: 0.4 },
  { lap: 3, time: 31.3, delta: 0.1 },
];

export const PittedLapsShown: Story = {
  name: 'Pit Laps Shown (default)',
  args: {
    ...baseArgs,
    history: pitStintHistory,
    settings: mockConfig({
      history: {
        enabled: true,
        count: 10,
        style: 'chart',
        hidePittedLaps: false,
      },
    }),
  },
};

export const PittedLapsHidden: Story = {
  name: 'Pit Laps Hidden',
  args: {
    ...baseArgs,
    history: pitStintHistory,
    settings: mockConfig({
      history: {
        enabled: true,
        count: 10,
        style: 'chart',
        hidePittedLaps: true,
      },
    }),
  },
};

export const NoDelta: Story = {
  name: 'Delta Disabled',
  args: {
    ...baseArgs,
    settings: mockConfig({
      delta: { enabled: false, method: 'bestlap' },
    }),
  },
};
