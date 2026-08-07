import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { TelemetryDecorator } from '@irdashies/storybook';
import { useEffect } from 'react';
import { useLapGapStore } from '@irdashies/context';
import { LapGraphView } from './LapGraphView';

const LapGapLoader = () => {
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  useEffect(() => {
    const mockData: { carIdx: number; laps: [number, number][] }[] = [
      {
        carIdx: 0,
        laps: [
          [1, 0],
          [2, 0],
          [3, 0],
          [4, 0],
          [5, 0],
          [6, 0],
          [7, 0],
          [8, 0],
        ],
      },
      {
        carIdx: 1,
        laps: [
          [1, 3.2],
          [2, 3.8],
          [3, 3.5],
          [4, 4.1],
          [5, 5.0],
          [6, 4.8],
          [7, 5.3],
          [8, 6.1],
        ],
      },
      {
        carIdx: 2,
        laps: [
          [1, 8.0],
          [2, 9.2],
          [3, 11.1],
          [4, 12.3],
          [5, 14.0],
          [6, 15.5],
          [7, 17.2],
          [8, 19.8],
        ],
      },
      {
        carIdx: 3,
        laps: [
          [1, 1.5],
          [2, 1.2],
          [3, 2.0],
          [4, 1.8],
          [5, 2.3],
          [6, 2.1],
          [7, 3.0],
          [8, 2.8],
        ],
      },
    ];
    for (const { carIdx, laps } of mockData) {
      for (const [lap, gap] of laps) {
        recordLapGap(carIdx, lap, gap);
      }
    }
  }, [recordLapGap]);
  return null;
};

const LapGapDecorator: Decorator = (Story) => (
  <>
    <LapGapLoader />
    <Story />
  </>
);

// Player's default class in the mock session (2264) has 11 drivers - enough
// to exercise the 8-colour cap, the muted context lines and the "+N others"
// legend entry.
const ManyDriversLoader = () => {
  const recordLapGap = useLapGapStore((s) => s.recordLapGap);
  useEffect(() => {
    const carIdxs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const carIdx of carIdxs) {
      const spread = carIdx * 1.7;
      for (let lap = 1; lap <= 10; lap++) {
        recordLapGap(carIdx, lap, spread + lap * (0.3 + carIdx * 0.05));
      }
    }
  }, [recordLapGap]);
  return null;
};

const ManyDriversDecorator: Decorator = (Story) => (
  <>
    <ManyDriversLoader />
    <Story />
  </>
);

const meta: Meta<typeof LapGraphView> = {
  component: LapGraphView,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof LapGraphView>;

export const WithData: Story = {
  decorators: [TelemetryDecorator(), LapGapDecorator],
};

export const ManyDrivers: Story = {
  decorators: [TelemetryDecorator(), ManyDriversDecorator],
};

export const Empty: Story = {
  decorators: [TelemetryDecorator()],
};
