import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';

interface DriverStatsState {
  iratingChanges: Record<number, number>; // carIdx -> change
  positionChanges: Record<number, number>; // carIdx -> change
  setStats: (
    iratingChanges: Record<number, number>,
    positionChanges: Record<number, number>
  ) => void;
}

export const useDriverStatsStore = create<DriverStatsState>((set) => ({
  iratingChanges: {},
  positionChanges: {},
  setStats: (iratingChanges, positionChanges) =>
    set({ iratingChanges, positionChanges }),
}));

/**
 * @returns The iRating change for a specific driver
 */
export const useDriverIRatingChange = (carIdx: number | undefined) =>
  useStoreWithEqualityFn(useDriverStatsStore, (state) =>
    carIdx !== undefined ? state.iratingChanges[carIdx] : undefined
  );

/**
 * @returns The position change for a specific driver
 */
export const useDriverPositionChange = (carIdx: number | undefined) =>
  useStoreWithEqualityFn(useDriverStatsStore, (state) =>
    carIdx !== undefined ? state.positionChanges[carIdx] : undefined
  );
