import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';

interface UseTrackTemperatureOptions {
  airTempUnit?: 'Metric' | 'Imperial';
  trackTempUnit?: 'Metric' | 'Imperial';
}

export const useTrackTemperature = (options: UseTrackTemperatureOptions = {}) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const trackTempVal = useTelemetry('TrackTempCrew');
  const airTempVal = useTelemetry('AirTemp');

  const trackTemp = useMemo(() => {
    const trackTemp = trackTempVal?.value[0] ?? 0;
    if (trackTemp === null || trackTemp === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp = trackTempUnit === 'Imperial'
      ? (trackTemp * 9/5) + 32
      : trackTemp;

    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [trackTempVal?.value, trackTempUnit]);

  const airTemp = useMemo(() => {
    const airTemp = airTempVal?.value[0] ?? 0;
    if (airTemp === null || airTemp === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp = airTempUnit === 'Imperial'
      ? (airTemp * 9/5) + 32
      : airTemp;

    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [airTempVal?.value, airTempUnit]);

  return { trackTemp, airTemp };
};
