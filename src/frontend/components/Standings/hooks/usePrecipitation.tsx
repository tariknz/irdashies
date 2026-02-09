import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

/**
 * Hook to get the Track Precipitation.
 * These values update in real-time as track conditions change.
 *
 * @returns Object with Track Precipitation percentage value.
 */

export const usePrecipitation = () => {
  // Precipitation is given as a decimal (0.0 to 1.0), convert to percentage
  const precipitationBase = (useTelemetryValue('Precipitation') ?? 0) * 100;
  const precipitationVal = Math.round(precipitationBase * 10) / 10;
  
  const precipitation = useMemo(() => {
    const precipitationLevel = precipitationVal ?? 0;
    return `${precipitationLevel}%`;
  }, [precipitationVal]);

  return { precipitation };
};
