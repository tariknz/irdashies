import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';

interface SessionTimingData {
  sessionType?: string;
  state: number;
  currentLap: number;
  totalLaps: number;
  time: number;
  timeTotal: number;
  timeRemaining: number;
  greenFlagTimestamp: number;
  isFixedLapRace: boolean;
  totalRaceLaps: number;
  totalRaceTime: number;
  adjustedRaceTime: number;
}

interface SessionTimingState extends SessionTimingData {
  update: (data: SessionTimingData) => void;
}

export const useSessionTimingStore = create<SessionTimingState>((set) => ({
  sessionType: undefined,
  state: 0,
  currentLap: 0,
  totalLaps: 0,
  time: 0,
  timeTotal: 0,
  timeRemaining: 0,
  greenFlagTimestamp: 0,
  isFixedLapRace: true,
  totalRaceLaps: 0,
  totalRaceTime: 0,
  adjustedRaceTime: 0,

  update: (data) => set(data),
}));

// Composite selectors — one per SessionBar item consumer, shallow-compared so
// a tick that doesn't change any field this item cares about doesn't force a
// re-render.
export const useSessionTimeTiming = () =>
  useStoreWithEqualityFn(
    useSessionTimingStore,
    (s) => ({
      sessionType: s.sessionType,
      time: s.time,
      timeRemaining: s.timeRemaining,
      timeTotal: s.timeTotal,
      state: s.state,
      greenFlagTimestamp: s.greenFlagTimestamp,
      isFixedLapRace: s.isFixedLapRace,
      totalRaceTime: s.totalRaceTime,
      adjustedRaceTime: s.adjustedRaceTime,
    }),
    shallow
  );

export const useSessionLapsTiming = () =>
  useStoreWithEqualityFn(
    useSessionTimingStore,
    (s) => ({
      sessionType: s.sessionType,
      currentLap: s.currentLap,
      totalLaps: s.totalLaps,
      state: s.state,
      totalRaceLaps: s.totalRaceLaps,
      isFixedLapRace: s.isFixedLapRace,
    }),
    shallow
  );
