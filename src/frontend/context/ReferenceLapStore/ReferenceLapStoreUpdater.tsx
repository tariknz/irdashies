import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useReferenceLapStore } from './ReferenceLapStore';
import type { ReferenceLapBridge } from '../../../types/referenceLaps';
import { useSessionStore } from '../SessionStore/SessionStore';
import { Driver } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

function getClassList(drivers: Driver[], paceCarIdx: number): number[] {
  const paceCarClassId = drivers[paceCarIdx]?.CarClassID ?? -1;
  const classList = Array.from(new Set(drivers.map((d) => d.CarClassID)))
    .filter((id) => id !== paceCarClassId && id > 0)
    .sort((a, b) => a - b);

  return classList;
}

export const useReferenceLapStoreUpdater = (bridge: ReferenceLapBridge) => {
  const { initialize, completeSession, collectBulkData } =
    useReferenceLapStore.getState();

  // Keep track of session state without triggering re-renders
  const sessionRef = useRef({
    seriesId: -1,
    trackId: -1,
    trackLength: -1,
    sessionNum: -1,
    subSessionId: -1,
    drivers: [] as Driver[],
    paceCarIdx: -1,
  });

  useEffect(() => {
    // 1. Session Subscription: Handles initialization and reset logic
    const unsubSession = useSessionStore.subscribe((state) => {
      const session = state.session;
      if (!session) return;

      const seriesId = session.WeekendInfo.SeriesID;
      const trackId = session.WeekendInfo.TrackID;

      if (!seriesId || seriesId <= 0 || !trackId || trackId <= 0) return;

      const subSessionId = session.WeekendInfo.SubSessionID;
      const paceCarIdx = session.DriverInfo.PaceCarIdx;
      const drivers = session.DriverInfo.Drivers || [];

      // Calculate track length in meters
      const lengthStr = session.WeekendInfo.TrackLength;
      const [val, unit] = lengthStr?.split(' ') ?? [];
      const trackLength =
        unit === 'km' ? parseFloat(val) * 1000 : parseFloat(val);

      const s = sessionRef.current;

      // If core session identifiers change, re-initialize the store
      if (
        seriesId !== s.seriesId ||
        trackId !== s.trackId ||
        subSessionId !== s.subSessionId ||
        trackLength !== s.trackLength
      ) {
        logger.info('[RefLapStore] Session changed, initializing...');
        completeSession();

        const classList = getClassList(drivers, paceCarIdx);
        initialize(bridge, seriesId, trackId, trackLength, classList);

        // Update ref with new session info
        Object.assign(s, {
          seriesId,
          trackId,
          subSessionId,
          trackLength,
          drivers,
          paceCarIdx,
        });
      } else {
        // Just update drivers and pace car if session metadata is same
        s.drivers = drivers;
        s.paceCarIdx = paceCarIdx;
      }
    });

    // 2. Telemetry Subscription: Handles high-frequency lap data collection
    const unsubTelemetry = useTelemetryStore.subscribe((state) => {
      const telemetry = state.telemetry;
      if (!telemetry) return;

      const sessionNum = telemetry.SessionNum?.value?.[0] ?? -1;
      const s = sessionRef.current;

      // Reset session if we move to a different session number (e.g. Practice -> Qualify)
      if (sessionNum !== s.sessionNum && s.seriesId !== -1) {
        logger.info(
          `[RefLapStore] SessionNum changed to ${sessionNum}, resetting...`
        );
        completeSession();

        const classList = getClassList(s.drivers, s.paceCarIdx);

        initialize(bridge, s.seriesId, s.trackId, s.trackLength, classList);
        s.sessionNum = sessionNum;
      }

      const dists = telemetry.CarIdxLapDistPct?.value || ([] as number[]);
      const pits = telemetry.CarIdxOnPitRoad?.value || ([] as boolean[]);
      const time = telemetry.SessionTime?.value?.[0] ?? -1;

      if (
        dists.length > 0 &&
        pits.length > 0 &&
        time > -1 &&
        s.drivers.length > 0
      ) {
        collectBulkData(bridge, s.seriesId, s.drivers, dists, pits, time);
      }
    });

    return () => {
      unsubSession();
      unsubTelemetry();
    };
  }, [bridge, completeSession, initialize, collectBulkData]);
};
