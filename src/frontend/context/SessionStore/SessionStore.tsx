import type { Session } from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayShallowCompare } from './arrayShallowCompare';
import { shallow } from 'zustand/shallow';

interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null as Session | null,
  setSession: (session: Session) => set({ session }),
}));

export const useSessionDrivers = () =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) => state.session?.DriverInfo?.Drivers,
    arrayShallowCompare
  );

export const useSingleSession = (sessionNum: number | undefined) =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      ),
    shallow
  );

export const useSessionType = (sessionNum: number | undefined) =>
  useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      )?.SessionType
  );

export const useSessionName = (sessionNum: number | undefined) =>
  useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      )?.SessionName
  );

export const useSessionLaps = (sessionNum: number | undefined) =>
  useStore(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      )?.SessionLaps
  );

export const useSessionIsOfficial = () =>
  useStore(
    useSessionStore,
    (state) =>
      !!state.session?.WeekendInfo?.Official
  );

export const useDriverCarIdx = () =>
  useStore(useSessionStore, (state) => state.session?.DriverInfo?.DriverCarIdx);

export const useSessionPositions = (sessionNum: number | undefined) =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      )?.ResultsPositions,
    arrayShallowCompare
  );

export const useSessionFastestLaps = (sessionNum: number | undefined) =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) =>
      state.session?.SessionInfo?.Sessions?.find(
        (state) => state.SessionNum === sessionNum
      )?.ResultsFastestLap,
    arrayShallowCompare
  );

export const useSessionQualifyingResults = () =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state) => state.session?.QualifyResultsInfo?.Results,
    arrayShallowCompare
  );

/**
 * @returns The track length in meters
 */
export const useTrackLength = () =>
  useStore(useSessionStore, (state) => {
    const length = state.session?.WeekendInfo?.TrackLength;
    const [value, unit] = length?.split(' ') ?? [];
    if (unit === 'km') {
      return parseFloat(value) * 1000;
    }

    return parseFloat(value);
  });


/**
 * @returns The car index and car class estimated lap time for each driver
 */
export const useCarIdxClassEstLapTime = () =>
  useStore(useSessionStore, (state) => {
    return state.session?.DriverInfo?.Drivers?.reduce((acc, driver) => {
      acc[driver.CarIdx] = driver.CarClassEstLapTime;
      return acc;
    }, {} as Record<number, number>);
  });
