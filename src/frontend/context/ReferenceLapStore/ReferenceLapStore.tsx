import { TRACK_SURFACES } from '../../components/Standings/relativeGapHelpers';
import { precomputePCHIPTangents } from '../../components/Standings/splineInterpolation';
import { ReferenceLapBridge } from '../../../types/referenceLaps';
import { create } from 'zustand';

export const REFERENCE_INTERVAL = 0.0025;
const DECIMAL_PLACES = REFERENCE_INTERVAL.toString().split('.')[1]?.length || 0;

export interface ReferencePoint {
  trackPct: number;
  timeElapsedSinceStart: number;
  tangent: number | undefined;
}

export interface ReferenceLap {
  classId: number;
  refPoints: Map<number, ReferencePoint>;
  startTime: number;
  finishTime: number;
  lastTrackedPct: number;
  isCleanLap: boolean;
}

export function normalizeKey(key: number): number {
  const normalizedKey = parseFloat(
    (key - (key % REFERENCE_INTERVAL)).toFixed(DECIMAL_PLACES)
  );
  return normalizedKey < 0 || normalizedKey >= 1 ? 0 : normalizedKey;
}

function isLapClean(trackSurface: number, isOnPitRoad: boolean): boolean {
  return trackSurface === TRACK_SURFACES.OnTrack && !isOnPitRoad;
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
            console.error(
              `Failed to load reference lap for class ${classId}:`,
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
          classId,
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

      const isLapComplete = refLap.lastTrackedPct > 0.95 && trackPct < 0.05;

      if (isLapComplete) {
        refLap.finishTime = sessionTime;
        const currentLapTime = refLap.finishTime - refLap.startTime;
        const MIN_POINTS_FOR_VALID_LAP = 400;

        if (
          refLap.refPoints.size >= MIN_POINTS_FOR_VALID_LAP &&
          currentLapTime > 0
        ) {
          const bestLap = bestLaps.get(carIdx);
          const isNewBestLap = bestLap
            ? currentLapTime < bestLap.finishTime - bestLap.startTime
            : true;

          if (isNewBestLap && refLap.isCleanLap) {
            precomputePCHIPTangents(refLap);

            // Mutate in place
            bestLaps.set(carIdx, refLap);

            const savedLap = persistedLaps.get(refLap.classId);
            const savedLapTime = savedLap
              ? savedLap.finishTime - savedLap.startTime
              : Infinity;

            if (currentLapTime < savedLapTime) {
              // Mutate in place
              persistedLaps.set(refLap.classId, refLap);

              if (seriesId !== null && trackId !== null) {
                bridge
                  .saveReferenceLap(seriesId, trackId, refLap.classId, refLap)
                  .catch((err: Error) => {
                    console.error(
                      `[Session] Failed to save class ${refLap.classId}`,
                      err
                    );
                  });
              }
            }
          }
        }

        activeLaps.set(carIdx, {
          classId,
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
        trackSurface !== TRACK_SURFACES.OnTrack &&
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
      const { activeLaps, bestLaps, persistedLaps } = get();
      activeLaps.clear();
      bestLaps.clear();
      persistedLaps.clear();
    },
  })
);
