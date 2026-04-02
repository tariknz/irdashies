import { useMemo, useRef } from 'react';
import {
  useReferenceLapStore,
  useSessionDrivers,
  useTelemetryValue,
  useTelemetryValuesRounded,
} from '@irdashies/context';
import type { Driver } from '@irdashies/types';
import {
  getActiveSectorIndex,
  getCrossedSectorIndices,
  getReferenceLapSectorTimes,
  resolveSectorStatusColor,
  type SectorStatusColor,
} from '../trackDrawingUtils';

interface UseSectorStatusArgs {
  enabled: boolean;
  sectorBoundaries: number[] | null;
  playerProgress?: number;
  playerCarIdx?: number;
  playerClassId?: number;
}

interface SectorStatusResult {
  sectorStatuses: SectorStatusColor[] | null;
  activeSectorIndex: number | null;
}

interface DriverSectorTracker {
  currentSectorIndex: number;
  currentSectorStartTime: number | null;
  lastProgress: number;
}

const createWhiteStatuses = (
  sectorBoundaries: number[] | null
): SectorStatusColor[] | null =>
  sectorBoundaries
    ? Array.from({ length: sectorBoundaries.length - 1 }, () => 'white')
    : null;

export const useSectorStatus = ({
  enabled,
  sectorBoundaries,
  playerProgress,
  playerCarIdx,
  playerClassId,
}: UseSectorStatusArgs): SectorStatusResult => {
  const sessionDrivers = useSessionDrivers();
  const drivers = useMemo(() => sessionDrivers ?? [], [sessionDrivers]);
  const carIdxLapDistPct = useTelemetryValuesRounded('CarIdxLapDistPct', 4);
  const sessionTime = useTelemetryValue<number>('SessionTime');
  const lapCurrentLapTime = useTelemetryValue<number>('LapCurrentLapTime');

  const trackersRef = useRef<Map<number, DriverSectorTracker>>(new Map());
  const playerBestSectorTimesRef = useRef<(number | null)[]>([]);
  const benchmarkSectorTimesRef = useRef<(number | null)[]>([]);
  const sectorStatusesRef = useRef<SectorStatusColor[] | null>(null);

  return useMemo(() => {
    if (
      !enabled ||
      !sectorBoundaries ||
      playerCarIdx === undefined ||
      playerClassId === undefined
    ) {
      trackersRef.current = new Map();
      playerBestSectorTimesRef.current = [];
      benchmarkSectorTimesRef.current = [];
      sectorStatusesRef.current = null;
      return { sectorStatuses: null, activeSectorIndex: null };
    }

    const sectorCount = sectorBoundaries.length - 1;
    const whiteStatuses = createWhiteStatuses(sectorBoundaries);
    const referenceLap = useReferenceLapStore
      .getState()
      .getReferenceLap(playerCarIdx, playerClassId, true);
    const referenceSectorTimes = getReferenceLapSectorTimes(
      referenceLap,
      sectorBoundaries
    );

    if (
      !sectorStatusesRef.current ||
      sectorStatusesRef.current.length !== sectorCount
    ) {
      sectorStatusesRef.current = whiteStatuses;
      playerBestSectorTimesRef.current = Array.from(
        { length: sectorCount },
        () => null
      );
      benchmarkSectorTimesRef.current = Array.from(
        { length: sectorCount },
        () => null
      );
      trackersRef.current = new Map();
    }

    const sameClassDrivers = drivers.filter(
      (driver: Driver) => driver.CarClassID === playerClassId
    );

    sameClassDrivers.forEach((driver) => {
      const progress = carIdxLapDistPct?.[driver.CarIdx];
      if (progress === undefined || progress < 0 || sessionTime === undefined) {
        return;
      }

      const activeSectorIndex = getActiveSectorIndex(
        progress,
        sectorBoundaries
      );
      const tracker = trackersRef.current.get(driver.CarIdx);

      if (!tracker) {
        trackersRef.current.set(driver.CarIdx, {
          currentSectorIndex: activeSectorIndex,
          currentSectorStartTime: null,
          lastProgress: progress,
        });
        return;
      }

      const crossedSectorIndices = getCrossedSectorIndices(
        tracker.lastProgress,
        progress,
        sectorBoundaries
      );

      if (crossedSectorIndices.length === 0) {
        tracker.lastProgress = progress;
        tracker.currentSectorIndex = activeSectorIndex;
        return;
      }

      crossedSectorIndices.forEach((crossedSectorIndex) => {
        const sectorStartTime = tracker.currentSectorStartTime;
        const sectorTime =
          sectorStartTime === null
            ? driver.CarIdx === playerCarIdx &&
              crossedSectorIndex === 0 &&
              tracker.currentSectorIndex === 0 &&
              lapCurrentLapTime !== undefined &&
              lapCurrentLapTime > 0
              ? lapCurrentLapTime
              : null
            : sessionTime - sectorStartTime;
        const wrappedToNewLap = crossedSectorIndex === sectorCount - 1;

        if (
          sectorTime !== null &&
          sectorTime > 0 &&
          Number.isFinite(sectorTime) &&
          sectorTime < 600
        ) {
          if (driver.CarIdx === playerCarIdx) {
            const previousPersonalBest =
              playerBestSectorTimesRef.current[crossedSectorIndex] ?? null;
            const benchmarkTime =
              benchmarkSectorTimesRef.current[crossedSectorIndex] ??
              referenceSectorTimes[crossedSectorIndex] ??
              null;
            const purpleEligible = benchmarkTime !== null;

            sectorStatusesRef.current = [...(sectorStatusesRef.current ?? [])];
            sectorStatusesRef.current[crossedSectorIndex] =
              resolveSectorStatusColor({
                sectorTime,
                previousPersonalBest,
                benchmarkTime,
                purpleEligible,
              });

            playerBestSectorTimesRef.current[crossedSectorIndex] =
              previousPersonalBest === null
                ? sectorTime
                : Math.min(previousPersonalBest, sectorTime);
          } else {
            const currentBenchmark =
              benchmarkSectorTimesRef.current[crossedSectorIndex];
            benchmarkSectorTimesRef.current[crossedSectorIndex] =
              currentBenchmark === null
                ? sectorTime
                : Math.min(currentBenchmark, sectorTime);
          }
        }

        tracker.currentSectorIndex = (crossedSectorIndex + 1) % sectorCount;
        tracker.currentSectorStartTime = sessionTime;

        if (wrappedToNewLap && driver.CarIdx === playerCarIdx) {
          sectorStatusesRef.current = createWhiteStatuses(sectorBoundaries);
        }
      });

      tracker.lastProgress = progress;
    });

    const resolvedActiveSectorIndex =
      playerProgress === undefined
        ? null
        : getActiveSectorIndex(playerProgress, sectorBoundaries);

    return {
      sectorStatuses: sectorStatusesRef.current ?? whiteStatuses,
      activeSectorIndex: resolvedActiveSectorIndex,
    };
  }, [
    carIdxLapDistPct,
    drivers,
    enabled,
    playerCarIdx,
    playerClassId,
    playerProgress,
    sectorBoundaries,
    sessionTime,
    lapCurrentLapTime,
  ]);
};
