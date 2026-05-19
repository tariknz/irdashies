import { create } from 'zustand';
import type { PersonalBestLapBridge } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

declare global {
  interface Window {
    personalBestBridge?: PersonalBestLapBridge;
  }
}

export interface PersonalBestStore {
  // Data
  personalBests: Record<string, number>; // key: "${trackId}:${carName}", value: time

  // Actions
  getPersonalBest: (
    trackId: string | number,
    carName: string
  ) => number | undefined;
  loadPersonalBest: (
    trackId: string | number,
    carName: string
  ) => Promise<void>;
  setPersonalBest: (
    trackId: string | number,
    carName: string,
    time: number
  ) => Promise<void>;
}

const generateKey = (trackId: string | number, carName: string): string => {
  return `${trackId}:${carName}`;
};

const pendingPersonalBestLoads = new Set<string>();
const loadedPersonalBestKeys = new Set<string>();

export const usePersonalBestStore = create<PersonalBestStore>((set, get) => {
  const ensurePersonalBestLoaded = async (
    trackId: string | number,
    carName: string,
    key: string
  ) => {
    try {
      let shouldMarkLoaded = false;
      try {
        if (!window.personalBestBridge) {
          return;
        }
        const time = await window.personalBestBridge.getPersonalBest(
          trackId,
          carName
        );
        shouldMarkLoaded = true;
        if (time != null) {
          set({
            personalBests: {
              ...get().personalBests,
              [key]: time,
            },
          });
        }
      } catch (error) {
        logger.error(
          `[PersonalBestStore] Failed to load personal best for ${carName} at track ${trackId}:`,
          error
        );
      } finally {
        pendingPersonalBestLoads.delete(key);
        if (shouldMarkLoaded) loadedPersonalBestKeys.add(key);
      }
  };

  return {
    personalBests: {},

    getPersonalBest: (trackId, carName) => {
      const key = generateKey(trackId, carName);
      const bests = get().personalBests;
      const currentBest = bests[key];
      if (currentBest != null) {
        return currentBest;
      }

      if (
        !pendingPersonalBestLoads.has(key) &&
        !loadedPersonalBestKeys.has(key) &&
        window.personalBestBridge
      ) {
        pendingPersonalBestLoads.add(key);
        void Promise.resolve().then(() =>
          ensurePersonalBestLoaded(trackId, carName, key)
        );
      }

      return undefined;
    },

    loadPersonalBest: async (trackId, carName) => {
      const key = generateKey(trackId, carName);
      if (loadedPersonalBestKeys.has(key)) {
        return;
      }
      if (pendingPersonalBestLoads.has(key)) {
        return;
      }
      pendingPersonalBestLoads.add(key);
      await ensurePersonalBestLoaded(trackId, carName, key);
    },

    setPersonalBest: async (trackId, carName, time) => {
      const key = generateKey(trackId, carName);
      try {
        if (!window.personalBestBridge) {
          throw new Error('Personal best bridge not available');
        }
        await window.personalBestBridge.setPersonalBest(trackId, carName, time);
        // Update local store
        set((state) => {
          const currentBest = state.personalBests[key];
          // Only update if it's a new PB (lower time)
          if (!currentBest || time < currentBest) {
            return {
              personalBests: {
                ...state.personalBests,
                [key]: time,
              },
            };
          }
          return state;
        });
      } catch (error) {
        logger.error(
          `[PersonalBestStore] Failed to set personal best for ${carName} at track ${trackId}:`,
          error
        );
        throw error;
      }
    },
  };
});
