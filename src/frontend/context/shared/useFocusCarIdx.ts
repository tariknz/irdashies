import { useDriverCarIdx, useSessionDrivers } from '../SessionStore/SessionStore';
import { useTelemetryValue } from '../TelemetryStore/TelemetryStore';

/**
 * Hook to get the car index that should be the "focus" for relative displays.
 *
 * When driving: returns DriverCarIdx (the player's car)
 * When spectating: returns CamCarIdx (the car being watched)
 *
 * This allows the Relative display to show gaps around the spectated car
 * instead of always showing the spectator's entry.
 */
export const useFocusCarIdx = (): number | undefined => {
  const driverCarIdx = useDriverCarIdx();
  const camCarIdx = useTelemetryValue('CamCarIdx');
  const drivers = useSessionDrivers();

  // Check if the user is a spectator
  const isSpectator = drivers?.find(
    (d) => d.CarIdx === driverCarIdx
  )?.IsSpectator === 1;

  // If spectating and we have a valid camera target, use that
  // Otherwise use the driver's car index
  if (isSpectator && camCarIdx !== undefined && camCarIdx >= 0) {
    return camCarIdx;
  }

  return driverCarIdx;
};
