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
export const usePitLapStoreUpdater = (enabled: boolean) => {
  const carIdxOnPitRoad = useTelemetryValues<boolean[]>('CarIdxOnPitRoad');
  const carIdxLap = useTelemetryValues<number[]>('CarIdxLap');
  const sessionUniqueID = useTelemetryValue('SessionUniqueID');
  const carIdxTrackSurface = useTelemetryValues<number[]>('CarIdxTrackSurface');
  const sessionState = useTelemetryValue('SessionState');
  const updatePitLapTimes = usePitLapStore(state => state.updatePitLaps);

  const throttledSessionTime = useStore(useTelemetryStore, (state) => {
    const rawTime = state.telemetry?.SessionTime?.value?.[0];
    if (rawTime == null) return null;
    return Math.floor(rawTime);
  });

  useEffect(() => {
    if (!enabled) return;
    updatePitLapTimes(
      carIdxOnPitRoad ?? [],
      carIdxLap ?? [],
      sessionUniqueID ?? 0,
      throttledSessionTime ?? 0,
      carIdxTrackSurface ?? [],
      sessionState ?? 0
    );
  }, [enabled, carIdxOnPitRoad, carIdxLap, sessionUniqueID, throttledSessionTime, carIdxTrackSurface, sessionState, updatePitLapTimes]);
};