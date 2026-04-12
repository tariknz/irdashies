import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { SectorDelta } from './SectorDelta';
import { useSectorTimingStore } from '@irdashies/context';
import { TelemetryDecorator } from '@irdashies/storybook';

export default {
  component: SectorDelta,
  title: 'widgets/SectorDelta',
  decorators: [TelemetryDecorator()],
  args: {
    background: { opacity: 80 },
    showOnlyWhenOnTrack: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
} as Meta;

type Story = StoryObj<typeof SectorDelta>;

const MOCK_SECTORS = [
  { SectorNum: 0, SectorStartPct: 0 },
  { SectorNum: 1, SectorStartPct: 0.33 },
  { SectorNum: 2, SectorStartPct: 0.67 },
];

/** Seeds the SectorTimingStore with preset state for visual testing */
function SectorStoreSeeder({
  sectorColors,
  currentLapSectorTimes,
  sessionBestSectorTimes,
}: {
  sectorColors: ('purple' | 'green' | 'yellow' | 'red' | 'default')[];
  currentLapSectorTimes: (number | null)[];
  sessionBestSectorTimes: (number | null)[];
}) {
  const store = useSectorTimingStore;
  useEffect(() => {
    store.setState({
      sectors: MOCK_SECTORS,
      sectorColors,
      currentLapSectorTimes,
      sessionBestSectorTimes,
      allTimeBestSectorTimes: MOCK_SECTORS.map(() => null),
      lapStarted: true,
      currentSectorIdx: 2,
      sectorEntryTime: 0,
      lastLapDistPct: 0.8,
    });
  }, [store, sectorColors, currentLapSectorTimes, sessionBestSectorTimes]);
  return null;
}

export const AllCompleted: Story = {
  render: (args) => (
    <>
      <SectorStoreSeeder
        sectorColors={['purple', 'green', 'yellow']}
        currentLapSectorTimes={[28.123, 30.456, 32.789]}
        sessionBestSectorTimes={[28.5, 30.2, 32.1]}
      />
      <SectorDelta {...args} />
    </>
  ),
};

export const PartiallyCompleted: Story = {
  render: (args) => (
    <>
      <SectorStoreSeeder
        sectorColors={['green', 'red', 'default']}
        currentLapSectorTimes={[29.8, 31.5, null]}
        sessionBestSectorTimes={[30.1, 30.9, 32.0]}
      />
      <SectorDelta {...args} />
    </>
  ),
};

export const PersonalBests: Story = {
  render: (args) => (
    <>
      <SectorStoreSeeder
        sectorColors={['purple', 'purple', 'purple']}
        currentLapSectorTimes={[27.9, 29.8, 31.2]}
        sessionBestSectorTimes={[28.1, 30.2, 31.5]}
      />
      <SectorDelta {...args} />
    </>
  ),
};

export const NoData: Story = {
  render: (args) => (
    <>
      <SectorStoreSeeder
        sectorColors={['default', 'default', 'default']}
        currentLapSectorTimes={[null, null, null]}
        sessionBestSectorTimes={[null, null, null]}
      />
      <SectorDelta {...args} />
    </>
  ),
};

export const FirstSectorComplete: Story = {
  render: (args) => (
    <>
      <SectorStoreSeeder
        sectorColors={['green', 'default', 'default']}
        currentLapSectorTimes={[29.123, null, null]}
        sessionBestSectorTimes={[29.5, 31.0, 32.0]}
      />
      <SectorDelta {...args} />
    </>
  ),
};
