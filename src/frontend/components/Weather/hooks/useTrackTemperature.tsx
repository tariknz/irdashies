import { useMemo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

interface UseTrackTemperatureOptions {
  airTempUnit?: 'Metric' | 'Imperial';
  trackTempUnit?: 'Metric' | 'Imperial';
}

export const useTrackTemperature = (
  options: UseTrackTemperatureOptions = {}
) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const trackTempVal = useTelemetryValue('TrackTempCrew');
  const airTempVal = useTelemetryValue('AirTemp');

  const trackTemp = useMemo(() => {
    const trackTemp = trackTempVal ?? 0;
    const displayTemp =
      trackTempUnit === 'Imperial' ? (trackTemp * 9) / 5 + 32 : trackTemp;
    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${Math.round(displayTemp)}°${unit}`;
  }, [trackTempVal, trackTempUnit]);

  const airTemp = useMemo(() => {
    const airTemp = airTempVal ?? 0;
    const displayTemp =
      airTempUnit === 'Imperial' ? (airTemp * 9) / 5 + 32 : airTemp;
    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${Math.round(displayTemp)}°${unit}`;
  }, [airTempVal, airTempUnit]);

  return { trackTemp, airTemp };
};
