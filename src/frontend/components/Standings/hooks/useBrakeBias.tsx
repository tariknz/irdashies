import { useSessionBarSnapshot } from '@irdashies/context';

/**
 * Hook to get the player's dynamic brake bias value.
 * Uses dcPeakBrakeBias for Renault Clio (CarID 162), dcBrakeBias for all other cars.
 * These values update in real-time as drivers adjust brake bias during the race.
 *
 * @returns Object with brake bias value and whether it's a Clio (affects display format)
 */
export const useBrakeBias = ():
  { value: number; isClio: boolean } | undefined => {
  const snapshot = useSessionBarSnapshot();
  const brakeBias = snapshot?.brakeBias;

  if (brakeBias === undefined) return undefined;

  return { value: brakeBias, isClio: snapshot?.brakeBiasIsClio ?? false };
};
