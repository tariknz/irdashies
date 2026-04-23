import { useEffect } from 'react';
import {
  useTelemetryValue,
  useTelemetryValues,
} from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from './LapTimesStore';
import { useRelativeSettings } from '../../components/Standings/hooks';
import { useStandingsSettings } from '../../components/Standings/hooks/useStandingsSettings';

/**
 * Hook that automatically updates the LapTimesStore with telemetry data.
 * This ensures lap time history is always up-to-date without manual updates in components.
 *
 * Use this hook in components that need lap time history tracking (e.g., Standings overlay).
 */
export const useLapTimesStoreUpdater = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const carIdxLastLapTime = useTelemetryValues('CarIdxLastLapTime');
  const updateLapTimes = useLapTimesStore((state) => state.updateLapTimes);
  const reset = useLapTimesStore((state) => state.reset);
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();

  // Reset immediately when session changes so stale data is cleared
  // before any new telemetry arrives
  useEffect(() => {
    reset();
  }, [sessionNum, reset]);

  useEffect(() => {
    if (
      carIdxLastLapTime &&
      (standingsSettings?.lapTimeDeltas?.enabled ||
        standingsSettings?.avgLapTime?.enabled ||
        relativeSettings?.lapTimeDeltas?.enabled)
    ) {
      updateLapTimes(carIdxLastLapTime, sessionNum ?? null);
    }
  }, [
    carIdxLastLapTime,
    sessionNum,
    updateLapTimes,
    standingsSettings?.lapTimeDeltas?.enabled,
    standingsSettings?.avgLapTime?.enabled,
    relativeSettings?.lapTimeDeltas?.enabled,
  ]);
};
