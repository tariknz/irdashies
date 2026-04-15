import {
  TrackLocation,
  ReferenceLapBridge,
  ReferenceLap,
} from '@irdashies/types';
import { fillReferenceGaps, precomputePCHIPTangents } from './pchipTangents';
import { create } from 'zustand';
import logger from '@irdashies/utils/logger';

// TODO: Maybe have it be a bit more dynamic for longer tracks like Nordschleife?
export const REFERENCE_INTERVAL = 0.0025;
const DECIMAL_PLACES = REFERENCE_INTERVAL.toString().split('.')[1]?.length || 0;
const TARGET_POINTS_FOR_VALID_LAP = 400;
const MAX_PCT_MISSING_DATA = 0.25;
const MIN_POINTS_FOR_VALID_LAP =
  TARGET_POINTS_FOR_VALID_LAP * (1 - MAX_PCT_MISSING_DATA);

export function normalizeKey(key: number): number {
  const normalizedKey = parseFloat(
    (key - (key % REFERENCE_INTERVAL)).toFixed(DECIMAL_PLACES)
  );
  return normalizedKey < 0 || normalizedKey >= 1 ? 0 : normalizedKey;
}

function isLapClean(trackSurface: number, isOnPitRoad: boolean): boolean {
  return trackSurface === TrackLocation.OnTrack && !isOnPitRoad;
}

interface ReferenceRegistryState {
  activeLaps: Map<number, ReferenceLap>;
  bestLaps: Map<number, ReferenceLap>;
  persistedLaps: Map<number, ReferenceLap>;
  seriesId: number | null;
  trackId: number | null;

  initialize: (
    bridge: ReferenceLapBridge,
    seriesId: number,
    trackId: number,
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
    activeLaps: new Map(),
    bestLaps: new Map(),
    persistedLaps: new Map(),
    seriesId: null,
    trackId: null,

    initialize: async (bridge, seriesId, trackId, classList) => {
      set({ seriesId, trackId });
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
      const { activeLaps, bestLaps, persistedLaps, seriesId, trackId } = get();
      const refLap = activeLaps.get(carIdx);
      const key = normalizeKey(trackPct);

      if (!refLap) {
        activeLaps.set(carIdx, {
          startTime: trackPct < 0.05 ? sessionTime : Number.MAX_SAFE_INTEGER,
          finishTime: -1,
          refPoints: new Map([
            [key, { trackPct, timeElapsedSinceStart: 0, tangent: undefined }],
          ]),
          lastTrackedPct: trackPct,
          isCleanLap: trackPct < 0.05,
        });
        return;
      }

      const isLapComplete = refLap.lastTrackedPct > 0.95 && trackPct < 0.05;

      if (isLapComplete) {
        refLap.finishTime = sessionTime;
        const currentLapTime = refLap.finishTime - refLap.startTime;

        if (
          refLap.refPoints.size >= MIN_POINTS_FOR_VALID_LAP &&
          currentLapTime > 0
        ) {
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
            if (refLap.refPoints.size < TARGET_POINTS_FOR_VALID_LAP) {
              fillReferenceGaps(refLap, TARGET_POINTS_FOR_VALID_LAP);
            }

            precomputePCHIPTangents(refLap);
            // Mutate in place
            bestLaps.set(carIdx, refLap);

            const isCurrentFasterThanPersisted =
              currentLapTime < (persistedLapTime || Infinity);

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

        activeLaps.set(carIdx, {
          startTime: sessionTime,
          finishTime: -1,
          refPoints: new Map([
            [key, { trackPct, timeElapsedSinceStart: 0, tangent: undefined }],
          ]),
          lastTrackedPct: trackPct,
          isCleanLap: isLapClean(trackSurface, isOnPitRoad),
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

      if (!refLap.refPoints.has(key) && refLap.isCleanLap) {
        refLap.refPoints.set(key, {
          timeElapsedSinceStart: sessionTime - refLap.startTime,
          trackPct,
          tangent: undefined,
        });
        refLap.lastTrackedPct = trackPct;
      }
    },

    getReferenceLap: (carIdx, classId, usePersistence) => {
      const { bestLaps, persistedLaps } = get();
      const bestLap = bestLaps.get(carIdx);

      if (usePersistence || !bestLap) {
        return (
          persistedLaps.get(classId) ?? {
            classId,
            startTime: -1,
            finishTime: -1,
            refPoints: new Map(),
            lastTrackedPct: -1,
            isCleanLap: false,
          }
        );
      }
      return bestLap;
    },

    completeSession: () => {
      set({
        activeLaps: new Map(),
        bestLaps: new Map(),
        persistedLaps: new Map(),
        seriesId: null,
        trackId: null,
      });
    },
  })
);
