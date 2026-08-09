import { useMemo } from 'react';
import { useSessionBarSnapshot } from '@irdashies/context';

type TemperatureUnit = 'Metric' | 'Imperial';

interface UseTrackTemperatureOptions {
  airTempUnit?: TemperatureUnit;
  trackTempUnit?: TemperatureUnit;
}

export const useTrackTemperature = (
  options: UseTrackTemperatureOptions = {}
) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const snapshot = useSessionBarSnapshot();
  const trackTempVal = snapshot?.trackTemp;
  const airTempVal = snapshot?.airTemp;

  const trackTemp = useMemo(() => {
    if (trackTempVal === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp =
      trackTempUnit === 'Imperial' ? (trackTempVal * 9) / 5 + 32 : trackTempVal;

    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [trackTempVal, trackTempUnit]);

  const airTemp = useMemo(() => {
    if (airTempVal === undefined) return '';

    // Convert to Fahrenheit if Imperial unit is selected
    const displayTemp =
      airTempUnit === 'Imperial' ? (airTempVal * 9) / 5 + 32 : airTempVal;

    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${displayTemp.toFixed(0)}°${unit}`;
  }, [airTempVal, airTempUnit]);

  return { trackTemp, airTemp };
};
