import { useDriverCarIdx, useSessionDrivers } from '../SessionStore/SessionStore';
import { useTelemetryValue } from '../TelemetryStore/TelemetryStore';

/**
 * Hook to get the car index that should be the "focus" for relative displays.
 *
 * Always returns the car currently being viewed (CamCarIdx) when available,
 * falling back to the driver's own car (DriverCarIdx) otherwise.
 *
 * This ensures the Relative and Standings displays always center on the
 * car being watched, regardless of whether you're:
 * - Racing (your own car)
 * - Spectating (another driver)
 * - Watching a replay
 * - Spotting for another driver
 * - Switching cameras during a session
 */
export const useFocusCarIdx = (): number | undefined => {
  const driverCarIdx = useDriverCarIdx();
  const camCarIdx = useTelemetryValue('CamCarIdx');

  // If we have a valid camera target, always use that
  // This works in all scenarios: racing, spectating, replays, spotting
  if (camCarIdx !== undefined && camCarIdx >= 0) {
    return camCarIdx;
  }

  // Fallback to driver's car index if no camera target
  return driverCarIdx;
};
