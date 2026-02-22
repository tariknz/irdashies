import { useEffect, useMemo } from 'react';
import {
  useTelemetryValues,
  useTelemetryValue,
} from '../TelemetryStore/TelemetryStore';
import { useReferenceLapStore } from './ReferenceLapStore';
import type { ReferenceLapBridge } from '../../../types/referenceLaps';
import { TRACK_SURFACES } from '../../components/Standings/relativeGapHelpers';
import {
  useSessionDrivers,
  useSessionStore,
} from '../SessionStore/SessionStore';
import { Driver } from '@irdashies/types';

const EMPTY_DRIVER_ARRAY = [] as Driver[];

export const useReferenceRegistryUpdater = (bridge: ReferenceLapBridge) => {
  const { collectLapData, initialize, completeSession } =
    useReferenceLapStore.getState();
  const seriesId =
    useSessionStore((s) => s.session?.WeekendInfo.SeriesID) ?? -1;
  const trackId = useSessionStore((s) => s.session?.WeekendInfo.TrackID) ?? -1;
  const drivers = useSessionDrivers() ?? EMPTY_DRIVER_ARRAY;
  const subSessionId =
    useSessionStore((s) => s.session?.WeekendInfo.SubSessionID) ?? -1;
  const sessionNum = useTelemetryValue('SessionNum') ?? -1;
  const paceCarIdx =
    useSessionStore((s) => s.session?.DriverInfo?.PaceCarIdx) ?? -1;

  const classIdsString = drivers.map((d) => d.CarClassID).join(',');

  const classList = useMemo(() => {
    const ids = drivers.map((d) => d.CarClassID);
    const uniqueIds = Array.from(new Set(ids));

    const paceCarClassId = drivers[paceCarIdx]?.CarClassID;
    return uniqueIds
      .filter((classId) => classId !== paceCarClassId)
      .sort((a, b) => a - b);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classIdsString]);

  useEffect(() => {
    console.log('Resetting Session!');
    completeSession();
    initialize(bridge, seriesId, trackId, classList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // classList,
    // completeSession,
    // initialize,
    seriesId,
    trackId,
    sessionNum,
    subSessionId,
    // bridge,
  ]);

  const carIdxLapDistPct = useTelemetryValues('CarIdxLapDistPct');
  const carIdxOnPitRoad = useTelemetryValues('CarIdxOnPitRoad');
  const sessionTime = useTelemetryValue('SessionTime');

  useEffect(() => {
    if (!carIdxLapDistPct || !sessionTime) return;

    for (const driver of drivers) {
      const idx = driver.CarIdx;
      const trackPct = carIdxLapDistPct[idx];
      const classId = driver.CarClassID ?? 0;
      const isOnPitRoad = (carIdxOnPitRoad?.[idx] ?? 0) === 1;

      if (trackPct > -1) {
        collectLapData(
          bridge,
          idx,
          classId,
          trackPct,
          sessionTime,
          // Not tracking off tracks for now.
          TRACK_SURFACES.OnTrack,
          isOnPitRoad
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carIdxLapDistPct,
    carIdxOnPitRoad,
    sessionTime,
    // collectLapData,
    drivers,
    // bridge,
  ]);
};
