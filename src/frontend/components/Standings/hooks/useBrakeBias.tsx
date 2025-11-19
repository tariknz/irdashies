import { useTelemetryValue } from '@irdashies/context';
import { useSessionDrivers, useDriverCarIdx } from '@irdashies/context';

/**
 * Hook to get the player's dynamic brake bias value.
 * Uses dcPeakBrakeBias for Renault Clio (CarID 162), dcBrakeBias for all other cars.
 * These values update in real-time as drivers adjust brake bias during the race.
 *
 * @returns Object with brake bias value and whether it's a Clio (affects display format)
 */
export const useBrakeBias = (): { value: number; isClio: boolean } | undefined => {
  const drivers = useSessionDrivers();
  const playerCarIdx = useDriverCarIdx();
  const dcBrakeBias = useTelemetryValue('dcBrakeBias');
  const dcPeakBrakeBias = useTelemetryValue('dcPeakBrakeBias');

  // Get player's car ID
  const playerDriver = drivers?.find((d) => d.CarIdx === playerCarIdx);
  const carId = playerDriver?.CarID;

  // Renault Clio (CarID 162) uses dcPeakBrakeBias, all others use dcBrakeBias
  const RENAULT_CLIO_CAR_ID = 162;
  const isClio = carId === RENAULT_CLIO_CAR_ID;
  const brakeBias = isClio ? dcPeakBrakeBias : dcBrakeBias;

  if (brakeBias === undefined) return undefined;

  return { value: brakeBias, isClio };
};
