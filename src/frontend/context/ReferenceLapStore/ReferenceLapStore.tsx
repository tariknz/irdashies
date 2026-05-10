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
  /** Incremented each time persisted laps finish loading so subscribers re-run. */
  persistedLapsVersion: number;
  /**
   * Class IDs for which a ghost lap was loaded from disk during initialize().
   * In-session laps promoted to persistedLaps are NOT included here. Used by
   * useReferenceLapSectorTimes to show the ghost icon only when a saved file
   * is present, not for newly-completed in-session laps.
   */
  fileLoadedClassIds: Set<number>;

  /**
   * Bootstraps the store at the start of a session by loading previously saved
   * reference laps from disk for the specific track and car classes.
   */
  initialize: (
    bridge: ReferenceLapBridge,
    seriesId: number,
    trackId: number,
    trackLength: number,
    classList: number[]
  ) => Promise<void>;

  /**
   * The primary high-frequency hook for telemetry ingestion. Records
   * time-stamped positions along the track and promotes completed laps to
   * "best" or "persisted" if they are clean and fast.
   */
  collectLapData: (
    bridge: ReferenceLapBridge,
    carIdx: number,
    classId: number,
    trackPct: number,
    sessionTime: number,
    trackSurface: number,
    isOnPitRoad: boolean
  ) => void;

  /**
   * Retrieves the best available lap for comparison. Prefers the car's own
   * in-session best, falling back to the class-wide persisted best.
   * @param carIdx The car index to get the best lap for
   * @param classId The class ID of the car
   * @param usePersistence If true, strictly returns the persisted class-best.
   */
  getReferenceLap: (
    carIdx: number,
    classId: number,
    usePersistence: boolean
  ) => ReferenceLap;

  /**
   * Resets the store state, clearing all maps and identifiers.
   */
  completeSession: () => void;
}

/**
 * Manages the collection, retrieval, and persistence of reference laps (ghost
 * laps) during an iRacing session.
 */
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
    persistedLapsVersion: 0,
    fileLoadedClassIds: new Set<number>(),

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

      // Mutate persistedLaps in place to avoid triggering Zustand subscriptions
      // on each lap, then fire a single notification so hooks re-run once all
      // laps are ready. Build a new Set for fileLoadedClassIds so selectors
      // that depend on it re-run after initialization completes.
      const newFileLoadedClassIds = new Set<number>();
      results.forEach(({ classId, lap }) => {
        if (lap) {
          persistedLaps.set(classId, lap);
          newFileLoadedClassIds.add(classId);
        }
      });
      set((s) => ({
        persistedLapsVersion: s.persistedLapsVersion + 1,
        fileLoadedClassIds: newFileLoadedClassIds,
      }));
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
        fileLoadedClassIds: new Set<number>(),
      });
    },
  })
);
