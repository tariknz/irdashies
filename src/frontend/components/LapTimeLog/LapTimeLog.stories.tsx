import type { Meta, StoryObj } from '@storybook/react-vite';
import { LapTimeLogDisplay } from './LapTimeLog';
import type { LapTimeLogConfig } from '@irdashies/types';

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
    lastlap: 91.4, // new best
    bestlap: 91.4,
    settings: mockConfig(),
  },
};

export const NewSessionBest: Story = {
  name: 'Flash: New Session Best',
  args: {
    ...baseArgs,
    current: 3.2, // within 5 seconds
    lastlap: 90.9, // new overall best
    bestlap: 91.2,
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

export const NoDelta: Story = {
  name: 'Delta Disabled',
  args: {
    ...baseArgs,
    settings: mockConfig({
      delta: { enabled: false, method: 'bestlap' },
    }),
  },
};
