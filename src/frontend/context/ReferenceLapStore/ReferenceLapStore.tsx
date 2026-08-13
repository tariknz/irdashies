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
  /**
   * Retrieves a car's own best clean lap from this session, with no fallback to
   * the persisted class-best.
   *
   * Deliberately unlike getReferenceLap(): the class-best ghost may have been
   * set by an AI or an opponent, which is a valid reference for a time delta but
   * not for a speed delta (different line, different car setup) — and it carries
   * no speed data anyway. Returns null until a clean lap has been set.
   */
  getSessionBestLap(carIdx: number): ReferenceLap | null;
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
    getSessionBestLap: (carIdx) => get().bestLaps.get(carIdx) ?? null,
    completeSession: () => set(emptyState()),
  })
);
