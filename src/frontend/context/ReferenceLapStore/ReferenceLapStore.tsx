import {
  TrackLocation,
  ReferenceLapBridge,
  ReferenceLap,
} from '@irdashies/types';
import { precomputePCHIPTangents } from './pchipTangents';
import { create } from 'zustand';
import logger from '@irdashies/utils/logger';

function isLapClean(trackSurface: number, isOnPitRoad: boolean): boolean {
  return trackSurface === TrackLocation.OnTrack && !isOnPitRoad;
}

const TARGET_SPACING_METERS = 10;

/**
 * Calculates the bucket index for a given track percentage. */
export function getBucketIndex(trackPct: number, pointsCount: number): number {
  const index = Math.floor(trackPct * pointsCount);
  return Math.min(Math.max(index, 0), pointsCount - 1);
}

interface ReferenceRegistryState {
  activeLaps: Map<number, ReferenceLap>;
  bestLaps: Map<number, ReferenceLap>;
  persistedLaps: Map<number, ReferenceLap>;
  seriesId: number | null;
  trackId: number | null;
  trackLength: number | null;
  interval: number;
  pointsCount: number;

  initialize: (
    bridge: ReferenceLapBridge,
    seriesId: number,
    trackId: number,
    trackLength: number,
    classList: number[]
  ) => Promise<void>;
  collectLapData: (
    bridge: ReferenceLapBridge,
    carIdx: number,
    classId: number,
    trackPct: number,
    sessionTime: number,
    trackSurface: number,
    isOnPitRoad: boolean
  ) => void;
  getReferenceLap: (
    carIdx: number,
    classId: number,
    usePersistence: boolean
  ) => ReferenceLap;
  completeSession: () => void;
}

