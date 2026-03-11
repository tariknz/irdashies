import { useEffect, useRef } from 'react';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useCarSpeedsStore } from '../CarSpeedStore/CarSpeedsStore';
import { useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { usePitLapStore } from '../PitLapStore/PitLapStore';
import { useFuelStore } from '../../components/FuelCalculator/FuelStore';

/**
 * Resets all session-related stores when the iRacing sim disconnects.
 * Watches for the running state to transition from true to false,
 * then clears stale data so overlays start fresh on the next session.
 */
export const useResetOnDisconnect = (running: boolean) => {
  const prevRunning = useRef(running);

  useEffect(() => {
    if (prevRunning.current && !running) {
      console.log(
        '[useResetOnDisconnect] Sim disconnected, resetting all stores'
      );
      useSessionStore.getState().resetSession();
      useTelemetryStore.getState().resetTelemetry();
      useCarSpeedsStore.getState().resetCarSpeeds();
      useLapTimesStore.getState().reset();
      usePitLapStore.getState().reset();
      useFuelStore.getState().clearAllData();
    }
    prevRunning.current = running;
  }, [running]);
};
