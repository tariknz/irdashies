import type {
  Session,
  SessionQualifyPosition,
  SessionResults,
  CarClassStats,
} from '@irdashies/types';
import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { arrayShallowCompare } from './arrayShallowCompare';
import { shallow } from 'zustand/shallow';

const recordEqual = <V,>(
  a: Record<string | number, V> | undefined,
  b: Record<string | number, V> | undefined,
  valueEqual: (x: V, y: V) => boolean
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    if (!valueEqual(a[k], b[k])) return false;
  }
  return true;
};

const carIdxClassEstLapTimeEqual = (
  a: Record<number, number> | undefined,
  b: Record<number, number> | undefined
) => recordEqual(a, b, (x, y) => x === y);

const carClassStatsEqual = (
  a: Record<string, CarClassStats> | undefined,
  b: Record<string, CarClassStats> | undefined
) =>
  recordEqual(
    a,
    b,
    (x, y) =>
      x.shortName === y.shortName &&
      x.color === y.color &&
      x.total === y.total &&
      x.sof === y.sof
  );

interface SessionState {
  session: Session | null;
  setSession: (session: Session) => void;
  resetSession: () => void;
  greenFlagTimestamp: number | null;
  setGreenFlagTimestamp: (time: number | null) => void;
  checkeredLap: number | null;
  setCheckeredLap: (lap: number | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null as Session | null,
  setSession: (session: Session) => set({ session }),
  resetSession: () => set({ session: null }),
  greenFlagTimestamp: null as number | null,
  setGreenFlagTimestamp: (time: number | null) =>
    set({ greenFlagTimestamp: time }),
  checkeredLap: null as number | null,
  setCheckeredLap: (lap: number | null) => set({ checkeredLap: lap }),
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
  useStore(useSessionStore, (state) => !!state.session?.WeekendInfo?.Official);

export const useWeekendInfoSeriesID = () =>
  useStore(useSessionStore, (state) => state.session?.WeekendInfo?.SeriesID);

export const useWeekendInfoEventType = () =>
  useStore(useSessionStore, (state) => state.session?.WeekendInfo?.EventType);

export const useWeekendInfoNumCarClasses = () =>
  useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.NumCarClasses
  );

export const useWeekendInfoTeamRacing = () =>
  useStore(useSessionStore, (state) => state.session?.WeekendInfo?.TeamRacing);

export const useTrackDisplayName = () =>
  useStore(
    useSessionStore,
    (state) => state.session?.WeekendInfo?.TrackDisplayName
  );

export const useDriverCarIdx = () =>
  useStore(useSessionStore, (state) => state.session?.DriverInfo?.DriverCarIdx);

export const useSessionPositions = (sessionNum: number | undefined) =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state): SessionResults[] | undefined =>
      state.session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.ResultsPositions ?? undefined,
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
    (state): SessionResults[] | undefined =>
      state.session?.QualifyResultsInfo?.Results ?? undefined,
    arrayShallowCompare
  );

export const useSessionQualifyPositions = (sessionNum: number | undefined) =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state): SessionQualifyPosition[] | undefined =>
      state.session?.SessionInfo?.Sessions?.find(
        (s) => s.SessionNum === sessionNum
      )?.QualifyPositions,
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
 *
 * The selector recomputes whenever the session changes, but the custom
 * equality function preserves the prior result identity when values are
 * unchanged — so consumer memos hold across session pushes that only
 * mutate driver fields irrelevant to this map.
 */
export const useCarIdxClassEstLapTime = () =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state): Record<number, number> | undefined => {
      const drivers = state.session?.DriverInfo?.Drivers;
      if (!drivers) return undefined;
      return drivers.reduce(
        (acc, driver) => {
          acc[driver.CarIdx] = driver.CarClassEstLapTime;
          return acc;
        },
        {} as Record<number, number>
      );
    },
    carIdxClassEstLapTimeEqual
  );

export const useGreenFlagTimestamp = () =>
  useStore(useSessionStore, (state) => state.greenFlagTimestamp);

export const useSetGreenFlagTimestamp = () =>
  useStore(useSessionStore, (state) => state.setGreenFlagTimestamp);

export const useCheckeredLap = () =>
  useStore(useSessionStore, (state) => state.checkeredLap);

export const useSetCheckeredLap = () =>
  useStore(useSessionStore, (state) => state.setCheckeredLap);

export const useCarSetup = () =>
  useStore(useSessionStore, (state) => state.session?.CarSetup);

/**
 * @returns The stats for each car class in the session (ShortName, Color, Total Drivers, SOF)
 *
 * The selector recomputes whenever the session changes, but the custom
 * equality function preserves the prior result identity when SOF/total
 * values are unchanged — so consumer memos hold across session pushes
 * that only mutate driver fields irrelevant to this calc (e.g. incident
 * counts).
 */
export const useCarClassStats = () =>
  useStoreWithEqualityFn(
    useSessionStore,
    (state): Record<string, CarClassStats> | undefined => {
      const drivers = state.session?.DriverInfo?.Drivers;
      if (!drivers) return undefined;

      const raceDrivers = drivers.filter(
        (driver) => !driver.IsSpectator && !driver.CarIsPaceCar
      );

      const intermediate = raceDrivers.reduce(
        (acc, driver) => {
          if (!acc[driver.CarClassID]) {
            acc[driver.CarClassID] = {
              total: 0,
              raceDrivers: 0,
              sumExp: 0,
              color: driver.CarClassColor,
              shortName: driver.CarClassShortName,
            };
          }

          acc[driver.CarClassID].total += 1;

          if (driver.IRating > 0) {
            const expValue = Math.pow(2, -driver.IRating / 1600);
            acc[driver.CarClassID].raceDrivers += 1;
            acc[driver.CarClassID].sumExp += expValue;
          }

          return acc;
        },
        {} as Record<
          string,
          {
            shortName: string;
            color: number;
            total: number;
            raceDrivers: number;
            sumExp: number;
          }
        >
      );

      return Object.fromEntries(
        Object.entries(intermediate).map(([classId, stats]) => {
          const sof =
            stats.raceDrivers > 0
              ? Math.round(
                  (1600 / Math.log(2)) *
                    Math.log(stats.raceDrivers / stats.sumExp)
                )
              : 0;

          return [
            classId,
            {
              shortName: stats.shortName,
              color: stats.color,
              total: stats.total,
              sof,
            } as CarClassStats,
          ];
        })
      );
    },
    carClassStatsEqual
  );
