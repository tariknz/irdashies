import { useEffect } from 'react';
import { useTelemetryValue, useTelemetryValues, useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { usePitLapStore } from './PitLapStore';
import { useStore } from 'zustand';

/**
 * Hook that automatically updates the PitLapStore with telemetry data.
 * This ensures pit lap tracking is always up-to-date without manual updates in components.
 *
 * Use this hook in components that need pit lap tracking (e.g., Standings overlay).
 */
export const usePitLabStoreUpdater = () => {
  const carIdxOnPitRoad = useTelemetryValues('CarIdxOnPitRoad');
  const carIdxLap = useTelemetryValues('CarIdxLap');
  const sessionUniqueID = useTelemetryValue('SessionUniqueID');
  const carIdxTrackSurface = useTelemetryValues('CarIdxTrackSurface');
  const sessionState = useTelemetryValue('SessionState');
  const updatePitLapTimes = usePitLapStore(state => state.updatePitLaps);

  const throttledSessionTime = useStore(useTelemetryStore, (state) => {
    const rawTime = state.telemetry?.SessionTime?.value?.[0];
    if (rawTime == null) return null;
    return Math.floor(rawTime);
  });

  useEffect(() => {
    updatePitLapTimes(
      carIdxOnPitRoad ?? [],
      carIdxLap ?? [],
      sessionUniqueID ?? 0,
      throttledSessionTime ?? 0,
      carIdxTrackSurface ?? [],
      sessionState ?? 0
    );
  }, [carIdxOnPitRoad, carIdxLap, sessionUniqueID, throttledSessionTime, carIdxTrackSurface, sessionState, updatePitLapTimes]);
};