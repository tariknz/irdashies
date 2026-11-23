import { useEffect, useRef } from 'react';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useLapTimesStore } from '../LapTimesStore/LapTimesStore';
import { usePitLapStore } from '../PitLapStore/PitLapStore';
import { useFuelStore } from '../FuelStore/FuelStore';
import { useLapTraceStore } from '../LapTraceStore/LapTraceStore';
import { useReplayContextStore } from '../ReplayContextStore/ReplayContextStore';
import { useReplayTimecodeStore } from '../ReplayTimecodeStore/ReplayTimecodeStore';
import logger from '@irdashies/utils/logger';

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
      useFuelStore.getState().clearAllData();
      useLapTraceStore.getState().reset();
      useReplayContextStore.getState().reset();
      useReplayTimecodeStore.getState().reset();
      // Keep Race Control incidents available for post-session review. Its
      // bridge clears them when the next non-empty session ID arrives.
    }
    prevRunning.current = running;
  }, [running]);
};
