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
    if (trackTempVal === undefined) return '';
    const displayTemp =
      trackTempUnit === 'Imperial' ? (trackTempVal * 9) / 5 + 32 : trackTempVal;
    const unit = trackTempUnit === 'Imperial' ? 'F' : 'C';
    return `${Math.round(displayTemp)}°${unit}`;
  }, [trackTempVal, trackTempUnit]);

  const airTemp = useMemo(() => {
    if (airTempVal === undefined) return '';
    const displayTemp =
      airTempUnit === 'Imperial' ? (airTempVal * 9) / 5 + 32 : airTempVal;
    const unit = airTempUnit === 'Imperial' ? 'F' : 'C';
    return `${Math.round(displayTemp)}°${unit}`;
  }, [airTempVal, airTempUnit]);

  return { trackTemp, airTemp };
};
