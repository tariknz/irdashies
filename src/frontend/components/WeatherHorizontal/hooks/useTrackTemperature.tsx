import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';

interface UseTrackTemperatureOptions {
  airTempUnit?: 'Metric' | 'Imperial';
  trackTempUnit?: 'Metric' | 'Imperial';
}

export const useTrackTemperature = (
  options: UseTrackTemperatureOptions = {}
) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const trackTempVal = useTelemetry('TrackTempCrew');
  const airTempVal = useTelemetry('AirTemp');

  const trackTemp = useMemo(() => {
    const temp = trackTempVal?.value[0] ?? 0;
    if (temp === null || temp === undefined) return '';
    const displayTemp =
      trackTempUnit === 'Imperial' ? (temp * 9) / 5 + 32 : temp;
    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [trackTempVal?.value, trackTempUnit]);

  const airTemp = useMemo(() => {
    const temp = airTempVal?.value[0] ?? 0;
    if (temp === null || temp === undefined) return '';
    const displayTemp = airTempUnit === 'Imperial' ? (temp * 9) / 5 + 32 : temp;
    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [airTempVal?.value, airTempUnit]);

  return { trackTemp, airTemp };
};
