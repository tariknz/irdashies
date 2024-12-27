import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

export const useTrackTemperature = () => {
  const trackTempVal = useTelemetryValue('TrackTempCrew');
  const airTempVal = useTelemetryValue('AirTemp');

  const trackTemp = useMemo(() => {
    const trackTemp = trackTempVal?.value[0] ?? 0;
    if (trackTemp === null || trackTemp === undefined) return '';
    return `${trackTemp.toFixed(0)}°${trackTempVal?.unit}`;
  }, [trackTempVal?.unit, trackTempVal?.value]);

  const airTemp = useMemo(() => {
    const airTemp = airTempVal?.value[0] ?? 0;
    if (airTemp === null || airTemp === undefined) return '';
    return `${airTemp.toFixed(0)}°${airTempVal?.unit}`;
  }, [airTempVal?.unit, airTempVal?.value]);

  return { trackTemp, airTemp };
};
