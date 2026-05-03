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

const recordsEqual = (a: Record<number, number>, b: Record<number, number>) => {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (a[+k] !== b[+k]) return false;
  }
  return true;
};

export const useDriverStatsStore = create<DriverStatsState>((set) => ({
  iratingChanges: {},
  positionChanges: {},
  // Bail when both maps are value-equal so we don't push new object identity
  // every session tick — that would force every subscriber's memo to invalidate.
  setStats: (iratingChanges, positionChanges) =>
    set((state) => {
      if (
        recordsEqual(state.iratingChanges, iratingChanges) &&
        recordsEqual(state.positionChanges, positionChanges)
      ) {
        return state;
      }
      return { iratingChanges, positionChanges };
    }),
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
