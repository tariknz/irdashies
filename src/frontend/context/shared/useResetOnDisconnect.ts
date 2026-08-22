import { useEffect, useRef } from 'react';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { usePitLapStore } from '../PitLapStore/PitLapStore';
import { useBattleGapStore } from '../BattleGapStore/BattleGapStore';
import { useFuelStore } from '../../components/FuelCalculator/FuelStore';
import logger from '@irdashies/utils/logger';

/**
 * Resets all session-related stores when the iRacing sim disconnects.
 * Watches for the running state to transition from true to false,
 * then clears stale data so overlays start fresh on the next session.
 */
export const useResetOnDisconnect = (running: boolean) => {
  const prevRunning = useRef(running);

  useEffect(() => {
    if (prevRunning.current && !running) {
      logger.info(
        '[useResetOnDisconnect] Sim disconnected, resetting all stores'
      );
      useSessionStore.getState().resetSession();
      useTelemetryStore.getState().resetTelemetry();
      useLapTimesStore.getState().reset();
      usePitLapStore.getState().reset();
      useBattleGapStore.getState().reset();
      useFuelStore.getState().clearAllData();
      // Keep Race Control incidents available for post-session review. Its
      // bridge clears them when the next non-empty session ID arrives.
    }
    prevRunning.current = running;
  }, [running]);
};
