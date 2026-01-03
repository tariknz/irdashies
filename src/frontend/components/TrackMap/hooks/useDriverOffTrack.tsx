import { useMemo } from 'react';
import { useTelemetryValues } from '@irdashies/context';

export const useDriverOffTrack = (): boolean[] => {
  const trackSurface = useTelemetryValues<number[]>('CarIdxTrackSurface');
  return useMemo(() => trackSurface.map((surface) => surface === 0), [trackSurface]);
};