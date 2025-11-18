import { useEffect, useRef } from 'react';
import { useTelemetryValue, useTelemetryValues } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from './LapTimesStore';
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
  const updateLapTimes = useLapTimesStore(state => state.updateLapTimes);
  const reset = useLapTimesStore(state => state.reset);
  const standingsSettings = useStandingsSettings();
  const lastSessionNumRef = useRef<number | null>(null);
  
  const currentSessionNum = sessionNum ?? null;

  useEffect(() => {
    if (lastSessionNumRef.current !== null && currentSessionNum !== null && currentSessionNum !== lastSessionNumRef.current) {
      console.log(`[LapTimesStoreUpdater] Session changed from ${lastSessionNumRef.current} to ${currentSessionNum}`);
      reset();
    }
    
    lastSessionNumRef.current = currentSessionNum;
  }, [currentSessionNum, reset]);

  useEffect(() => {
    if (carIdxLastLapTime && standingsSettings?.lapTimeDeltas?.enabled) {
      updateLapTimes(carIdxLastLapTime);
    }
  }, [carIdxLastLapTime, updateLapTimes, standingsSettings?.lapTimeDeltas?.enabled]);
};
