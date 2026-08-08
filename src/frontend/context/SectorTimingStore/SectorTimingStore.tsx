import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { Sector, SectorTimingSnapshot } from '@irdashies/types';

export type SectorColor = 'purple' | 'green' | 'yellow' | 'red' | 'default';

export const DEFAULT_GREEN_THRESHOLD = 0.005;
export const DEFAULT_YELLOW_THRESHOLD = 0.01;

export const computeSectorColor = (
  time: number,
  sessionBest: number | null,
  greenThreshold = DEFAULT_GREEN_THRESHOLD,
  yellowThreshold = DEFAULT_YELLOW_THRESHOLD
): SectorColor => {
  if (sessionBest === null) return 'default';
  if (time <= sessionBest) return 'purple';
  const ratio = (time - sessionBest) / sessionBest;
  if (ratio <= greenThreshold) return 'green';
  if (ratio <= yellowThreshold) return 'yellow';
  return 'red';
};

interface SectorTimingState {
  sectors: Sector[];
  currentSectorIdx: number;
  sectorEntryTime: number;
  sectorEntryValid: boolean;
  currentLapSectorTimes: (number | null)[];
  previousLapSectorTimes: (number | null)[];
  sessionBestSectorTimes: (number | null)[];
  previousSessionBestSectorTimes: (number | null)[];
  currentLapSectorUnclean: boolean[];
  previousLapSectorUnclean: boolean[];
  sectorColors: SectorColor[];
  greenThreshold: number;
  yellowThreshold: number;
  trackIncidentSectors: boolean;
  applySnapshot: (snapshot: SectorTimingSnapshot) => void;
  setThresholds: (green: number, yellow: number) => void;
  setTrackIncidentSectors: (value: boolean) => void;
  reset: () => void;
}

const emptyState = () => ({
  sectors: [] as Sector[],
  currentSectorIdx: 0,
  sectorEntryTime: 0,
  sectorEntryValid: false,
  currentLapSectorTimes: [] as (number | null)[],
  previousLapSectorTimes: [] as (number | null)[],
  sessionBestSectorTimes: [] as (number | null)[],
  previousSessionBestSectorTimes: [] as (number | null)[],
  currentLapSectorUnclean: [] as boolean[],
  previousLapSectorUnclean: [] as boolean[],
  sectorColors: [] as SectorColor[],
});

const colorsFor = (
  current: readonly (number | null)[],
  previous: readonly (number | null)[],
  bests: readonly (number | null)[],
  green: number,
  yellow: number
): SectorColor[] =>
  previous.map((previousTime, index) => {
    const time = current[index] ?? previousTime;
    return time === null
      ? 'default'
      : computeSectorColor(time, bests[index] ?? null, green, yellow);
  });

export const useSectorTimingStore = create<SectorTimingState>((set, get) => ({
  ...emptyState(),
  greenThreshold: DEFAULT_GREEN_THRESHOLD,
  yellowThreshold: DEFAULT_YELLOW_THRESHOLD,
  trackIncidentSectors: true,

  applySnapshot: (snapshot) => {
    const state = get();
    const timing = state.trackIncidentSectors
      ? snapshot.inclusive
      : snapshot.clean;
    set({
      sectors: [...snapshot.sectors],
      currentSectorIdx: snapshot.currentSectorIdx,
      sectorEntryTime: snapshot.sectorEntryTime,
      sectorEntryValid: snapshot.sectorEntryValid,
      currentLapSectorTimes: [...timing.currentLapSectorTimes],
      previousLapSectorTimes: [...timing.previousLapSectorTimes],
      currentLapSectorUnclean: [...timing.currentLapSectorUnclean],
      previousLapSectorUnclean: [...timing.previousLapSectorUnclean],
      sessionBestSectorTimes: [...timing.sessionBestSectorTimes],
      previousSessionBestSectorTimes: [
        ...timing.previousSessionBestSectorTimes,
      ],
      sectorColors: colorsFor(
        timing.currentLapSectorTimes,
        timing.previousLapSectorTimes,
        timing.sessionBestSectorTimes,
        state.greenThreshold,
        state.yellowThreshold
      ),
    });
  },

  setThresholds: (greenThreshold, yellowThreshold) => {
    const state = get();
    if (
      state.greenThreshold === greenThreshold &&
      state.yellowThreshold === yellowThreshold
    ) {
      return;
    }
    set({
      greenThreshold,
      yellowThreshold,
      sectorColors: colorsFor(
        state.currentLapSectorTimes,
        state.previousLapSectorTimes,
        state.sessionBestSectorTimes,
        greenThreshold,
        yellowThreshold
      ),
    });
  },

  setTrackIncidentSectors: (trackIncidentSectors) => {
    if (get().trackIncidentSectors !== trackIncidentSectors) {
      set({ trackIncidentSectors });
    }
  },

  reset: () => set(emptyState()),
}));

export const useSectorColors = () =>
  useStore(useSectorTimingStore, (state) => state.sectorColors);

export const useSectorDeltas = () =>
  useStoreWithEqualityFn(
    useSectorTimingStore,
    (state) => ({
      sectors: state.sectors,
      sectorColors: state.sectorColors,
      currentLapSectorTimes: state.currentLapSectorTimes,
      previousLapSectorTimes: state.previousLapSectorTimes,
      currentLapSectorUnclean: state.currentLapSectorUnclean,
      previousLapSectorUnclean: state.previousLapSectorUnclean,
      sessionBestSectorTimes: state.sessionBestSectorTimes,
      previousSessionBestSectorTimes: state.previousSessionBestSectorTimes,
      currentSectorIdx: state.currentSectorIdx,
    }),
    shallow
  );
