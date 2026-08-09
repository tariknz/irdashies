import { useMemo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';

interface UseTrackTemperatureOptions {
  airTempUnit?: 'Metric' | 'Imperial';
  trackTempUnit?: 'Metric' | 'Imperial';
}

export const useTrackTemperature = (
  options: UseTrackTemperatureOptions = {}
) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const snapshot = useSessionBarSnapshot();
  const trackTempVal = snapshot?.trackTemp;
  const airTempVal = snapshot?.airTemp;

  const trackTemp = useMemo(() => {
    const trackTemp = trackTempVal ?? 0;
    if (trackTemp === null || trackTemp === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp =
      trackTempUnit === 'Imperial' ? (trackTemp * 9) / 5 + 32 : trackTemp;

    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [trackTempVal, trackTempUnit]);

  const airTemp = useMemo(() => {
    const airTemp = airTempVal ?? 0;
    if (airTemp === null || airTemp === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp =
      airTempUnit === 'Imperial' ? (airTemp * 9) / 5 + 32 : airTemp;

    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [airTempVal, airTempUnit]);

  return { trackTemp, airTemp };
};
