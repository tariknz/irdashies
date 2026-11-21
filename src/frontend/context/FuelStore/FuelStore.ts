import { create } from 'zustand';
import type { FuelLapData } from '@irdashies/types';

/** Maximum number of laps to retain in history */
export const MAX_LAP_HISTORY = 50;

interface FuelStoreState {
  lapHistory: Map<number, FuelLapData>;
  /** Processor history preserves repeated lap numbers across sessions; capped at MAX_LAP_HISTORY. */
  projectionLaps: readonly FuelLapData[];
  _oldestLapNumber: number;
  lastLap: number;
  lapStartFuel: number;
  lapCrossingTime: number;
  lastLapDistPct: number;
  sessionNum: number;
  wasOnPitRoad: boolean;
  lastSessionFlags: number;
  qualifyConsumption: number | null;
  trackId?: string | number;
  carName?: string;
  accumulatedRefuel: number;
}

interface FuelStoreActions {
  addLapData: (lapData: FuelLapData) => void;

  updateLapCrossing: (
    lapDistPct: number,
    fuelLevel: number,
    sessionTime: number,
    currentLap: number,
    isOnPitRoad: boolean
  ) => void;

  clearAllData: () => void;

  updateSessionInfo: (sessionNum: number) => void;

  getLapHistory: () => FuelLapData[];

  setQualifyConsumption: (val: number | null) => void;
  setContextInfo: (trackId?: string | number, carName?: string) => void;
  setLapHistory: (laps: FuelLapData[]) => void;
  setProjectionLaps: (laps: readonly FuelLapData[]) => void;
}

type FuelStore = FuelStoreState & FuelStoreActions;

function sortLapsDescending(laps: FuelLapData[]): FuelLapData[] {
  return laps.sort((a, b) => {
    const timeA = a.timestamp || 0;
    const timeB = b.timestamp || 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.lapNumber - a.lapNumber;
  });
}

export const useFuelStore = create<FuelStore>()((set, get) => ({
  lapHistory: new Map(),
  projectionLaps: [],
  _oldestLapNumber: Infinity,
  lastLap: 0,
  lapStartFuel: 0,
  lapCrossingTime: 0,
  lastLapDistPct: 0,
  sessionNum: -1,
  wasOnPitRoad: false,
  lastSessionFlags: 0,
  qualifyConsumption: null,
  accumulatedRefuel: 0,
  trackId: undefined,
  carName: undefined,

  addLapData: (lapData: FuelLapData) => {
    set((state) => {
      const newHistory = new Map(state.lapHistory);
      newHistory.set(lapData.lapNumber, lapData);

      let oldestLapNumber = Math.min(state._oldestLapNumber, lapData.lapNumber);

      if (newHistory.size > MAX_LAP_HISTORY) {
        newHistory.delete(oldestLapNumber);
        oldestLapNumber = Infinity;
        for (const key of newHistory.keys()) {
          if (key < oldestLapNumber) {
            oldestLapNumber = key;
          }
        }
      }

      return {
        lapHistory: newHistory,
        _oldestLapNumber: oldestLapNumber,
        lastLap: lapData.lapNumber,
      };
    });
  },

  updateLapCrossing: (
    lapDistPct: number,
    fuelLevel: number,
    sessionTime: number,
    currentLap: number,
    isOnPitRoad: boolean
  ) => {
    set({
      lastLapDistPct: lapDistPct,
      lapStartFuel: fuelLevel,
      lapCrossingTime: sessionTime,
      lastLap: currentLap,
      wasOnPitRoad: isOnPitRoad,
      accumulatedRefuel: 0, // Reset accumulated refuel for the new lap
    });
  },

  clearAllData: () => {
    set({
      lapHistory: new Map(),
      projectionLaps: [],
      _oldestLapNumber: Infinity,
      lastLap: 0,
      lapStartFuel: 0,
      lapCrossingTime: 0,
      lastLapDistPct: 0,
      wasOnPitRoad: false,
      lastSessionFlags: 0,
      accumulatedRefuel: 0,
      // qualifyConsumption is INTENTIONALLY preservation across session changes
      // It should only be cleared if we detect a track change (handled in useFuelCalculation)
      // or if we decide to add a hard reset button later.
    });
  },

  updateSessionInfo: (sessionNum: number) => {
    // Don't clear data on session change - preserve fuel consumption data
    // across warmup/qualifying/race within the same iRacing session
    // Data will only be cleared when explicitly leaving the session
    set({ sessionNum });
  },

  getLapHistory: () =>
    sortLapsDescending(Array.from(get().lapHistory.values())),

  setQualifyConsumption: (val) => {
    set({ qualifyConsumption: val });
  },

  setContextInfo: (trackId, carName) => {
    set({ trackId, carName });
  },

  setLapHistory: (laps) => {
    set(() => {
      const newHistory = new Map();
      let oldestLapNumber = Infinity;

      laps.forEach((lap) => {
        newHistory.set(lap.lapNumber, { ...lap, isHistorical: true });
        if (lap.lapNumber < oldestLapNumber) {
          oldestLapNumber = lap.lapNumber;
        }
      });

      return {
        lapHistory: newHistory,
        _oldestLapNumber: oldestLapNumber,
        lastLap:
          laps.length > 0 ? Math.max(...laps.map((l) => l.lapNumber)) : 0,
      };
    });
  },

  setProjectionLaps: (laps) => {
    set((state) => {
      const newHistory = new Map(
        Array.from(state.lapHistory.entries()).filter(
          ([, lap]) => lap.isHistorical
        )
      );
      for (const lap of laps) {
        newHistory.set(lap.lapNumber, { ...lap, isHistorical: false });
      }
      const lapNumbers = Array.from(newHistory.keys());
      return {
        lapHistory: newHistory,
        projectionLaps: laps.slice(0, MAX_LAP_HISTORY),
        _oldestLapNumber:
          lapNumbers.length > 0 ? Math.min(...lapNumbers) : Infinity,
        lastLap:
          lapNumbers.length > 0 ? Math.max(...lapNumbers) : state.lastLap,
      };
    });
  },
}));

export const selectLapHistorySize = (state: FuelStore): number =>
  state.lapHistory.size;