export const useReferenceLapStore = create<ReferenceRegistryState>(
  (set, get) => ({
    activeLaps: new Map<number, ReferenceLap>(),
    bestLaps: new Map<number, ReferenceLap>(),
    persistedLaps: new Map<number, ReferenceLap>(),
    seriesId: null,
    trackId: null,
    trackLength: null,
    interval: 0,
    pointsCount: 0,

    initialize: async (bridge, seriesId, trackId, trackLength, classList) => {
      const pointsCount = Math.ceil(trackLength / TARGET_SPACING_METERS);
      const interval = parseFloat((1 / pointsCount).toFixed(6));

      set({ seriesId, trackId, trackLength, pointsCount, interval });
      const { persistedLaps } = get();

      const results = await Promise.all(
        classList.map(async (classId) => {
          try {
            const lap = (await bridge.getReferenceLap(
              seriesId,
              trackId,
              classId
            )) as ReferenceLap;

            return { classId, lap };
          } catch (error) {
            logger.error(
              `[RefLapStore] Failed to load reference lap for class ${classId}:`,
              error
            );
            return { classId, lap: null };
          }
        })
      );

      // Mutate in place to avoid triggering Zustand subscriptions
      results.forEach(({ classId, lap }) => {
        if (lap) persistedLaps.set(classId, lap);
      });
    },

    collectLapData: (
      bridge,
      carIdx,
      classId,
      trackPct,
      sessionTime,
      trackSurface,
      isOnPitRoad
    ) => {
      // Access maps directly. Mutating them in place will not trigger React re-renders.
      const {
        activeLaps,
        bestLaps,
        persistedLaps,
        seriesId,
        trackId,
        pointsCount,
        interval,
      } = get();
      const refLap = activeLaps.get(carIdx);
      const key = getBucketIndex(trackPct, pointsCount);

      if (!refLap) {
        const isTrackedFromStart = trackPct <= interval;
        activeLaps.set(carIdx, {
          startTime: isTrackedFromStart ? sessionTime : Number.MAX_SAFE_INTEGER,
          finishTime: -1,
          times: new Float32Array(pointsCount),
          pointPos: new Float32Array(pointsCount).fill(-1),
          tangents: new Float32Array(pointsCount),
          interval,
          pointsCount,
          lastTrackedPct: trackPct,
          isCleanLap:
            isTrackedFromStart && isLapClean(trackSurface, isOnPitRoad),
        });
        return;
      }

      const isLapComplete = refLap.lastTrackedPct > 0.95 && trackPct < 0.05;

      if (isLapComplete) {
        refLap.finishTime = sessionTime;
        const currentLapTime = refLap.finishTime - refLap.startTime;

        if (currentLapTime > 0) {
          const persistedLap = persistedLaps.get(classId);
          const persistedLapTime = persistedLap
            ? persistedLap.finishTime - persistedLap.startTime
            : null;

          const VALID_THRESHOLD = 0.85;

          // Validates the pace: passes if no persisted lap exists, OR if the new lap meets the threshold
          const isPaceValid =
            !persistedLapTime ||
            persistedLapTime / currentLapTime >= VALID_THRESHOLD;

          // Updates if there is NO session best, OR if the new lap is faster AND the pace is valid
          const bestLap = bestLaps.get(carIdx);
          const bestLapTime = bestLap
            ? bestLap.finishTime - bestLap.startTime
            : null;

          const isNewBestLap =
            !bestLapTime || (currentLapTime < bestLapTime && isPaceValid);

          if (isNewBestLap && refLap.isCleanLap) {
            precomputePCHIPTangents(refLap);

            // Mutate in place
            bestLaps.set(carIdx, refLap);

            const isCurrentFasterThanPersisted =
              currentLapTime < (persistedLapTime || Number.MAX_SAFE_INTEGER);

            if (isCurrentFasterThanPersisted) {
              // Mutate in place
              persistedLaps.set(classId, refLap);

              if (seriesId !== null && trackId !== null) {
                bridge
                  .saveReferenceLap(seriesId, trackId, classId, refLap)
                  .catch((err: Error) => {
                    logger.error(
                      `[RefLapStore] Failed to save class ${classId}`,
                      err
                    );
                  });
              }
            }
          }
        }

        const isTrackedFromStart = trackPct <= interval;
        activeLaps.set(carIdx, {
          startTime: sessionTime,
          finishTime: -1,
          times: new Float32Array(pointsCount),
          pointPos: new Float32Array(pointsCount).fill(-1),
          tangents: new Float32Array(pointsCount),
          interval,
          pointsCount,
          lastTrackedPct: trackPct,
          isCleanLap:
            isTrackedFromStart && isLapClean(trackSurface, isOnPitRoad),
        });

        return;
      }

      if (
        refLap.isCleanLap &&
        // trackSurface !== TRACK_SURFACES.OnTrack &&
        isOnPitRoad
      ) {
        refLap.isCleanLap = false;
      }

      if (refLap.pointPos[key] === -1 && refLap.isCleanLap) {
        refLap.times[key] = sessionTime - refLap.startTime;
        refLap.pointPos[key] = trackPct;
      }

      refLap.lastTrackedPct = trackPct;
    },

    getReferenceLap: (carIdx, classId, usePersistence) => {
      const { bestLaps, persistedLaps } = get();
      const bestLap = bestLaps.get(carIdx);

      if (usePersistence || !bestLap) {
        return (
          persistedLaps.get(classId) ?? {
            startTime: -1,
            finishTime: -1,
            times: new Float32Array(),
            pointPos: new Float32Array(),
            tangents: new Float32Array(),
            interval: -1,
            pointsCount: 0,
            lastTrackedPct: -1,
            isCleanLap: false,
          }
        );
      }
      return bestLap;
    },

    completeSession: () => {
      set({
        activeLaps: new Map<number, ReferenceLap>(),
        bestLaps: new Map<number, ReferenceLap>(),
        persistedLaps: new Map<number, ReferenceLap>(),
        seriesId: null,
        trackId: null,
        trackLength: null,
        interval: 0,
        pointsCount: 0,
      });
    },
  })
);
