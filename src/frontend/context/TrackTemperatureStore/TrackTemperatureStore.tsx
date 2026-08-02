import { create, useStore } from 'zustand';

interface TrackTemperatureState {
  trackTempC: number | undefined;
  airTempC: number | undefined;
  update: (
    trackTempC: number | undefined,
    airTempC: number | undefined
  ) => void;
}

export const useTrackTemperatureStore = create<TrackTemperatureState>(
  (set) => ({
    trackTempC: undefined,
    airTempC: undefined,
    update: (trackTempC, airTempC) => set({ trackTempC, airTempC }),
  })
);

export const useTrackTempC = (): number | undefined =>
  useStore(useTrackTemperatureStore, (s) => s.trackTempC);

export const useAirTempC = (): number | undefined =>
  useStore(useTrackTemperatureStore, (s) => s.airTempC);
