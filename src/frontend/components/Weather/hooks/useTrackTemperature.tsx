import { useMemo } from 'react';
import type { SessionBarSnapshot } from '@irdashies/types';
import { shallow } from 'zustand/shallow';
import { useSessionBarSelector } from '@irdashies/context';

interface UseTrackTemperatureOptions {
  airTempUnit?: 'Metric' | 'Imperial';
  trackTempUnit?: 'Metric' | 'Imperial';
}

const EMPTY_TEMPERATURES: readonly [number | undefined, number | undefined] = [
  undefined,
  undefined,
];

const selectTemperatures = (snapshot: SessionBarSnapshot) =>
  [snapshot.trackTemp, snapshot.airTemp] as const;

export const useTrackTemperature = (
  options: UseTrackTemperatureOptions = {}
) => {
  const { airTempUnit = 'Metric', trackTempUnit = 'Metric' } = options;
  const [trackTempVal, airTempVal] =
    useSessionBarSelector(selectTemperatures, { equality: shallow }) ??
    EMPTY_TEMPERATURES;

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
