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
  getPersonalBest: (trackId: string | number, carName: string) => number | undefined;
  setPersonalBest: (
    trackId: string | number,
    carName: string,
    time: number,
    lapNumber?: number
  ) => Promise<void>;
}

const generateKey = (trackId: string | number, carName: string): string => {
  return `${trackId}:${carName}`;
};

export const usePersonalBestStore = create<PersonalBestStore>((set, get) => ({
  personalBests: {},

  getPersonalBest: (trackId, carName) => {
    const key = generateKey(trackId, carName);
    const bests = get().personalBests;
    return bests[key] ?? undefined;
  },

  setPersonalBest: async (trackId, carName, time, lapNumber) => {
    const key = generateKey(trackId, carName);
    try {
      if (!window.personalBestBridge) {
        throw new Error('Personal best bridge not available');
      }
      await window.personalBestBridge.setPersonalBest(
        trackId,
        carName,
        time,
        lapNumber
      );
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
}));
