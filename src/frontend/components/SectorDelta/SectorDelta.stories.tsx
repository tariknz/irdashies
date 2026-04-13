import { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { SectorDelta } from './SectorDelta';
import {
  useSectorTimingStore,
  useReferenceLapStore,
  useSessionStore,
  REFERENCE_INTERVAL,
} from '@irdashies/context';
import { TelemetryDecorator } from '@irdashies/storybook';
import type { ReferenceLap, ReferencePoint } from '@irdashies/types';

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

const PLAYER_CAR_IDX = 1;
const PLAYER_CLASS_ID = 42;

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

/**
 * Builds a mock ghost lap with per-sector time distribution.
 *
 * Each sector is modelled as piecewise-linear: within a sector the elapsed
 * time increases proportionally to the distance covered in that sector, and
 * the PCHIP tangent at every point is set to that sector's slope
 * (time / width). This makes `interpolateAtPoint` return exact sector-boundary
 * times with no overshoot, which is ideal for visual story demos.
 *
 * @param sectorBoundaries - SectorStartPct values in ascending order (e.g. [0, 0.33, 0.67])
 * @param sectorTimes - Ghost lap time (seconds) for each sector
 */
function buildMockGhostLap(
  sectorBoundaries: number[],
  sectorTimes: number[]
): ReferenceLap {
  const DECIMAL_PLACES =
    REFERENCE_INTERVAL.toString().split('.')[1]?.length ?? 4;

  const lapTime = sectorTimes.reduce((a, b) => a + b, 0);

  // Cumulative elapsed time at the start of each sector
  const sectorStartTimes: number[] = sectorTimes.map((_, i) =>
    sectorTimes.slice(0, i).reduce((a, b) => a + b, 0)
  );

  // Width (in trackPct) of each sector
  const sectorWidths: number[] = sectorBoundaries.map((startPct, i) => {
    const nextPct =
      i < sectorBoundaries.length - 1 ? sectorBoundaries[i + 1] : 1;
    return nextPct - startPct;
  });

  const refPoints = new Map<number, ReferencePoint>();

  for (let pct = 0; pct < 1; pct += REFERENCE_INTERVAL) {
    const key = parseFloat(pct.toFixed(DECIMAL_PLACES));

    // Determine which sector this point belongs to
    let sectorIdx = 0;
    for (let s = sectorBoundaries.length - 1; s >= 0; s--) {
      if (pct >= sectorBoundaries[s]) {
        sectorIdx = s;
        break;
      }
    }

    const offset = pct - sectorBoundaries[sectorIdx];
    const width = sectorWidths[sectorIdx];
    const timeElapsedSinceStart =
      sectorStartTimes[sectorIdx] + (offset / width) * sectorTimes[sectorIdx];

    // Tangent = slope for this sector (constant within sector = exact PCHIP)
    const tangent = sectorTimes[sectorIdx] / width;

    refPoints.set(key, { trackPct: key, timeElapsedSinceStart, tangent });
  }

  return {
    classId: PLAYER_CLASS_ID,
    startTime: 0,
    finishTime: lapTime,
    lastTrackedPct: 0.9975,
    isCleanLap: true,
    refPoints,
  };
}

// Ghost sector times used across demo stories:
//   S1 = 28.5 s (short/fast sector)
//   S2 = 31.0 s (long/slow sector)
//   S3 = 29.5 s (medium sector)
// Total ghost lap: 89.0 s
const GHOST_SECTOR_TIMES = [28.5, 31.0, 29.5];
const GHOST_BOUNDARIES = MOCK_SECTORS.map((s) => s.SectorStartPct);

/**
 * Seeds both the ReferenceLapStore (ghost lap) and the SessionStore (player
 * identity) so that useReferenceLapSectorTimes can resolve ghost sector times.
 *
 * Ghost sector times: S1=28.5 s | S2=31.0 s | S3=29.5 s (total 89.0 s)
 */
function GhostLapSeeder() {
  useEffect(() => {
    // Give the player an identity so the hook can find their class ID
    useSessionStore.setState({
      session: {
        DriverInfo: {
          DriverCarIdx: PLAYER_CAR_IDX,
          Drivers: [
            {
              CarIdx: PLAYER_CAR_IDX,
              CarClassID: PLAYER_CLASS_ID,
            },
          ],
        },
      } as never,
    });

    const ghostLap = buildMockGhostLap(GHOST_BOUNDARIES, GHOST_SECTOR_TIMES);

    useReferenceLapStore.setState({
      seriesId: 1,
      trackId: 1,
      persistedLaps: new Map([[PLAYER_CLASS_ID, ghostLap]]),
    });
  }, []);
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

/**
 * Ghost lap loaded — two completed sectors, third in progress.
 * Ghost: S1=28.5 s | S2=31.0 s | S3=29.5 s
 * Player S1=28.3 → -0.20 (green, faster) | S2=31.3 → +0.30 (yellow, slightly behind)
 */
export const WithGhostLap: Story = {
  render: (args) => (
    <>
      <GhostLapSeeder />
      <SectorStoreSeeder
        sectorColors={['green', 'yellow', 'default']}
        currentLapSectorTimes={[28.3, 31.3, null]}
        sessionBestSectorTimes={[28.8, 31.5, 30.0]}
      />
      <SectorDelta {...args} />
    </>
  ),
};

/**
 * Ghost lap loaded — all sectors completed, showing all three ghost delta colors.
 * Ghost: S1=28.5 s | S2=31.0 s | S3=29.5 s
 * Player S1=28.8 → +0.30 (yellow) | S2=30.4 → -0.60 (green) | S3=30.2 → +0.70 (red)
 */
export const WithGhostLapAllCompleted: Story = {
  render: (args) => (
    <>
      <GhostLapSeeder />
      <SectorStoreSeeder
        sectorColors={['green', 'purple', 'yellow']}
        currentLapSectorTimes={[28.8, 30.4, 30.2]}
        sessionBestSectorTimes={[29.0, 31.0, 30.0]}
      />
      <SectorDelta {...args} />
    </>
  ),
};
