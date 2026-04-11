import { useMemo } from 'react';
import { useTelemetryValues } from '../index';
export const useCarIdxOffTrack = (): boolean[] => {
  const trackSurface = useTelemetryValues<number[]>('CarIdxTrackSurface');
  return useMemo(
    () => trackSurface.map((surface) => surface === 0),
    [trackSurface]
  );
};
