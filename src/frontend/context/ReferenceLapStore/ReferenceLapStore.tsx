import type { ReferenceLap } from '@irdashies/types';
import { getBucketIndex } from '@irdashies/utils/referenceLap';
import { create } from 'zustand';

export { getBucketIndex };

export const EMPTY_REFERENCE_LAP: Readonly<ReferenceLap> = {
  startTime: -1,
  finishTime: -1,
  times: new Float32Array(),
  pointPos: new Float32Array(),
  tangents: new Float32Array(),
  interval: -1,
  pointsCount: 0,
  lastTrackedPct: -1,
  isCleanLap: false,
};

export interface ReferenceRegistryState {
  bestLaps: Map<number, ReferenceLap>;
  persistedLaps: Map<number, ReferenceLap>;
  getReferenceLap(
    carIdx: number,
    classId: number,
    usePersistence: boolean
  ): ReferenceLap;
  completeSession(): void;
}

const emptyState = () => ({
  bestLaps: new Map<number, ReferenceLap>(),
  persistedLaps: new Map<number, ReferenceLap>(),
});

/** Compatibility selector store; collection and persistence live in main. */
export const useReferenceLapStore = create<ReferenceRegistryState>(
  (set, get) => ({
    ...emptyState(),
    getReferenceLap: (carIdx, classId, usePersistence) => {
      const { bestLaps, persistedLaps } = get();
      if (!usePersistence) {
        const bestLap = bestLaps.get(carIdx);
        if (bestLap) return bestLap;
      }
      return persistedLaps.get(classId) ?? EMPTY_REFERENCE_LAP;
    },
    completeSession: () => set(emptyState()),
  })
);
