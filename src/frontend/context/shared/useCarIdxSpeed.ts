import { useEffect } from 'react';
import { useTelemetryStore } from '../TelemetryStore/TelemetryStore';
import { useTrackLength } from '../SessionStore/SessionStore';
import {
  useCarSpeeds,
  useCarSpeedsStore,
} from '../CarSpeedStore/CarSpeedsStore';

/**
 * First time this hook is called, it will update the car speeds using both telemetry and session (track length) state.
 * Subsequent calls will return the cached car speeds.
 * @returns An array of speeds for each car in the session by index. Speed value in km/h
 */
export function useCarIdxSpeed() {
  const telemetry = useTelemetryStore((state) => state.telemetry);
  const updateCarSpeeds = useCarSpeedsStore((state) => state.updateCarSpeeds);
  const trackLength = useTrackLength();
  const carSpeeds = useCarSpeeds();

  useEffect(() => {
    if (telemetry && trackLength) {
      updateCarSpeeds(telemetry, trackLength);
    }
  }, [telemetry, trackLength, updateCarSpeeds]);

  return carSpeeds;
}
